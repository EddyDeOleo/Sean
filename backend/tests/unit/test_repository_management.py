r"""Repository management API tests (Spec 4 section 16).

Every test uses a temporary LOCALAPPDATA. The real registry and the real %LOCALAPPDATA% are never read or written.
"""

from __future__ import annotations

import asyncio
import ctypes
import hashlib
import json
import logging
import os
import subprocess
import threading
import time
from pathlib import Path

import pytest

from app.api import repository_routes as routes
from app.api.advisor_routes import create_advisor_router
from app.api.app import create_app
from app.api.local_guard import LocalOnlyMiddleware
from app.api.repository_routes import create_repository_router
from app.modules.repository import management
from app.modules.repository.holder import RegistryHolder
from app.modules.repository.management import load_snapshot
from app.modules.repository.registry import default_registry_path, load_registry

JSON = {"content-type": "application/json"}


# ---------------------------------------------------------------------------------------------------------- helpers


def call(app, method, path, payload=None, *, headers=None, raw=None):
    body = raw if raw is not None else (json.dumps(payload).encode() if payload is not None else b"")
    # Sean's own frontend sends this header on every call that changes the registry.
    client = {"x-sean-client": "web"} if method in {"POST", "PUT", "DELETE"} else {}
    merged = {"host": "127.0.0.1:8000", **({"content-type": "application/json"} if body else {}), **client, **(headers or {})}
    merged = {key: value for key, value in merged.items() if value is not None}
    merged["content-length"] = str(len(body))
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http",
        "path": path, "raw_path": path.encode(), "query_string": b"", "root_path": "",
        "headers": [(k.encode(), v.encode()) for k, v in merged.items()],
        "client": ("127.0.0.1", 50000), "server": ("testserver", 80),
    }
    messages: list[dict] = []
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    text = b"".join(m.get("body", b"") for m in messages[1:] if m["type"] == "http.response.body").decode("utf-8")
    try:
        return messages[0]["status"], json.loads(text)
    except json.JSONDecodeError:
        return messages[0]["status"], text


def tree_snapshot(root: Path) -> dict[str, str]:
    """Relative path -> content hash (files) or 'dir'. Used to prove what was and was not written."""
    result: dict[str, str] = {}
    for current, directories, files in os.walk(root):
        for name in directories:
            result[os.path.relpath(os.path.join(current, name), root)] = "dir"
        for name in files:
            full = os.path.join(current, name)
            result[os.path.relpath(full, root)] = hashlib.sha256(Path(full).read_bytes()).hexdigest()
    return result


def seed(path: Path, entries: list[dict]) -> bytes:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps({"schema_version": 1, "repositories": entries}, indent=2) + "\n").encode()
    path.write_bytes(data)
    return data


class Env:
    def __init__(self, tmp_path: Path, make_repo, monkeypatch):
        self.tmp = tmp_path
        self.localappdata = tmp_path / "localappdata"
        self.localappdata.mkdir()
        monkeypatch.setenv("LOCALAPPDATA", str(self.localappdata))
        self.registry_file = self.localappdata / "Sean" / "config" / "repositories.json"
        self._make_repo = make_repo
        self.holder: RegistryHolder | None = None
        self.app = self.build()

    def build(self):
        self.holder = RegistryHolder(*load_snapshot(default_registry_path()))
        app = create_app(self.holder)
        app.add_middleware(LocalOnlyMiddleware)
        app.include_router(create_advisor_router(self.holder))
        app.include_router(create_repository_router(self.holder))
        self.app = app
        return app

    def repo(self):
        repo = self._make_repo()
        repo.write("src/billing.py", "def charge(amount):\n    return amount\n")
        repo.write("README.md", "# sample\n")
        repo.commit("feat: add billing")
        return repo

    def add(self, repository_id, path, name="Display"):
        return call(self.app, "POST", "/repositories", {"repository_id": repository_id, "display_name": name, "path": str(path)})

    def listing(self):
        status, body = call(self.app, "GET", "/repositories")
        assert status == 200
        return body["repositories"]

    def file_bytes(self):
        return self.registry_file.read_bytes()


@pytest.fixture
def env(tmp_path, make_repo, monkeypatch):
    return Env(tmp_path, make_repo, monkeypatch)


# ---------------------------------------------------------------------------------------------------------- add


