from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.schemas.health import HealthCheckResponse
from app.services.health_service import HealthService, get_health_service


router = APIRouter()


@router.get("/health")
def health_check(
    response: Response,
    db_session: Annotated[Session, Depends(get_db_session)],
    health_service: Annotated[HealthService, Depends(get_health_service)],
) -> HealthCheckResponse:
    health_status = health_service.get_health_status(db_session)

    if health_status.status == "degraded":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health_status
