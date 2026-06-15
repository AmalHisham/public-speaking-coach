from pathlib import Path

from app.core.config import ENV_FILE, Settings


def test_database_url_builds_with_sqlalchemy_url_encoding() -> None:
    settings = Settings(
        database_host="db.example.com",
        database_port=5432,
        database_name="public_speaking_coach",
        database_user="coach_user",
        database_password="pa@ss:word",
        database_query={"sslmode": "require"},
    )

    url = settings.database_url

    assert url.render_as_string(hide_password=False) == (
        "postgresql+psycopg://coach_user:pa%40ss%3Aword"
        "@db.example.com:5432/public_speaking_coach?sslmode=require"
    )


def test_settings_reads_nested_query_parameters_from_environment(
    monkeypatch,
) -> None:
    monkeypatch.setenv("DATABASE_HOST", "ep-example-123456.us-east-1.aws.neon.tech")
    monkeypatch.setenv("DATABASE_PORT", "5432")
    monkeypatch.setenv("DATABASE_NAME", "neondb")
    monkeypatch.setenv("DATABASE_USER", "neon_user")
    monkeypatch.setenv("DATABASE_PASSWORD", "neon_password")
    monkeypatch.setenv("DATABASE_QUERY__sslmode", "require")
    monkeypatch.setenv("DATABASE_QUERY__channel_binding", "require")

    settings = Settings()

    assert settings.database_query == {
        "sslmode": "require",
        "channel_binding": "require",
    }


def test_settings_reads_csv_auth_configuration_from_environment(
    monkeypatch,
) -> None:
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_PORT", "5432")
    monkeypatch.setenv("DATABASE_NAME", "public_speaking_coach")
    monkeypatch.setenv("DATABASE_USER", "postgres")
    monkeypatch.setenv("DATABASE_PASSWORD", "postgres")
    monkeypatch.setenv(
        "CLERK_AUTHORIZED_PARTIES",
        "http://localhost:3000, https://coach.example.com",
    )
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000, https://coach.example.com",
    )

    settings = Settings()

    assert settings.clerk_authorized_parties == (
        "http://localhost:3000",
        "https://coach.example.com",
    )
    assert settings.cors_allowed_origins == (
        "http://localhost:3000",
        "https://coach.example.com",
    )


def test_settings_reads_openai_api_key_from_environment(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_PORT", "5432")
    monkeypatch.setenv("DATABASE_NAME", "public_speaking_coach")
    monkeypatch.setenv("DATABASE_USER", "postgres")
    monkeypatch.setenv("DATABASE_PASSWORD", "postgres")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-value")
    monkeypatch.setenv("TRANSCRIPTION_MAX_UPLOAD_BYTES", "1048576")

    settings = Settings()

    assert settings.openai_api_key is not None
    assert settings.openai_api_key.get_secret_value() == "sk-test-value"
    assert settings.transcription_max_upload_bytes == 1_048_576


def test_settings_treats_blank_optional_secrets_as_unset(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_HOST", "localhost")
    monkeypatch.setenv("DATABASE_PORT", "5432")
    monkeypatch.setenv("DATABASE_NAME", "public_speaking_coach")
    monkeypatch.setenv("DATABASE_USER", "postgres")
    monkeypatch.setenv("DATABASE_PASSWORD", "postgres")
    monkeypatch.setenv("CLERK_SECRET_KEY", "   ")
    monkeypatch.setenv("OPENAI_API_KEY", "   ")

    settings = Settings()

    assert settings.clerk_secret_key is None
    assert settings.openai_api_key is None


def test_settings_accepts_openai_api_key_in_direct_configuration() -> None:
    settings = Settings(
        database_host="localhost",
        database_port=5432,
        database_name="public_speaking_coach",
        database_user="postgres",
        database_password="postgres",
        openai_api_key="sk-configured",
        transcription_max_upload_bytes=2_048,
    )

    assert settings.openai_api_key is not None
    assert settings.openai_api_key.get_secret_value() == "sk-configured"
    assert settings.transcription_max_upload_bytes == 2_048


def test_settings_env_file_is_resolved_from_app_directory() -> None:
    assert ENV_FILE.is_absolute()
    assert ENV_FILE == Path(__file__).resolve().parents[1] / ".env"
    assert Settings.model_config["env_file"] == str(ENV_FILE)
