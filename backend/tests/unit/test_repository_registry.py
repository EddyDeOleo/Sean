"""Unit tests for app.modules.repository.registry.

Covers Evidence Retrieval Requirements 1.1 to 1.7 (.kiro/specs/evidence-retrieval/requirements.md)
and native tasks 1.1 to 1.3 (.kiro/specs/evidence-retrieval/tasks.md).

Every test works in pytest temporary directories. The real %LOCALAPPDATA% is never read: the
environment variable is either set to a temporary directory or removed with monkeypatch.
Git is never run. A repository root is a directory that contains an empty .git directory.
"""

from __future__ import annotations

import inspect
import json
import os
import shutil
from pathlib import Path
from typing import Any

import pytest

from app.modules.repository.registry import (
    GITHUB_IDENTITY_UNRESOLVED,
    MAX_REGISTRY_BYTES,
    PROBLEM_DUPLICATE_ID,
    PROBLEM_INVALID_ENTRY,
    PROBLEM_INVALID_JSON,
    PROBLEM_INVALID_STRUCTURE,
    PROBLEM_LOCATION_UNAVAILABLE,
    PROBLEM_MISSING,
    PROBLEM_ROOT_INVALID,
    PROBLEM_TOO_LARGE,
    PROBLEM_UNREADABLE,
    PROBLEM_UNSUPPORTED_VERSION,
    REPOSITORY_NOT_FOUND,
    REPOSITORY_UNAVAILABLE,
    GitHubIdentity,
    LoadedRegistry,
    RegistryEntry,
    RepositoryError,
    default_registry_path,
    load_registry,
    resolve_github_identity,
    resolve_repository,
)


def _make_repo(base: Path, name: str) -> Path:
    """Create a directory that looks like a Git work tree: it contains an empty .git directory."""
    root = base / name
    (root / ".git").mkdir(parents=True)
    return root


def _registry_file(tmp_path: Path) -> Path:
    return tmp_path / "config" / "repositories.json"


def _write_json(path: Path, document: Any) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(document), encoding="utf-8")
    return path


