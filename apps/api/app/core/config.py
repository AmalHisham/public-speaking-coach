from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import URL

APP_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = APP_DIR / ".env"


class Settings(BaseSettings):
    database_host: str
    database_port: int = 5432
    database_name: str
    database_user: str
    database_password: SecretStr
    transcription_max_upload_bytes: int = 25 * 1024 * 1024
    database_query: dict[str, str] = Field(default_factory=dict)
    clerk_secret_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    clerk_authorized_parties: Annotated[tuple[str, ...], NoDecode] = ()
    cors_allowed_origins: Annotated[tuple[str, ...], NoDecode] = ()

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    @field_validator("clerk_authorized_parties", "cors_allowed_origins", mode="before")
    @classmethod
    def split_csv_values(cls, value: Any) -> Any:
        if value is None or value == "":
            return ()

        if isinstance(value, str):
            return tuple(item.strip() for item in value.split(",") if item.strip())

        return value

    @property
    def database_url(self) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.database_user,
            password=self.database_password.get_secret_value(),
            host=self.database_host,
            port=self.database_port,
            database=self.database_name,
            query=self.database_query,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
