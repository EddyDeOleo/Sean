"""Unit tests for app.core.git_objects (owner decision DEC-14 as updated for I2).

Accepted: a full lowercase SHA-1 name (40 hexadecimal characters) or a full lowercase SHA-256 name (64).
Rejected: abbreviated names, uppercase, non-hexadecimal characters, other lengths, and any trailing character.
"""

from __future__ import annotations

import pytest

from app.core.git_objects import SHA1_OBJECT_NAME_LENGTH, SHA256_OBJECT_NAME_LENGTH, is_full_object_name

SHA1 = "9e7cc2b628fe8fd3895986af9b7fc9525034c1b0"
SHA256 = "ab" * 32


def test_lengths_match_the_two_supported_object_formats() -> None:
    """DEC-14 (I2): SHA-1 names are 40 characters and SHA-256 names are 64."""
    assert SHA1_OBJECT_NAME_LENGTH == 40
    assert SHA256_OBJECT_NAME_LENGTH == 64


@pytest.mark.parametrize("name", [SHA1, SHA256, "0" * 40, "f" * 64], ids=["sha1", "sha256", "zeros", "fs"])
def test_full_lowercase_sha1_and_sha256_names_are_accepted(name: str) -> None:
    """DEC-14 (I2): both full object formats are accepted."""
    assert is_full_object_name(name)


@pytest.mark.parametrize(
    "name",
    [
        SHA1[:39],
        SHA1 + "0",
        SHA256[:63],
        SHA256 + "0",
        SHA1[:12],
        SHA1.upper(),
        SHA1[:-1] + "G",
        SHA1 + "\n",
        "\n" + SHA1,
        " " + SHA1,
        "HEAD",
        "",
        "a" * 41,
        "a" * 65,
        "g" * 40,
    ],
    ids=[
        "sha1-short", "sha1-long", "sha256-short", "sha256-long", "abbreviated", "uppercase",
        "non-hex", "trailing-newline", "leading-newline", "leading-space", "head", "empty",
        "forty-one", "sixty-five", "non-hex-forty",
    ],
)
def test_abbreviated_uppercase_non_hex_and_other_lengths_are_rejected(name: str) -> None:
    """DEC-14 (I2): only full, lowercase, hexadecimal names of 40 or 64 characters are accepted."""
    assert not is_full_object_name(name)


def test_uppercase_sha256_is_rejected_even_though_its_length_is_valid() -> None:
    """DEC-14 (I2): case is part of the canonical form, so an uppercase 64-character name is rejected."""
    assert not is_full_object_name("AB" * 32)