def _write_text(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def _document(*entries: Any, schema_version: Any = 1) -> dict[str, Any]:
    return {"schema_version": schema_version, "repositories": list(entries)}


def _entry(repository_id: str, root: Path | str, **extra: Any) -> dict[str, Any]:
    return {"repository_id": repository_id, "root": str(root), **extra}


def _codes(loaded: LoadedRegistry) -> list[str]:
    return [problem.code for problem in loaded.problems]


def _load_document(tmp_path: Path, document: Any) -> LoadedRegistry:
    return load_registry(_write_json(_registry_file(tmp_path), document))


# Requirement 1.1: a valid registry file loads and its entries are registered.
def test_valid_registry_file_loads_all_entries(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: a valid file with two entries loads both, with no problems."""
    alpha_root = _make_repo(tmp_path, "alpha")
    beta_root = _make_repo(tmp_path, "beta")
    path = _write_json(
        _registry_file(tmp_path),
        _document(
            _entry("alpha", alpha_root),
            _entry(
                "beta",
                beta_root,
                github={"owner": "Octo-Org", "name": "beta-repo"},
            ),
        ),
    )

    loaded = load_registry(path)

    assert loaded.problems == ()
    assert set(loaded.entries) == {"alpha", "beta"}
    assert loaded.entries["alpha"].root == str(alpha_root)
    assert loaded.entries["alpha"].github is None
    assert loaded.entries["beta"].github == GitHubIdentity(owner="Octo-Org", name="beta-repo")


# Requirement 1.1: unknown entry keys exclude only that entry.
def test_unknown_entry_key_excludes_only_that_entry(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: an entry with an unknown key is excluded; the others stay."""
    first = _make_repo(tmp_path, "first")
    third = _make_repo(tmp_path, "third")
    bad = _make_repo(tmp_path, "bad")
    loaded = _load_document(
        tmp_path,
        _document(
            _entry("first", first),
            _entry("second", bad, unexpected="value"),
            _entry("third", third),
        ),
    )

    assert set(loaded.entries) == {"first", "third"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_INVALID_ENTRY, 1)]


# Requirement 1.1: an unknown top-level key rejects the whole file.
def test_unknown_top_level_key_rejects_whole_file(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: an unknown top-level key leaves zero repositories registered."""
    root = _make_repo(tmp_path, "valid")
    document = _document(_entry("valid", root))
    document["extra_top_level"] = True

    loaded = _load_document(tmp_path, document)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_STRUCTURE]


# Requirement 1.1: schema_version must be the integer 1.
@pytest.mark.parametrize("version", ["1", 2, True, 1.0, 0], ids=["string", "two", "bool", "float", "zero"])
def test_schema_version_must_be_integer_one(tmp_path: Path, version: Any) -> None:
    """Requirement 1.1 and task 1.1: schema_version other than integer 1 is rejected, with zero entries."""
    root = _make_repo(tmp_path, "valid")

    loaded = _load_document(tmp_path, _document(_entry("valid", root), schema_version=version))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_UNSUPPORTED_VERSION]


# Requirement 1.1: a missing schema_version is a structure error, not a version guess.
def test_missing_schema_version_is_invalid_structure(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: a document without schema_version registers nothing."""
    root = _make_repo(tmp_path, "valid")
    document = {"repositories": [_entry("valid", root)]}

    loaded = _load_document(tmp_path, document)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_STRUCTURE]


# Requirement 1.1: a missing file leaves zero repositories and reports REGISTRY_MISSING.
def test_missing_file_reports_registry_missing(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a missing registry file gives zero entries and REGISTRY_MISSING."""
    loaded = load_registry(_registry_file(tmp_path))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_MISSING]


# Requirement 1.1: invalid JSON leaves zero repositories registered.
def test_invalid_json_reports_registry_invalid_json(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: malformed JSON gives zero entries and REGISTRY_INVALID_JSON."""
    path = _write_text(_registry_file(tmp_path), '{"schema_version": 1, "repositories": [')

    loaded = load_registry(path)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_JSON]


# Requirement 1.1: a duplicate JSON key is rejected, not silently overwritten.
@pytest.mark.parametrize(
    "text",
    [
        '{"schema_version": 1, "schema_version": 1, "repositories": []}',
        '{"schema_version": 1, "repositories": [], "repositories": []}',
    ],
    ids=["top-level-duplicate", "second-top-level-duplicate"],
)
def test_duplicate_json_key_reports_registry_invalid_json(tmp_path: Path, text: str) -> None:
    """Requirement 1.1 and task 1.2: a repeated key anywhere in the file gives REGISTRY_INVALID_JSON."""
    loaded = load_registry(_write_text(_registry_file(tmp_path), text))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_JSON]


# Requirement 1.1: a duplicate key inside an entry also rejects the file.
def test_duplicate_key_inside_entry_reports_registry_invalid_json(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a key repeated inside an entry gives REGISTRY_INVALID_JSON."""
    root = _make_repo(tmp_path, "valid")
    text = (
        '{"schema_version": 1, "repositories": [{"repository_id": "valid", '
        f'"root": {json.dumps(str(root))}, "root": {json.dumps(str(root))}}}]}}'
    )

    loaded = load_registry(_write_text(_registry_file(tmp_path), text))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_JSON]


# Requirement 1.1: repositories must be an array.
@pytest.mark.parametrize("value", [{}, "text", None], ids=["object", "string", "null"])
def test_repositories_not_an_array_is_invalid_structure(tmp_path: Path, value: Any) -> None:
    """Requirement 1.1 and task 1.2: a non-array repositories value registers nothing."""
    document = {"schema_version": 1, "repositories": value}

    loaded = _load_document(tmp_path, document)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_STRUCTURE]


# Requirement 1.1: a file whose top level is not an object is rejected.
def test_top_level_array_is_invalid_structure(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a top-level JSON array registers nothing."""
    loaded = _load_document(tmp_path, [1, 2, 3])

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_STRUCTURE]


