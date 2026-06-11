from configparser import ConfigParser
from pathlib import Path
from types import SimpleNamespace

from app.core.config import Settings
from app.db.base import Base
from app.db.models import target_metadata
from app import models as models_package


def test_alembic_uses_shared_sqlalchemy_metadata() -> None:
    assert target_metadata is Base.metadata


def test_alembic_database_url_uses_existing_settings_shape() -> None:
    settings = Settings(
        database_host="ep-example-123456.us-east-1.aws.neon.tech",
        database_port=5432,
        database_name="neondb",
        database_user="neon_user",
        database_password="neon_password",
        database_query={
            "sslmode": "require",
            "channel_binding": "require",
        },
    )

    assert settings.database_url.render_as_string(hide_password=False) == (
        "postgresql+psycopg://neon_user:neon_password"
        "@ep-example-123456.us-east-1.aws.neon.tech:5432/neondb"
        "?channel_binding=require&sslmode=require"
    )


def test_alembic_ini_points_to_local_migration_script_directory() -> None:
    config = ConfigParser()
    config.read(Path("alembic.ini"), encoding="utf-8")

    assert config["alembic"]["script_location"] == "alembic"
    assert config["alembic"]["prepend_sys_path"] == "."


def test_import_model_modules_discovers_nested_future_model_modules(
    monkeypatch,
) -> None:
    discovered_modules = [
        SimpleNamespace(name="future_models.user"),
        SimpleNamespace(name="future_models.nested"),
        SimpleNamespace(name="future_models.nested.session"),
    ]
    imported_module_names: list[str] = []

    def fake_walk_packages(package_paths, prefix):  # noqa: ANN001
        assert tuple(package_paths) == ("future_models_path",)
        assert prefix == "future_models."
        return iter(discovered_modules)

    def fake_import_module(module_name: str) -> None:
        imported_module_names.append(module_name)

    monkeypatch.setattr(models_package, "walk_packages", fake_walk_packages)
    monkeypatch.setattr(models_package, "import_module", fake_import_module)

    imported_modules = models_package.import_model_modules(
        package_name="future_models",
        package_paths=["future_models_path"],
    )

    assert imported_modules == tuple(
        module_info.name for module_info in discovered_modules
    )
    assert imported_module_names == list(imported_modules)