def test_add_returns_201_with_the_list_item_shape_and_is_listed_at_once(env):
    repo = env.repo()
    status, body = env.add("alpha", repo.path, "Alpha repo")
    assert status == 201
    assert body == {
        "repository_id": "alpha", "display_name": "Alpha repo", "path": os.path.normpath(str(repo.path)),
        "available": True, "github": None,
    }
    assert env.listing() == [body]
    stored = json.loads(env.file_bytes())
    assert stored == {"schema_version": 1, "repositories": [{"repository_id": "alpha", "root": body["path"], "display_name": "Alpha repo"}]}
    assert load_registry(env.registry_file).entries["alpha"].display_name == "Alpha repo"


def test_a_new_repository_works_on_the_next_request_without_restart(env):
    repo = env.repo()
    payload = {"repository_id": "alpha", "target": {"path": "src/billing.py"}, "question": "Why?"}
    assert call(env.app, "POST", "/investigations", payload)[0] == 404
    assert call(env.app, "POST", "/repositories/alpha/profile")[0] == 404
    assert env.add("alpha", repo.path)[0] == 201
    status, profile = call(env.app, "POST", "/repositories/alpha/profile")
    assert status == 200 and profile["profile"]["repository_id"] == "alpha"
    status, investigation = call(env.app, "POST", "/investigations", payload)
    assert status == 200 and investigation["repository"]["repository_id"] == "alpha"
    status, preview = call(env.app, "POST", "/artifacts/preview", {"repository_id": "alpha", "capabilities": ["STEERING"]})
    assert status == 200
    status, plan = call(env.app, "POST", "/interpret", {"text": "alpha — Why did src/billing.py change?"})
    assert status == 200 and plan["repository_id"] == "alpha"


def test_default_display_name_is_the_identifier_when_none_is_stored(env):
    repo = env.repo()
    seed(env.registry_file, [{"repository_id": "legacy", "root": str(repo.path)}])
    env.build()
    app = env.app
    assert call(app, "GET", "/repositories")[1]["repositories"][0]["display_name"] == "legacy"


@pytest.mark.parametrize("bad", ["", "UPPER", "has space", "..", "a" * 65, "-lead", "a/b", "é", "x\n"])
def test_invalid_repository_id(env, bad):
    repo = env.repo()
    status, body = env.add(bad, repo.path)
    assert status == 400 and body["code"] == "INVALID_REPOSITORY_ID"
    assert not env.registry_file.exists()


@pytest.mark.parametrize("bad", ["", "   ", "a" * 81, "bad\nname", "bad\x00name", "bad\u202ename", "bad\u200bname", "x\u2028y"])
def test_invalid_display_name(env, bad):
    repo = env.repo()
    status, body = env.add("alpha", repo.path, bad)
    assert status == 400 and body["code"] == "INVALID_DISPLAY_NAME"
    assert not env.registry_file.exists()


def test_display_name_boundaries_are_accepted(env):
    repo = env.repo()
    assert env.add("alpha", repo.path, "x")[0] == 201
    other = env.repo()
    assert env.add("beta", other.path, "é" * 80)[0] == 201


def test_nonexistent_path(env):
    status, body = env.add("alpha", env.tmp / "does-not-exist")
    assert status == 400 and body["code"] == "PATH_NOT_FOUND"
    assert str(env.tmp) not in json.dumps(body)


def test_path_that_is_a_file(env):
    file = env.tmp / "afile.txt"
    file.write_text("x")
    status, body = env.add("alpha", file)
    assert status == 400 and body["code"] == "PATH_NOT_FOUND" and "not a folder" in body["message"]


def test_directory_that_is_not_a_git_repository(env):
    plain = env.tmp / "plain"
    plain.mkdir()
    status, body = env.add("alpha", plain)
    assert status == 400 and body["code"] == "NOT_A_GIT_REPOSITORY"
    assert str(env.tmp) not in json.dumps(body)


def test_subfolder_of_a_repository_is_rejected_but_the_root_is_accepted(env):
    repo = env.repo()
    status, body = env.add("sub", repo.path / "src")
    assert status == 400 and body["code"] == "NOT_A_GIT_REPOSITORY"
    assert env.add("root", repo.path)[0] == 201


def test_bare_repository_and_git_directory_are_rejected(env):
    bare = env.tmp / "bare.git"
    subprocess.run(["git", "init", "-q", "--bare", str(bare)], check=True)
    assert env.add("bare", bare)[1]["code"] == "NOT_A_GIT_REPOSITORY"
    repo = env.repo()
    assert env.add("inside", repo.path / ".git")[1]["code"] == "NOT_A_GIT_REPOSITORY"