# Requirement 1.1: a file over the size limit is rejected before it is parsed.
def test_file_over_max_registry_bytes_reports_too_large(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a file larger than MAX_REGISTRY_BYTES gives REGISTRY_TOO_LARGE."""
    path = _registry_file(tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b" " * (MAX_REGISTRY_BYTES + 1))

    loaded = load_registry(path)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_TOO_LARGE]


# Requirement 1.5: an unset or empty LOCALAPPDATA means no registry location.
@pytest.mark.parametrize("value", [None, ""], ids=["unset", "empty"])
def test_localappdata_unset_reports_location_unavailable(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    """Requirement 1.5 and task 1.2: without LOCALAPPDATA, no path is built and nothing is registered."""
    if value is None:
        monkeypatch.delenv("LOCALAPPDATA", raising=False)
    else:
        monkeypatch.setenv("LOCALAPPDATA", value)

    assert default_registry_path() is None
    loaded = load_registry(default_registry_path())

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_LOCATION_UNAVAILABLE]


# Requirement 1.5: the default location is %LOCALAPPDATA%\Sean\config\repositories.json.
def test_default_registry_path_builds_sean_config_location(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Requirement 1.5 and task 1.1: default_registry_path is LOCALAPPDATA\\Sean\\config\\repositories.json."""
    local_app_data = tmp_path / "local"
    monkeypatch.setenv("LOCALAPPDATA", str(local_app_data))

    path = default_registry_path()

    assert path == local_app_data / "Sean" / "config" / "repositories.json"
    assert not local_app_data.exists(), "default_registry_path must not create directories"


# Requirement 1.1 and 1.2: an invalid repository_id excludes only that entry.
@pytest.mark.parametrize(
    "bad_id",
    ["Bad_Upper", "-leading-hyphen", "has space", "dot.id", "", "a" * 65, "trailing-newline\n"],
    ids=["uppercase", "leading-hyphen", "space", "dot", "empty", "too-long", "trailing-newline"],
)
def test_invalid_repository_id_excludes_entry(tmp_path: Path, bad_id: str) -> None:
    """Requirement 1.1 and task 1.1: a repository_id outside REPOSITORY_ID_PATTERN is excluded alone."""
    good = _make_repo(tmp_path, "good")
    bad = _make_repo(tmp_path, "bad")
    loaded = _load_document(tmp_path, _document(_entry("good", good), _entry(bad_id, bad)))

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_INVALID_ENTRY, 1)]


# Requirement 1.1: the maximum valid repository_id length is accepted.
def test_repository_id_at_maximum_length_is_accepted(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: a 64-character lowercase repository_id loads without problems."""
    root = _make_repo(tmp_path, "boundary")
    loaded = _load_document(tmp_path, _document(_entry("a" * 64, root)))

    assert loaded.problems == ()
    assert set(loaded.entries) == {"a" * 64}


# Requirement 1.1: a duplicate repository_id excludes both copies and keeps the rest.
def test_duplicate_repository_id_excludes_both_copies(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a repeated repository_id is excluded for both entries."""
    first = _make_repo(tmp_path, "first")
    second = _make_repo(tmp_path, "second")
    other = _make_repo(tmp_path, "other")
    loaded = _load_document(
        tmp_path,
        _document(
            _entry("dup", first),
            _entry("other", other),
            _entry("dup", second),
        ),
    )

    assert set(loaded.entries) == {"other"}
    assert sorted((p.code, p.entry_index) for p in loaded.problems) == [
        (PROBLEM_DUPLICATE_ID, 0),
        (PROBLEM_DUPLICATE_ID, 2),
    ]


# Requirement 1.3 and 1.6: a root that is not absolute is excluded at startup.
@pytest.mark.parametrize("relative", ["relative\\repo", "repo", "..\\repo"], ids=["nested", "bare", "parent"])
def test_relative_root_is_excluded(tmp_path: Path, relative: str) -> None:
    """Requirement 1.6 and task 1.2: a relative root is excluded with ENTRY_ROOT_INVALID."""
    good = _make_repo(tmp_path, "good")
    loaded = _load_document(tmp_path, _document(_entry("good", good), _entry("rel", relative)))

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_ROOT_INVALID, 1)]


# Requirement 1.3 and 1.6: a root that does not exist is excluded at startup.
def test_missing_root_is_excluded(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: an absolute root that does not exist is excluded."""
    good = _make_repo(tmp_path, "good")
    missing = tmp_path / "does-not-exist"
    loaded = _load_document(tmp_path, _document(_entry("good", good), _entry("missing", missing)))

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_ROOT_INVALID, 1)]


# Requirement 1.6: a root that is a file, not a directory, is excluded.
def test_root_that_is_a_file_is_excluded(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a root path that names a file is excluded."""
    good = _make_repo(tmp_path, "good")
    file_root = tmp_path / "plain-file"
    file_root.write_text("not a directory", encoding="utf-8")
    loaded = _load_document(tmp_path, _document(_entry("good", good), _entry("file", file_root)))

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_ROOT_INVALID, 1)]


