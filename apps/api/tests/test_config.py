from app.core.config import Settings


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