@pytest.mark.parametrize(
    "bad",
    [
        "repo", r"relative\repo", r".\repo", r"..\repo", r"\rooted", "/rooted", "C:drive-relative",
        r"\\server\share\repo", "//server/share/repo", r"\\?\C:\repo", r"\\.\C:\repo", r"\\?\UNC\server\share",
        "C:\\a\\..\\b", "C:/a/../b", "C:\\a\\b\\..", "C:\\a\nb", "C:\\a\x00b", "C:\\" + "a" * 5000, " C:\\a", "C:\\a ",
        "C:\\a<b", "C:\\a|b", "C:\\a?b", "C:\\a\\b:stream", "C:\\a.\\b", "C:\\NUL", "C:\\con.txt", "",
    ],
)
def test_path_format_is_rejected_before_the_disk_is_touched(env, bad, monkeypatch):
    def never(*_args, **_kwargs):
        raise AssertionError("Git must not run for a malformed path")

    monkeypatch.setattr(management, "run_git", never)
    status, body = call(env.app, "POST", "/repositories", {"repository_id": "alpha", "display_name": "A", "path": bad})
    assert status == 400 and body["code"] == "INVALID_INPUT" and body.get("field") == "path"
    assert not env.registry_file.exists()


def test_duplicate_identifier(env):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    before = env.file_bytes()
    status, body = env.add("alpha", second.path)
    assert status == 409 and body["code"] == "DUPLICATE_ID"
    assert env.file_bytes() == before


def _junction(link: Path, target: Path) -> bool:
    completed = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], capture_output=True, text=True)
    return completed.returncode == 0 and link.exists()


def _short_path(path: Path) -> str | None:
    buffer = ctypes.create_unicode_buffer(1024)
    length = ctypes.windll.kernel32.GetShortPathNameW(str(path), buffer, 1024)
    return buffer.value if 0 < length < 1024 else None


def test_duplicate_path_with_normalized_variants(env):
    repo = env.repo()
    assert env.add("alpha", repo.path)[0] == 201
    text = str(repo.path)
    variants = {
        "upper": text.upper(),
        "lower": text.lower(),
        "trailing backslash": text + "\\",
        "trailing slashes": text + "\\\\",
        "forward slashes": text.replace("\\", "/"),
        "dot segment": text + "\\.",
        "double separators": text.replace("\\", "\\\\"),
    }
    for label, variant in variants.items():
        status, body = env.add("beta", variant)
        assert (status, body.get("code"), body.get("existing_repository_id")) == (409, "DUPLICATE_PATH", "alpha"), label
    assert [item["repository_id"] for item in env.listing()] == ["alpha"]


def test_a_dot_dot_variant_of_a_registered_path_is_refused(env):
    repo = env.repo()
    assert env.add("alpha", repo.path)[0] == 201
    status, body = env.add("beta", str(repo.path.parent / "x" / ".." / repo.path.name))
    assert status == 400 and body["code"] == "INVALID_INPUT"


def test_duplicate_path_through_a_junction(env):
    repo = env.repo()
    link = env.tmp / "link-to-repo"
    if not _junction(link, repo.path):
        pytest.skip("directory junctions cannot be created on this machine")
    assert env.add("alpha", repo.path)[0] == 201
    status, body = env.add("beta", link)
    assert (status, body["code"]) == (409, "DUPLICATE_PATH")
    # And the other way round.
    other = env.repo()
    link2 = env.tmp / "link-to-other"
    assert _junction(link2, other.path)
    assert env.add("gamma", link2)[0] == 201
    assert env.add("delta", other.path)[1]["code"] == "DUPLICATE_PATH"


def test_duplicate_path_through_a_short_8_3_name(env):
    repo = env.repo()
    short = _short_path(repo.path)
    if short is None or os.path.normcase(short) == os.path.normcase(str(repo.path)):
        pytest.skip("8.3 short names are not generated for this path on this volume")
    assert env.add("alpha", repo.path)[0] == 201
    assert env.add("beta", short)[1]["code"] == "DUPLICATE_PATH"


def test_duplicate_path_is_detected_against_an_unusable_entry(env):
    repo = env.repo()
    seed(env.registry_file, [{"repository_id": "old", "root": str(repo.path).upper()}])
    env.build()
    status, body = env.add("new", repo.path)
    assert (status, body["code"], body["existing_repository_id"]) == (409, "DUPLICATE_PATH", "old")


# ---------------------------------------------------------------------------------------------------------- edit