# Requirement 1.6: a directory without a .git entry is not a Git work tree and is excluded.
def test_root_without_git_entry_is_excluded(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a directory with no .git entry is excluded."""
    good = _make_repo(tmp_path, "good")
    plain = tmp_path / "plain-dir"
    plain.mkdir()
    loaded = _load_document(tmp_path, _document(_entry("good", good), _entry("plain", plain)))

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_ROOT_INVALID, 1)]


# Requirement 1.1 and 1.7: problem details carry no paths and no input values.
def test_problem_details_contain_no_root_or_input_values(tmp_path: Path) -> None:
    """Requirement 1.1 and 1.7 and task 1.2: no problem.detail contains a root path or an input value."""
    good = _make_repo(tmp_path, "good")
    missing_root = tmp_path / "SECRETDIR-missing"
    document = _document(
        _entry("good", good),
        _entry("SECRETID!", good),
        _entry("missing", missing_root),
        _entry("relative", "SECRETREL\\repo"),
        _entry("token-holder", good, github={"owner": "owner", "name": "name", "token": "SECRETTOKEN-123"}),
        _entry("extra", good, note="SECRETVALUE"),
    )

    loaded = _load_document(tmp_path, document)

    assert len(loaded.problems) == 5
    forbidden = [str(missing_root), str(good), "SECRETDIR", "SECRETID", "SECRETREL", "SECRETTOKEN", "SECRETVALUE"]
    for problem in loaded.problems:
        for value in forbidden:
            assert value not in problem.detail, f"{value!r} leaked in detail {problem.detail!r}"


# Requirement 1.1 and 1.7: file-level problem details carry no input values either.
def test_file_level_problem_details_contain_no_input_values(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: file-level problem details do not echo the offending value."""
    document = {"schema_version": "SECRETVERSION", "repositories": []}

    loaded = _load_document(tmp_path, document)

    assert _codes(loaded) == [PROBLEM_UNSUPPORTED_VERSION]
    assert "SECRETVERSION" not in loaded.problems[0].detail


# Requirement 1.3 and 1.6: resolve_repository returns the absolute resolved root.
def test_resolve_repository_returns_resolved_absolute_root(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: the returned root is absolute and resolved, not the raw text."""
    repo = _make_repo(tmp_path, "alpha")
    indirect = str(repo / ".." / "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", indirect)))

    resolved = resolve_repository(loaded, "alpha")

    assert resolved.repository_id == "alpha"
    assert resolved.root.is_absolute()
    assert resolved.root == repo.resolve()
    assert resolved.github is None


# Requirement 1.6: a symbolic link to a root resolves to its target.
def test_symlinked_root_resolves_to_target(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a symlink root is resolved to the real directory it names."""
    repo = _make_repo(tmp_path, "real")
    link = tmp_path / "link"
    try:
        os.symlink(repo, link, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("creating a symbolic link needs privilege on this machine")
    loaded = _load_document(tmp_path, _document(_entry("linked", link)))

    resolved = resolve_repository(loaded, "linked")

    assert resolved.root == repo.resolve()


# Requirement 1.3: an unregistered repository_id gives REPOSITORY_NOT_FOUND.
def test_unknown_repository_id_raises_not_found(tmp_path: Path) -> None:
    """Requirement 1.3 and task 1.2: an unregistered repository_id raises REPOSITORY_NOT_FOUND."""
    loaded = _load_document(tmp_path, _document(_entry("alpha", _make_repo(tmp_path, "alpha"))))

    with pytest.raises(RepositoryError) as caught:
        resolve_repository(loaded, "unknown")

    assert caught.value.code == REPOSITORY_NOT_FOUND == "REPOSITORY_NOT_FOUND"


# Requirement 1.3: a repository excluded at startup is not registered, so it is not found.
def test_excluded_entry_is_reported_as_not_found(tmp_path: Path) -> None:
    """Requirement 1.3 and task 1.2: an entry excluded at startup resolves as REPOSITORY_NOT_FOUND."""
    loaded = _load_document(tmp_path, _document(_entry("gone", tmp_path / "missing")))

    with pytest.raises(RepositoryError) as caught:
        resolve_repository(loaded, "gone")

    assert caught.value.code == REPOSITORY_NOT_FOUND


# Requirement 1.3 and 1.6: a root deleted after startup is reported as unavailable on each call.
def test_root_deleted_after_load_raises_unavailable_each_call(tmp_path: Path) -> None:
    """Requirement 1.3 and 1.6 and task 1.2: a root removed after load gives REPOSITORY_UNAVAILABLE every time."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo)))
    shutil.rmtree(repo)

    for _ in range(2):
        with pytest.raises(RepositoryError) as caught:
            resolve_repository(loaded, "alpha")
        assert caught.value.code == REPOSITORY_UNAVAILABLE == "REPOSITORY_UNAVAILABLE"

    assert "alpha" in loaded.entries, "the registry keeps the entry; only the call fails"


# Requirement 1.3 and 1.6: a root that is restored resolves again, because it is checked per call.
def test_root_restored_after_unavailable_resolves_again(tmp_path: Path) -> None:
    """Requirement 1.3 and 1.6 and task 1.2: a restored root is accepted on the next call."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo)))
    shutil.rmtree(repo)
    with pytest.raises(RepositoryError) as caught:
        resolve_repository(loaded, "alpha")
    assert caught.value.code == REPOSITORY_UNAVAILABLE

    (repo / ".git").mkdir(parents=True)

    resolved = resolve_repository(loaded, "alpha")
    assert resolved.root == repo.resolve()


# Requirement 1.4: resolution takes only a repository_id, never a path.
def test_resolve_functions_take_registry_and_repository_id_only() -> None:
    """Requirement 1.4 and task 1.2: resolve_repository accepts (registry, repository_id) and nothing else."""
    assert list(inspect.signature(resolve_repository).parameters) == ["registry", "repository_id"]
    assert list(inspect.signature(resolve_github_identity).parameters) == ["registry", "repository_id"]


# Requirement 1.3 and 1.7: a missing github object gives GITHUB_IDENTITY_UNRESOLVED.
def test_github_absent_raises_unresolved_even_with_other_owner_remote(tmp_path: Path) -> None:
    """Requirement 1.3, 1.7 and task 1.3: with no github object, a Git remote naming another owner is ignored."""
    repo = _make_repo(tmp_path, "alpha")
    (repo / ".git" / "config").write_text(
        '[remote "origin"]\n\turl = https://github.com/other-owner/other-repo.git\n',
        encoding="utf-8",
    )
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo)))

    assert resolve_repository(loaded, "alpha").github is None
    with pytest.raises(RepositoryError) as caught:
        resolve_github_identity(loaded, "alpha")

    assert caught.value.code == GITHUB_IDENTITY_UNRESOLVED == "GITHUB_IDENTITY_UNRESOLVED"


