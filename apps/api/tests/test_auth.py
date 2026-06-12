import pytest
from clerk_backend_api.security.types import AuthStatus, RequestState
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.schemas.auth import SessionValidationResponse
from app.services.auth_service import AuthService, get_auth_service


class SignedInAuthenticator:
    def authenticate_request(self, request, options):  # noqa: ANN001
        assert request.headers["authorization"] == "Bearer valid-token"
        assert options.authorized_parties == ["http://localhost:3000"]
        assert options.accepts_token == ["session_token"]

        return RequestState(
            status=AuthStatus.SIGNED_IN,
            payload={
                "sid": "sess_123",
                "sub": "user_123",
            },
        )


class SignedOutAuthenticator:
    def authenticate_request(self, request, options):  # noqa: ANN001, ARG002
        return RequestState(status=AuthStatus.SIGNED_OUT)


class StubAuthService:
    def validate_session(self, request: Request) -> SessionValidationResponse:  # noqa: ARG002
        return SessionValidationResponse(
            status="authenticated",
            user_id="user_123",
            session_id="sess_123",
        )


def test_auth_service_returns_session_details_for_valid_clerk_token() -> None:
    service = AuthService(
        authenticator=SignedInAuthenticator(),
        authorized_parties=("http://localhost:3000",),
    )
    request = Request(
        {
            "headers": [(b"authorization", b"Bearer valid-token")],
            "method": "GET",
            "path": "/auth/session",
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "type": "http",
        }
    )

    response = service.validate_session(request)

    assert response == SessionValidationResponse(
        status="authenticated",
        user_id="user_123",
        session_id="sess_123",
    )


def test_auth_service_rejects_invalid_clerk_token() -> None:
    service = AuthService(
        authenticator=SignedOutAuthenticator(),
        authorized_parties=("http://localhost:3000",),
    )
    request = Request(
        {
            "headers": [(b"authorization", b"Bearer invalid-token")],
            "method": "GET",
            "path": "/auth/session",
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "type": "http",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        service.validate_session(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Invalid or missing Clerk session."


def test_auth_service_rejects_requests_without_bearer_authorization() -> None:
    service = AuthService(
        authenticator=SignedInAuthenticator(),
        authorized_parties=("http://localhost:3000",),
    )
    request = Request(
        {
            "headers": [(b"cookie", b"__session=cookie-token")],
            "method": "GET",
            "path": "/auth/session",
            "query_string": b"",
            "scheme": "http",
            "server": ("testserver", 80),
            "type": "http",
        }
    )

    with pytest.raises(HTTPException) as exc_info:
        service.validate_session(request)

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Authorization bearer session token is required."


def test_auth_route_uses_service_dependency() -> None:
    def override_auth_service() -> StubAuthService:
        return StubAuthService()

    app.dependency_overrides[get_auth_service] = override_auth_service

    try:
        client = TestClient(app)

        response = client.get("/auth/session")

        assert response.status_code == 200
        assert response.json() == {
            "status": "authenticated",
            "user_id": "user_123",
            "session_id": "sess_123",
        }
    finally:
        app.dependency_overrides.clear()
