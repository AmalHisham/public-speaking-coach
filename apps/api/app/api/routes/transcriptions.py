from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.schemas.transcription import TranscriptionResponse
from app.services.auth_service import AuthService, get_auth_service
from app.services.transcription_service import (
    TranscriptionConfigurationError,
    TranscriptionService,
    TranscriptionServiceError,
    TranscriptionValidationError,
    get_transcription_service,
)


router = APIRouter()


def get_transcription_route_service() -> TranscriptionService:
    try:
        return get_transcription_service()
    except TranscriptionConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error


@router.post("/transcriptions")
async def create_transcription(
    request: Request,
    audio: Annotated[UploadFile, File(...)],
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
    transcription_service: Annotated[
        TranscriptionService, Depends(get_transcription_route_service)
    ],
) -> TranscriptionResponse:
    auth_service.validate_session(request)

    try:
        return transcription_service.transcribe_upload(
            audio_bytes=await audio.read(),
            content_type=audio.content_type,
            filename=audio.filename,
        )
    except TranscriptionValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except TranscriptionServiceError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error
