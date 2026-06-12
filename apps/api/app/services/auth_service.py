from functools import lru_cache
from typing import Protocol

import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.security.types import (
    AuthStatus,
    AuthenticateRequestOptions,
    RequestState,
)
from fastapi import HTTPException, Request, status

from app.core.config import Settings, get_settings
from app.schemas.auth import SessionValidationResponse


class RequestAuthenticator(Protocol):
    def authenticate_request(
        self,
        request: httpx.Request,
        options: AuthenticateRequestOptions,
    ) -> RequestState: ...


class AuthService:
    def __init__(
        self,
        authenticator: RequestAuthenticator,
        authorized_parties: tuple[str, ...],
    ) -> None:
        self._authenticator = authenticator
        self._authorized_parties = authorized_parties

    def validate_session(self, request: Request) -> SessionValidationResponse:
        authorization_header = request.headers.get("authorization")

        if not self._has_bearer_authorization(authorization_header):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization bearer session token is required.",
            )

        request_state = self._authenticator.authenticate_request(
            self._build_clerk_request(request, authorization_header),
            AuthenticateRequestOptions(
                accepts_token=["session_token"],
                authorized_parties=list(self._authorized_parties),
            ),
        )

        if request_state.status is not AuthStatus.SIGNED_IN:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing Clerk session.",
            )

        payload = request_state.payload or {}
        user_id = payload.get("sub")
        session_id = payload.get("sid")

        if not isinstance(user_id, str) or not isinstance(session_id, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Clerk session payload is incomplete.",
            )

        return SessionValidationResponse(
            status="authenticated",
            user_id=user_id,
            session_id=session_id,
        )

    @staticmethod
    def _build_clerk_request(
        request: Request,
        authorization_header: str,
    ) -> httpx.Request:
        return httpx.Request(
            method=request.method,
            url=str(request.url),
            headers={"Authorization": authorization_header},
        )

    @staticmethod
    def _has_bearer_authorization(authorization_header: str | None) -> bool:
        return (
            authorization_header is not None
            and authorization_header.startswith("Bearer ")
            and len(authorization_header) > len("Bearer ")
        )


@lru_cache
def get_auth_service() -> AuthService:
    settings = get_settings()
    secret_key = _get_clerk_secret_key(settings)
    clerk_client = Clerk(bearer_auth=secret_key)

    return AuthService(
        authenticator=clerk_client,
        authorized_parties=settings.clerk_authorized_parties,
    )


def _get_clerk_secret_key(settings: Settings) -> str:
    if settings.clerk_secret_key is None:
        raise RuntimeError("CLERK_SECRET_KEY must be configured for auth routes.")

    return settings.clerk_secret_key.get_secret_value()
