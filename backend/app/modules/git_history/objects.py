"""Read-only object lookups shared by history, blame, and symbol resolution."""

from __future__ import annotations

from pathlib import Path

from app.core.git_runner import run_git


def blob_at_revision(repo_root: Path, revision: str, path: str) -> bytes | None:
    """Return the content of a regular file at a revision, or None when the path is not a file there.

    The path must already be normalized (C.3a). The listing uses -z, so names are not quoted and compare exactly.
    """
    listing = run_git(repo_root, "ls-tree", options=["-z"], revisions=[revision], paths=[path])
    for entry in listing.split(b"\0"):
        if not entry:
            continue
        header, _, entry_path = entry.partition(b"\t")
        if entry_path.decode("utf-8") != path:
            continue
        fields = header.split()
        if len(fields) != 3 or fields[1] != b"blob":
            return None
        return run_git(repo_root, "cat-file", options=["blob"], revisions=[fields[2].decode("ascii")])
    return None