# Requirement 1.7 and task 1.3: an explicit github object is returned exactly, with case preserved.
def test_explicit_github_identity_is_returned_exactly(tmp_path: Path) -> None:
    """Requirement 1.7 and task 1.3: the owner and name from the entry are returned unchanged."""
    repo = _make_repo(tmp_path, "django")
    loaded = _load_document(
        tmp_path,
        _document(_entry("django", repo, github={"owner": "Django", "name": "django"})),
    )

    identity = resolve_github_identity(loaded, "django")

    assert identity == GitHubIdentity(owner="Django", name="django")
    assert identity.owner == "Django"
    assert identity.name == "django"


# Requirement 1.7 and task 1.3: an unknown key inside the github object rejects that entry.
def test_github_object_with_extra_key_is_rejected(tmp_path: Path) -> None:
    """Requirement 1.7 and task 1.3: a github object with an extra key excludes the whole entry."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(
        tmp_path,
        _document(_entry("alpha", repo, github={"owner": "o", "name": "n", "branch": "main"})),
    )

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]
    with pytest.raises(RepositoryError) as caught:
        resolve_github_identity(loaded, "alpha")
    assert caught.value.code == REPOSITORY_NOT_FOUND


# Requirement 1.7 and task 1.3: dot segments are not a valid GitHub name.
@pytest.mark.parametrize("name", [".", ".."], ids=["single-dot", "double-dot"])
def test_github_name_dot_segment_is_rejected(tmp_path: Path, name: str) -> None:
    """Requirement 1.7 and task 1.3: a github name of '.' or '..' excludes the entry."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(
        tmp_path,
        _document(_entry("alpha", repo, github={"owner": "owner", "name": name})),
    )

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]