def test_edit_name_and_path(env):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path, "One")[0] == 201
    status, body = call(env.app, "PUT", "/repositories/alpha", {"display_name": "Renamed", "path": str(first.path)})
    assert status == 200 and body["display_name"] == "Renamed" and body["repository_id"] == "alpha"
    status, body = call(env.app, "PUT", "/repositories/alpha", {"display_name": "Renamed", "path": str(second.path) + "\\"})
    assert status == 200 and body["path"] == os.path.normpath(str(second.path))
    assert env.listing() == [body]
    assert json.loads(env.file_bytes())["repositories"] == [
        {"repository_id": "alpha", "root": body["path"], "display_name": "Renamed"}
    ]


def test_edit_may_keep_its_own_path_in_another_spelling_but_not_take_anothers(env):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    assert env.add("beta", second.path)[0] == 201
    assert call(env.app, "PUT", "/repositories/alpha", {"display_name": "A", "path": str(first.path).upper()})[0] == 200
    status, body = call(env.app, "PUT", "/repositories/alpha", {"display_name": "A", "path": str(second.path).lower()})
    assert (status, body["code"], body["existing_repository_id"]) == (409, "DUPLICATE_PATH", "beta")


def test_edit_uses_the_same_validation(env):
    repo = env.repo()
    plain = env.tmp / "plain"
    plain.mkdir()
    assert env.add("alpha", repo.path)[0] == 201
    before = env.file_bytes()
    cases = [
        ({"display_name": "", "path": str(repo.path)}, "alpha", "INVALID_DISPLAY_NAME"),
        ({"display_name": "ok", "path": "relative"}, "alpha", "INVALID_INPUT"),
        ({"display_name": "ok", "path": str(env.tmp / "nope")}, "alpha", "PATH_NOT_FOUND"),
        ({"display_name": "ok", "path": str(plain)}, "alpha", "NOT_A_GIT_REPOSITORY"),
        ({"display_name": "ok", "path": str(repo.path / "src")}, "alpha", "NOT_A_GIT_REPOSITORY"),
        ({"display_name": "ok", "path": str(repo.path)}, "UPPER", "INVALID_REPOSITORY_ID"),
        ({"display_name": "ok", "path": str(repo.path)}, "missing", "REPOSITORY_NOT_FOUND"),
        ({"display_name": "ok", "path": str(repo.path), "repository_id": "x"}, "alpha", "INVALID_INPUT"),
    ]
    for payload, identifier, code in cases:
        status, body = call(env.app, "PUT", f"/repositories/{identifier}", payload)
        assert body["code"] == code, (payload, body)
        assert status == {"REPOSITORY_NOT_FOUND": 404}.get(code, 400)
    assert env.file_bytes() == before


def test_edit_keeps_the_identifier_and_unknown_fields_of_the_entry(env):
    first, second = env.repo(), env.repo()
    seed(env.registry_file, [{"repository_id": "alpha", "root": str(first.path), "github": {"owner": "acme", "name": "alpha"}}])
    env.build()
    status, body = call(env.app, "PUT", "/repositories/alpha", {"display_name": "A", "path": str(second.path)})
    assert status == 200 and body["github"] == {"owner": "acme", "name": "alpha"}
    assert json.loads(env.file_bytes())["repositories"][0]["github"] == {"owner": "acme", "name": "alpha"}


def test_edit_invalidates_the_profile_cache(env):
    first, second = env.repo(), env.repo()
    second.write("src/extra.py", "x = 1\n")
    second.commit("feat: extra")
    assert env.add("alpha", first.path)[0] == 201
    head_first = call(env.app, "POST", "/repositories/alpha/profile")[1]["profile"]["head"]
    assert call(env.app, "PUT", "/repositories/alpha", {"display_name": "A", "path": str(second.path)})[0] == 200
    head_second = call(env.app, "POST", "/repositories/alpha/profile")[1]["profile"]["head"]
    assert head_first != head_second == second.git("rev-parse", "HEAD").strip()


def test_unusable_entries_are_listed_and_can_be_repaired_or_removed(env):
    repo = env.repo()
    seed(env.registry_file, [{"repository_id": "moved", "root": str(env.tmp / "old-place"), "display_name": "Moved"}])
    env.build()
    items = env.listing()
    assert [(i["repository_id"], i["available"], i["display_name"]) for i in items] == [("moved", False, "Moved")]
    assert env.add("moved", repo.path)[1]["code"] == "DUPLICATE_ID"
    status, body = call(env.app, "PUT", "/repositories/moved", {"display_name": "Moved", "path": str(repo.path)})
    assert status == 200 and body["available"] is True
    assert call(env.app, "DELETE", "/repositories/moved")[0] == 200
    assert env.listing() == []


