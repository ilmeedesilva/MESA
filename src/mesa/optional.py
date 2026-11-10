"""Optional dependencies, imported only when a feature needs them.

The command line works with the core install (`pip install mesa-analyzer`).
The web API and the live AI explainer need extras; this gives a clear message
when one is missing instead of an ImportError.
"""

from __future__ import annotations

import importlib
from types import ModuleType

_EXTRA_FOR = {
    "anthropic": "ai",
    "fastapi": "api",
    "uvicorn": "api",
    "neo4j": "api",
    "psycopg": "api",
}


class MissingDependencyError(ImportError):
    """An optional package is not installed."""


def require(module: str) -> ModuleType:
    try:
        return importlib.import_module(module)
    except ImportError as error:
        extra = _EXTRA_FOR.get(module, "all")
        raise MissingDependencyError(
            f"This feature needs the '{module}' package. "
            f'Install it with: pip install "mesa-analyzer[{extra}]"'
        ) from error