# Requirement 1.7 and task 1.3: owner and name must match the GitHub character rules.
@pytest.mark.parametrize(
    "github",
    [
        {"owner": "-leading", "name": "repo"},
        {"owner": "owner", "name": "a/b"},
        {"owner": "", "name": "repo"},
        {"owner": "owner"},
    ],
    ids=["owner-leading-hyphen", "name-with-slash", "owner-empty", "name-missing"],
)
def test_github_identity_with_invalid_fields_is_rejected(tmp_path: Path, github: dict[str, str]) -> None:
    """Requirement 1.7 and task 1.3: an invalid or incomplete github object excludes the entry."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, github=github)))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]


# Requirement 1.1 and 1.6: load never writes the registry file, for a valid or an invalid file.
@pytest.mark.parametrize("valid", [True, False], ids=["valid-file", "invalid-json-file"])
def test_load_never_writes_registry_file(tmp_path: Path, valid: bool) -> None:
    """Requirement 1.5 and task 1.2: load leaves the registry file's bytes and modification time unchanged."""
    path = _registry_file(tmp_path)
    if valid:
        _write_json(path, _document(_entry("alpha", _make_repo(tmp_path, "alpha"))))
    else:
        _write_text(path, "{not valid json")
    fixed_time_ns = 1_600_000_000_000_000_000
    os.utime(path, ns=(fixed_time_ns, fixed_time_ns))
    bytes_before = path.read_bytes()
    mtime_before = path.stat().st_mtime_ns

    load_registry(path)

    assert path.read_bytes() == bytes_before
    assert path.stat().st_mtime_ns == mtime_before