# ---------------------------------------------------------------------------------------------------------- delete


def test_delete_removes_only_the_registry_entry(env):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    assert env.add("beta", second.path)[0] == 201
    repo_before = tree_snapshot(first.path)
    status, body = call(env.app, "DELETE", "/repositories/alpha")
    assert (status, body) == (200, {"removed": "alpha"})
    assert tree_snapshot(first.path) == repo_before
    assert [i["repository_id"] for i in env.listing()] == ["beta"]
    assert [e["repository_id"] for e in json.loads(env.file_bytes())["repositories"]] == ["beta"]
    assert call(env.app, "POST", "/repositories/alpha/profile")[0] == 404
    payload = {"repository_id": "alpha", "target": {"path": "src/billing.py"}, "question": "Why?"}
    assert call(env.app, "POST", "/investigations", payload)[0] == 404
    assert call(env.app, "DELETE", "/repositories/alpha")[0] == 404


def test_delete_and_add_never_change_the_repository_directory(env):
    repo = env.repo()
    before = tree_snapshot(repo.path)
    assert env.add("alpha", repo.path)[0] == 201
    assert call(env.app, "PUT", "/repositories/alpha", {"display_name": "x", "path": str(repo.path)})[0] == 200
    assert call(env.app, "DELETE", "/repositories/alpha")[0] == 200
    assert tree_snapshot(repo.path) == before


def test_delete_with_an_invalid_identifier(env):
    status, body = call(env.app, "DELETE", "/repositories/UPPER")
    assert (status, body["code"]) == (400, "INVALID_REPOSITORY_ID")


# ---------------------------------------------------------------------------------------------------------- persistence


def test_existing_entries_and_ordering_are_preserved(env):
    repo = env.repo()
    kept = [
        {"repository_id": "zeta", "root": str(env.tmp / "missing-1"), "github": {"owner": "acme", "name": "zeta"}},
        {"repository_id": "bad entry!", "root": "relative", "unknown": 1},  # invalid, but not ours to change
        {"repository_id": "alpha", "root": str(env.tmp / "missing-2"), "display_name": "Alpha"},
    ]
    seed(env.registry_file, kept)
    env.build()
    assert env.add("new", repo.path)[0] == 201
    entries = json.loads(env.file_bytes())["repositories"]
    assert entries[:3] == kept and entries[3]["repository_id"] == "new"
    assert call(env.app, "DELETE", "/repositories/new")[0] == 200
    assert json.loads(env.file_bytes())["repositories"] == kept


def test_a_backup_of_the_previous_file_is_kept(env):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    assert not env.registry_file.with_name("repositories.json.bak").exists()
    after_first = env.file_bytes()
    assert env.add("beta", second.path)[0] == 201
    assert env.registry_file.with_name("repositories.json.bak").read_bytes() == after_first


def test_write_failure_at_replace_leaves_the_original_and_no_temp_file(env, monkeypatch):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    before_bytes, before_dir = env.file_bytes(), sorted(os.listdir(env.registry_file.parent))

    def boom(*_args, **_kwargs):
        raise OSError("simulated")

    with monkeypatch.context() as patch:
        patch.setattr(os, "replace", boom)
        status, body = env.add("beta", second.path)
    assert (status, body["code"]) == (500, "REGISTRY_WRITE_FAILED")
    assert "simulated" not in json.dumps(body)
    assert env.file_bytes() == before_bytes
    assert sorted(os.listdir(env.registry_file.parent)) == before_dir
    assert [i["repository_id"] for i in env.listing()] == ["alpha"]  # the running registry did not change either


def test_write_failure_during_the_write_leaves_the_original_and_no_temp_file(env, monkeypatch):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    before_bytes, before_dir = env.file_bytes(), sorted(os.listdir(env.registry_file.parent))

    def boom(*_args, **_kwargs):
        raise OSError("disk full")

    with monkeypatch.context() as patch:
        patch.setattr(os, "fsync", boom)
        status, body = env.add("beta", second.path)
    assert (status, body["code"]) == (500, "REGISTRY_WRITE_FAILED")
    assert env.file_bytes() == before_bytes
    assert sorted(os.listdir(env.registry_file.parent)) == before_dir
    # A later write still works.
    assert env.add("beta", second.path)[0] == 201


