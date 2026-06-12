from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas.auth import SessionValidationResponse
from app.services.auth_service import AuthService, get_auth_service


router = APIRouter()


@router.get("/session")
def validate_session(
    request: Request,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> SessionValidationResponse:
    return auth_service.validate_session(request)