# Requirement 1.1 (review regression): deeply nested JSON within the size limit must not crash startup.
def test_deeply_nested_json_reports_invalid_json_without_raising(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: nesting that exceeds the parser depth gives REGISTRY_INVALID_JSON."""
    path = _registry_file(tmp_path)
    nested = "[" * 120_000 + "]" * 120_000
    assert len(nested) < MAX_REGISTRY_BYTES, "the payload must pass the size check so the parser is reached"
    _write_text(path, nested)

    loaded = load_registry(path)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_JSON]


# Requirement 1.6 (review regression): a root with an embedded NUL character is never a usable root.
def test_nul_character_in_root_is_excluded_at_startup(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a root containing NUL is excluded with ENTRY_ROOT_INVALID, without raising."""
    good = _make_repo(tmp_path, "good")
    loaded = _load_document(
        tmp_path,
        _document(_entry("good", good), _entry("nul", str(good) + "\x00tail")),
    )

    assert set(loaded.entries) == {"good"}
    assert [(p.code, p.entry_index) for p in loaded.problems] == [(PROBLEM_ROOT_INVALID, 1)]


# Requirement 1.6 (review regression): a NUL root that appears after startup gives REPOSITORY_UNAVAILABLE.
def test_nul_root_at_call_time_raises_unavailable(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a registered root that cannot be resolved at call time is UNAVAILABLE."""
    repo = _make_repo(tmp_path, "alpha")
    registry = LoadedRegistry(
        entries={"alpha": RegistryEntry(repository_id="alpha", root=str(repo) + "\x00")},
        problems=(),
    )

    with pytest.raises(RepositoryError) as caught:
        resolve_repository(registry, "alpha")

    assert caught.value.code == REPOSITORY_UNAVAILABLE


# Requirement 1.6: a .git file (linked worktree or submodule) is a valid Git entry.
def test_root_with_git_file_is_accepted(tmp_path: Path) -> None:
    """Requirement 1.6 and task 1.2: a root whose .git is a file is accepted."""
    root = tmp_path / "worktree"
    root.mkdir()
    (root / ".git").write_text("gitdir: ../main/.git/worktrees/worktree\n", encoding="utf-8")

    loaded = _load_document(tmp_path, _document(_entry("worktree", root)))

    assert loaded.problems == ()
    assert resolve_repository(loaded, "worktree").root == root.resolve()


# Requirement 1.7: an explicit null github value means no GitHub mapping.
def test_github_null_means_no_github_identity(tmp_path: Path) -> None:
    """Requirement 1.7 and task 1.3: github set to null is accepted and resolves as unresolved identity."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, github=None)))

    assert loaded.problems == ()
    assert resolve_repository(loaded, "alpha").github is None
    with pytest.raises(RepositoryError) as caught:
        resolve_github_identity(loaded, "alpha")
    assert caught.value.code == GITHUB_IDENTITY_UNRESOLVED


# Requirement 1.1: bytes that are not UTF-8 give REGISTRY_UNREADABLE.
def test_non_utf8_registry_bytes_report_unreadable(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.2: a registry file that is not UTF-8 registers nothing."""
    path = _registry_file(tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'{"schema_version": 1, "repositories": [], "x": "\xff\xfe"}')

    loaded = load_registry(path)

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_UNREADABLE]


# Requirement 1.1: a UTF-8 byte order mark, common in files saved by Windows editors, is accepted.
def test_utf8_byte_order_mark_is_accepted(tmp_path: Path) -> None:
    """Requirement 1.1 and task 1.1: a file that starts with a UTF-8 BOM loads normally."""
    root = _make_repo(tmp_path, "alpha")
    path = _registry_file(tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\xef\xbb\xbf" + json.dumps(_document(_entry("alpha", root))).encode("utf-8"))

    loaded = load_registry(path)

    assert loaded.problems == ()
    assert set(loaded.entries) == {"alpha"}


# Requirement 1.5: a missing registry file is not created by loading it.
def test_missing_file_load_does_not_create_directory(tmp_path: Path) -> None:
    """Requirement 1.5 and task 1.2: loading a missing registry creates neither the file nor its folder."""
    path = _registry_file(tmp_path)

    load_registry(path)

    assert not path.parent.exists()


# Requirement 1.4: a path passed where a repository_id is expected is not a registered repository.
@pytest.mark.parametrize(
    "value",
    ["C:\\Users\\User\\repo", "..\\..\\etc", "/tmp/repo", ["alpha"], {"id": "alpha"}],
    ids=["drive-path", "traversal", "posix-path", "list", "dict"],
)
def test_non_identifier_input_is_not_found(tmp_path: Path, value: Any) -> None:
    """Requirement 1.4 and task 1.2: a path or a non-string value never resolves; it gives REPOSITORY_NOT_FOUND."""
    loaded = _load_document(tmp_path, _document(_entry("alpha", _make_repo(tmp_path, "alpha"))))

    with pytest.raises(RepositoryError) as caught:
        resolve_repository(loaded, value)

    assert caught.value.code == REPOSITORY_NOT_FOUND


# Requirement 1.7: GitHub owner rules allow single hyphens only, with no leading or trailing hyphen.
@pytest.mark.parametrize("owner", ["a-", "-a", "a--b", "a" * 40], ids=["trailing", "leading", "double", "too-long"])
def test_github_owner_outside_github_rules_is_rejected(tmp_path: Path, owner: str) -> None:
    """Requirement 1.7 and task 1.3: owners that GitHub cannot issue exclude the entry."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, github={"owner": owner, "name": "repo"})))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]


@pytest.mark.parametrize("owner", ["a-b", "a" * 39], ids=["single-hyphen", "maximum-length"])
def test_github_owner_within_github_rules_is_accepted(tmp_path: Path, owner: str) -> None:
    """Requirement 1.7 and task 1.3: valid owner names are accepted."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, github={"owner": owner, "name": "repo"})))

    assert loaded.problems == ()
    assert resolve_github_identity(loaded, "alpha").owner == owner


# Requirement 1.1 and 1.7: a trailing newline is not part of any identifier.
@pytest.mark.parametrize(
    "github",
    [{"owner": "owner\n", "name": "repo"}, {"owner": "owner", "name": "repo\n"}],
    ids=["owner-newline", "name-newline"],
)
def test_github_fields_with_trailing_newline_are_rejected(tmp_path: Path, github: dict[str, str]) -> None:
    """Requirement 1.7 and task 1.3: a trailing newline in owner or name excludes the entry."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, github=github)))

    assert loaded.entries == {}
    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]


# Requirement 1.1 and 1.7: an unknown key's name is not echoed in problem details.
def test_unknown_key_name_is_not_echoed_in_problem_detail(tmp_path: Path) -> None:
    """Requirement 1.1 and 1.7 and task 1.2: the caller-supplied key name is absent from problem.detail."""
    repo = _make_repo(tmp_path, "alpha")
    loaded = _load_document(tmp_path, _document(_entry("alpha", repo, MARKERKEY123="x")))

    assert _codes(loaded) == [PROBLEM_INVALID_ENTRY]
    assert "MARKERKEY123" not in loaded.problems[0].detail
    assert loaded.problems[0].detail == "unknown field"
