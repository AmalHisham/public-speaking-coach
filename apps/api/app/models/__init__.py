"""Database models for the backend."""

from collections.abc import Sequence
from importlib import import_module
from pkgutil import walk_packages

from app.db.base import Base


def import_model_modules(
    package_name: str = __name__,
    package_paths: Sequence[str] | None = None,
) -> tuple[str, ...]:
    """Import all model modules so SQLAlchemy metadata is fully registered."""

    module_paths = tuple(package_paths or __path__)
    imported_modules: list[str] = []

    for module_info in walk_packages(module_paths, prefix=f"{package_name}."):
        import_module(module_info.name)
        imported_modules.append(module_info.name)

    return tuple(imported_modules)


import_model_modules()

__all__ = ["Base", "import_model_modules"]
