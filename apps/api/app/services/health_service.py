import logging
from typing import Protocol

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.repositories.health_repository import HealthRepository
from app.schemas.health import DatabaseHealthStatus, HealthCheckResponse


logger = logging.getLogger(__name__)


class HealthRepositoryProtocol(Protocol):
    def is_database_available(self, db_session: Session) -> bool:
        ...


class HealthService:
    def __init__(
        self,
        health_repository: HealthRepositoryProtocol | None = None,
    ) -> None:
        self.health_repository = health_repository or HealthRepository()

    def get_health_status(self, db_session: Session) -> HealthCheckResponse:
        try:
            is_database_available = self.health_repository.is_database_available(
                db_session
            )
        except SQLAlchemyError:
            logger.exception("Database health check failed.")
            is_database_available = False

        if is_database_available:
            return HealthCheckResponse(
                status="ok",
                database=DatabaseHealthStatus(status="ok"),
            )

        return HealthCheckResponse(
            status="degraded",
            database=DatabaseHealthStatus(status="unavailable"),
        )


def get_health_service() -> HealthService:
    return HealthService()
