"""Shared local data location (Architecture section 8, owner decision E-D1).

Local data lives outside the repository, under %LOCALAPPDATA%\\Sean\\.
"""

from __future__ import annotations

import os
from pathlib import Path

DATA_DIRECTORY_NAME = "Sean"


def local_data_dir() -> Path | None:
    """Return %LOCALAPPDATA%\\Sean, or None when LOCALAPPDATA is unset or empty.

    The path is built only. No directory is created and nothing is read.
    """
    local_app_data = os.environ.get("LOCALAPPDATA")
    if not local_app_data:
        return None
    return Path(local_app_data, DATA_DIRECTORY_NAME)