def test_first_write_failure_creates_no_registry_file(env, monkeypatch):
    repo = env.repo()
    with monkeypatch.context() as patch:
        patch.setattr(os, "replace", lambda *_a, **_k: (_ for _ in ()).throw(OSError("simulated")))
        status, body = env.add("alpha", repo.path)
    assert (status, body["code"]) == (500, "REGISTRY_WRITE_FAILED")
    assert not env.registry_file.exists() and list(env.registry_file.parent.iterdir()) == []


def test_registry_size_limit_is_enforced(env, monkeypatch):
    first, second = env.repo(), env.repo()
    assert env.add("alpha", first.path)[0] == 201
    before = env.file_bytes()
    monkeypatch.setattr(management, "MAX_REGISTRY_BYTES", len(before) + 10)
    status, body = env.add("beta", second.path)
    assert (status, body["code"]) == (500, "REGISTRY_WRITE_FAILED") and "size limit" in body["message"]
    assert env.file_bytes() == before


def test_concurrent_adds_do_not_lose_entries(env):
    count = 12
    repos = [env.repo() for _ in range(count)]
    results: dict[int, int] = {}

    def worker(index: int):
        # The Git check cap is small, so a busy server answers 429 and the caller tries again. Allow a slow machine plenty of time.
        for _ in range(1500):
            status, _body = env.add(f"repo-{index}", repos[index].path)
            if status != 429:
                results[index] = status
                return
            time.sleep(0.02)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    # Every worker must have finished with an answer. (A worker that gave up while the server was busy would be missing here,
    # which once made this test look like it lost an entry.)
    assert sorted(results) == list(range(count))
    assert set(results.values()) == {201}
    stored = {e["repository_id"] for e in json.loads(env.file_bytes())["repositories"]}
    assert stored == {f"repo-{i}" for i in range(count)}
    assert {i["repository_id"] for i in env.listing()} == stored


def test_concurrent_store_mutations_do_not_lose_entries(env):
    path = env.registry_file
    count = 30
    roots = [env.tmp / f"folder-{i}" for i in range(count)]

    def worker(index: int):
        management.add_repository(path, f"r{index}", f"R{index}", str(roots[index]))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert {e["repository_id"] for e in json.loads(path.read_bytes())["repositories"]} == {f"r{i}" for i in range(count)}


@pytest.mark.parametrize(
    "content",
    [b"", b"not json", b"[]", b'{"schema_version": 2, "repositories": []}', b'{"schema_version": 1}',
     b'{"schema_version": 1, "repositories": {}}', b'{"schema_version": 1, "repositories": [], "extra": 1}',
     b'{"schema_version": 1, "schema_version": 1, "repositories": []}', b"\xff\xfe\x00",
     b'{"schema_version": 1, "repositories": []}' + b" " * (256 * 1024)],
)
def test_an_invalid_registry_file_is_never_overwritten(env, content):
    repo = env.repo()
    env.registry_file.parent.mkdir(parents=True)
    env.registry_file.write_bytes(content)
    env.build()
    before = tree_snapshot(env.localappdata)
    assert env.add("alpha", repo.path)[1]["code"] == "REGISTRY_UNAVAILABLE"
    assert call(env.app, "PUT", "/repositories/alpha", {"display_name": "a", "path": str(repo.path)})[1]["code"] == "REGISTRY_UNAVAILABLE"
    assert call(env.app, "DELETE", "/repositories/alpha")[1]["code"] == "REGISTRY_UNAVAILABLE"
    assert tree_snapshot(env.localappdata) == before
    status, body = env.add("alpha", repo.path)
    assert status == 503 and "not modified" in body["message"]


def test_localappdata_unset_is_registry_unavailable(env, monkeypatch):
    repo = env.repo()
    monkeypatch.delenv("LOCALAPPDATA")
    env.build()
    for status, body in (
        env.add("alpha", repo.path),
        call(env.app, "PUT", "/repositories/alpha", {"display_name": "a", "path": str(repo.path)}),
        call(env.app, "DELETE", "/repositories/alpha"),
    ):
        assert (status, body["code"]) == (503, "REGISTRY_UNAVAILABLE")
    assert env.listing() == []


