from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import get_db_session
from app.main import app
from app.schemas.health import DatabaseHealthStatus, HealthCheckResponse
from app.services.health_service import HealthService, get_health_service


class HealthyRepository:
    def is_database_available(self, db_session: object) -> bool:
        return True


class UnhealthyRepository:
    def is_database_available(self, db_session: object) -> bool:
        raise SQLAlchemyError("database unavailable")


class StubHealthService:
    def get_health_status(self, db_session: object) -> HealthCheckResponse:
        return HealthCheckResponse(
            status="ok",
            database=DatabaseHealthStatus(status="ok"),
        )


class DegradedStubHealthService:
    def get_health_status(self, db_session: object) -> HealthCheckResponse:
        return HealthCheckResponse(
            status="degraded",
            database=DatabaseHealthStatus(status="unavailable"),
        )


def test_health_service_returns_ok_when_database_ping_succeeds() -> None:
    service = HealthService(HealthyRepository())

    response = service.get_health_status(object())

    assert response == HealthCheckResponse(
        status="ok",
        database=DatabaseHealthStatus(status="ok"),
    )


def test_health_service_returns_degraded_when_database_ping_fails() -> None:
    service = HealthService(UnhealthyRepository())

    response = service.get_health_status(object())

    assert response == HealthCheckResponse(
        status="degraded",
        database=DatabaseHealthStatus(status="unavailable"),
    )


def test_health_route_uses_service_dependency() -> None:
    def override_db_session() -> object:
        return object()

    def override_health_service() -> StubHealthService:
        return StubHealthService()

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_health_service] = override_health_service

    try:
        client = TestClient(app)

        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "database": {"status": "ok"},
        }
    finally:
        app.dependency_overrides.clear()


def test_health_route_returns_503_when_database_is_unavailable() -> None:
    def override_db_session() -> object:
        return object()

    def override_health_service() -> DegradedStubHealthService:
        return DegradedStubHealthService()

    app.dependency_overrides[get_db_session] = override_db_session
    app.dependency_overrides[get_health_service] = override_health_service

    try:
        client = TestClient(app)

        response = client.get("/health")

        assert response.status_code == 503
        assert response.json() == {
            "status": "degraded",
            "database": {"status": "unavailable"},
        }
    finally:
        app.dependency_overrides.clear()
