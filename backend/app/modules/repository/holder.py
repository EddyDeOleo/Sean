"""A thread-safe holder for the live registry (Spec 4 section 16).

Request handlers read `holder.current` on every request instead of keeping the registry they were built with. The
repository-management routes call `replace` after a successful registry write, so the next request sees the change without
a restart. `unavailable` lists entries that are valid in the file but whose folder cannot be used right now (for example a
moved repository). The loader leaves them out of `current.entries`, and the list route still shows them so the user can
edit or remove them.
"""

from __future__ import annotations

import threading

from app.modules.repository.registry import LoadedRegistry, RegistryEntry


class RegistryHolder:
    def __init__(self, registry: LoadedRegistry, unavailable: tuple[RegistryEntry, ...] = ()) -> None:
        self._lock = threading.Lock()
        self._registry = registry
        self._unavailable = unavailable

    @property
    def current(self) -> LoadedRegistry:
        with self._lock:
            return self._registry

    @property
    def unavailable(self) -> tuple[RegistryEntry, ...]:
        with self._lock:
            return self._unavailable

    def replace(self, registry: LoadedRegistry, unavailable: tuple[RegistryEntry, ...] = ()) -> None:
        with self._lock:
            self._registry = registry
            self._unavailable = unavailable