def test_the_backend_writes_nothing_outside_the_registry_files(env):
    first, second = env.repo(), env.repo()
    before = tree_snapshot(env.tmp)
    assert env.add("alpha", first.path)[0] == 201
    assert env.add("beta", second.path)[0] == 201
    assert call(env.app, "PUT", "/repositories/beta", {"display_name": "B", "path": str(second.path)})[0] == 200
    assert call(env.app, "DELETE", "/repositories/alpha")[0] == 200
    after = tree_snapshot(env.tmp)
    allowed_new = {
        os.path.join("localappdata", "Sean"), os.path.join("localappdata", "Sean", "config"),
        os.path.join("localappdata", "Sean", "config", "repositories.json"),
        os.path.join("localappdata", "Sean", "config", "repositories.json.bak"),
    }
    changed = {path for path in after if before.get(path) != after[path]}
    assert changed == allowed_new, sorted(changed ^ allowed_new)
    assert set(before) <= set(after)  # nothing was deleted either


def test_only_the_data_directory_chain_is_created(env, monkeypatch):
    repo = env.repo()
    # LOCALAPPDATA itself does not exist: the backend must not create it.
    missing = env.tmp / "no-such-local-appdata"
    monkeypatch.setenv("LOCALAPPDATA", str(missing))
    env.build()
    status, body = env.add("alpha", repo.path)
    assert (status, body["code"]) == (500, "REGISTRY_WRITE_FAILED")
    assert not missing.exists()


# ---------------------------------------------------------------------------------------------------------- transport


def test_content_type_must_be_json(env):
    repo = env.repo()
    payload = {"repository_id": "alpha", "display_name": "A", "path": str(repo.path)}
    raw = json.dumps(payload).encode()
    for headers in (
        {"content-type": "text/plain"}, {"content-type": "application/x-www-form-urlencoded"},
        {"content-type": "multipart/form-data; boundary=x"}, {"content-type": None}, {"content-type": "application/jsonx"},
    ):
        status, body = call(env.app, "POST", "/repositories", raw=raw, headers=headers)
        assert (status, body["code"]) == (400, "INVALID_INPUT"), headers
        status, body = call(env.app, "PUT", "/repositories/alpha", raw=json.dumps({"display_name": "A", "path": str(repo.path)}).encode(), headers=headers)
        assert (status, body["code"]) == (400, "INVALID_INPUT"), headers
    assert not env.registry_file.exists()
    assert call(env.app, "POST", "/repositories", raw=raw, headers={"content-type": "application/json; charset=utf-8"})[0] == 201


@pytest.mark.parametrize(
    "payload",
    [
        {"repository_id": "alpha", "display_name": "A"},
        {"repository_id": "alpha", "path": "C:\\x"},
        {"display_name": "A", "path": "C:\\x"},
        {"repository_id": "alpha", "display_name": "A", "path": "C:\\x", "extra": 1},
        {"repository_id": "alpha", "display_name": "A", "path": "C:\\x", "root": "C:\\y"},
        {"repository_id": 5, "display_name": "A", "path": "C:\\x"},
        {"repository_id": "alpha", "display_name": 5, "path": "C:\\x"},
        {"repository_id": "alpha", "display_name": "A", "path": None},
        {"repository_id": "alpha", "display_name": "A", "path": ["C:\\x"]},
    ],
)
def test_missing_extra_and_mistyped_fields_are_rejected(env, payload):
    status, body = call(env.app, "POST", "/repositories", payload)
    assert (status, body["code"]) == (400, "INVALID_INPUT")
    assert not env.registry_file.exists()


@pytest.mark.parametrize("raw", [b"", b"{", b"[]", b'"x"', b"null", b"\xff\xfe", b"x" * (17 * 1024)])
def test_malformed_bodies_are_rejected(env, raw):
    status, body = call(env.app, "POST", "/repositories", raw=raw)
    assert (status, body["code"]) == (400, "INVALID_INPUT")


def test_the_local_guard_protects_the_write_routes(env):
    repo = env.repo()
    assert env.add("alpha", repo.path)[0] == 201
    before = env.file_bytes()
    add = {"repository_id": "beta", "display_name": "B", "path": str(repo.path)}
    edit = {"display_name": "Z", "path": str(repo.path)}
    for headers in (
        {"origin": "https://evil.example"}, {"origin": "null"}, {"origin": "http://127.0.0.1.evil.example"},
        {"host": "evil.example"}, {"host": ""},
    ):
        for method, path, payload in (("POST", "/repositories", add), ("PUT", "/repositories/alpha", edit), ("DELETE", "/repositories/alpha", None)):
            status, body = call(env.app, method, path, payload, headers=headers)
            assert (status, body["code"]) == (403, "REQUEST_REFUSED"), (method, headers)
    assert env.file_bytes() == before
    local = {"origin": "http://localhost:5173", "host": "localhost:8000"}
    assert call(env.app, "PUT", "/repositories/alpha", edit, headers=local)[0] == 200


def test_busy_answers_429_and_changes_nothing(env, monkeypatch):
    repo = env.repo()

    class Exhausted:
        def __init__(self, _n):
            pass

        def acquire(self, blocking=True):
            return False

        def release(self):
            raise AssertionError("no slot was taken")

    with monkeypatch.context() as patch:
        patch.setattr(routes.threading, "BoundedSemaphore", Exhausted)
        env.app = env.build()
    status, body = env.add("alpha", repo.path)
    assert (status, body["code"], body["retryable"]) == (429, "BUSY", True)
    assert not env.registry_file.exists()


def test_error_bodies_do_not_leak_paths_or_input(env):
    plain = env.tmp / "plain-secret-folder"
    plain.mkdir()
    repo = env.repo()
    assert env.add("alpha", repo.path)[0] == 201
    bodies = [
        env.add("beta", plain)[1], env.add("beta", repo.path)[1], env.add("alpha", plain)[1],
        env.add("beta", env.tmp / "secret-missing")[1], env.add("BAD-ID", repo.path)[1],
    ]
    text = json.dumps(bodies)
    for fragment in (str(env.tmp), "plain-secret-folder", "secret-missing", "BAD-ID", Path(repo.path).name):
        assert fragment not in text


def test_logging_records_operation_id_and_outcome_only(env, caplog):
    repo = env.repo()
    caplog.set_level(logging.DEBUG, logger="sean.repositories")
    env.add("alpha", repo.path, "Private display name")
    env.add("alpha", repo.path)
    call(env.app, "PUT", "/repositories/alpha", {"display_name": "Another private name", "path": str(repo.path)})
    call(env.app, "DELETE", "/repositories/alpha")
    call(env.app, "DELETE", "/repositories/UPPER")
    lines = [record.getMessage() for record in caplog.records if record.name == "sean.repositories"]
    assert "repository add id=alpha outcome=ok" in lines
    assert "repository add id=alpha outcome=DUPLICATE_ID" in lines
    assert "repository edit id=alpha outcome=ok" in lines
    assert "repository remove id=alpha outcome=ok" in lines
    assert "repository remove id=- outcome=INVALID_REPOSITORY_ID" in lines
    text = " ".join(lines)
    assert str(env.tmp) not in text and "private" not in text.lower()


def test_existing_phase_3_app_still_accepts_a_plain_registry(env):
    """create_app(LoadedRegistry) keeps working unchanged."""
    repo = env.repo()
    seed(env.registry_file, [{"repository_id": "alpha", "root": str(repo.path)}])
    plain = create_app(load_registry(env.registry_file))
    payload = {"repository_id": "alpha", "target": {"path": "src/billing.py"}, "question": "Why?"}
    assert call(plain, "POST", "/investigations", payload)[0] == 200


def test_changes_need_the_application_header_and_nothing_is_written_without_it(env):
    repo = env.repo()
    env.add("alpha", repo.path)
    before = env.file_bytes()
    add = {"repository_id": "beta", "display_name": "B", "path": str(repo.path)}
    edit = {"display_name": "Z", "path": str(repo.path)}
    for headers in ({"x-sean-client": None}, {"x-sean-client": "other"}, {"x-sean-client": ""}):
        for method, path, payload in (("POST", "/repositories", add), ("PUT", "/repositories/alpha", edit), ("DELETE", "/repositories/alpha", None)):
            status, body = call(env.app, method, path, payload, headers=headers)
            assert (status, body["code"]) == (403, "CLIENT_REQUIRED"), (method, headers)
    assert env.file_bytes() == before
    assert [i["repository_id"] for i in env.listing()] == ["alpha"]


def test_the_list_always_matches_the_file_after_concurrent_changes(env):
    repos = [env.repo() for _ in range(8)]

    def worker(index: int):
        for _ in range(1500):
            status, _body = env.add(f"r{index}", repos[index].path)
            if status != 429:
                return
            time.sleep(0.02)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    stored = {e["repository_id"] for e in json.loads(env.file_bytes())["repositories"]}
    assert stored == {f"r{i}" for i in range(8)}
    # The holder must not keep an older registry than the file (the reload races with the next write otherwise).
    assert {i["repository_id"] for i in env.listing()} == stored
