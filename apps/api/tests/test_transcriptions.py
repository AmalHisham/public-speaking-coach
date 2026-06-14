from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.api.routes import transcriptions as transcriptions_route_module
from app.schemas.auth import SessionValidationResponse
from app.schemas.transcription import TranscriptionResponse
from app.services.auth_service import get_auth_service
from app.api.routes.transcriptions import get_transcription_route_service
from app.services.transcription_service import (
    TranscriptionConfigurationError,
    TranscriptionServiceError,
    TranscriptionValidationError,
)


class StubAuthService:
    def validate_session(self, request: Request) -> SessionValidationResponse:  # noqa: ARG002
        return SessionValidationResponse(
            status="authenticated",
            user_id="user_123",
            session_id="sess_123",
        )


class SuccessfulTranscriptionService:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def transcribe_upload(
        self,
        *,
        audio_bytes: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> TranscriptionResponse:
        self.calls.append(
            {
                "audio_bytes": audio_bytes,
                "content_type": content_type,
                "filename": filename,
            }
        )
        return TranscriptionResponse(
            duration_seconds=8.2,
            language="en",
            model="whisper-1",
            segments=[
                {
                    "end": 1.0,
                    "id": 0,
                    "start": 0.0,
                    "text": "steady pacing",
                }
            ],
            text="steady pacing",
            words=[
                {
                    "end": 0.6,
                    "start": 0.0,
                    "word": "steady",
                }
            ],
        )


class ValidationFailingTranscriptionService:
    def transcribe_upload(
        self,
        *,
        audio_bytes: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> TranscriptionResponse:
        raise TranscriptionValidationError("Audio upload must not be empty.")


class UnavailableTranscriptionService:
    def transcribe_upload(
        self,
        *,
        audio_bytes: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> TranscriptionResponse:
        raise TranscriptionServiceError("Transcription could not be completed.")


def test_transcriptions_route_uses_service_dependencies() -> None:
    transcription_service = SuccessfulTranscriptionService()

    def override_auth_service() -> StubAuthService:
        return StubAuthService()

    def override_transcription_service() -> SuccessfulTranscriptionService:
        return transcription_service

    app.dependency_overrides[get_auth_service] = override_auth_service
    app.dependency_overrides[get_transcription_route_service] = (
        override_transcription_service
    )

    try:
        client = TestClient(app)

        response = client.post(
            "/transcriptions",
            files={
                "audio": (
                    "practice.webm",
                    b"audio-bytes",
                    "audio/webm",
                )
            },
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 200
        assert response.json() == {
            "duration_seconds": 8.2,
            "language": "en",
            "model": "whisper-1",
            "segments": [
                {
                    "end": 1.0,
                    "id": 0,
                    "start": 0.0,
                    "text": "steady pacing",
                }
            ],
            "text": "steady pacing",
            "words": [
                {
                    "end": 0.6,
                    "start": 0.0,
                    "word": "steady",
                }
            ],
        }
        assert transcription_service.calls == [
            {
                "audio_bytes": b"audio-bytes",
                "content_type": "audio/webm",
                "filename": "practice.webm",
            }
        ]
    finally:
        app.dependency_overrides.clear()


def test_transcriptions_route_returns_bad_request_for_invalid_uploads() -> None:
    def override_auth_service() -> StubAuthService:
        return StubAuthService()

    def override_transcription_service() -> ValidationFailingTranscriptionService:
        return ValidationFailingTranscriptionService()

    app.dependency_overrides[get_auth_service] = override_auth_service
    app.dependency_overrides[get_transcription_route_service] = (
        override_transcription_service
    )

    try:
        client = TestClient(app)

        response = client.post(
            "/transcriptions",
            files={
                "audio": (
                    "practice.webm",
                    b"",
                    "audio/webm",
                )
            },
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 400
        assert response.json() == {
            "detail": "Audio upload must not be empty.",
        }
    finally:
        app.dependency_overrides.clear()


def test_transcriptions_route_returns_bad_gateway_for_openai_failures() -> None:
    def override_auth_service() -> StubAuthService:
        return StubAuthService()

    def override_transcription_service() -> UnavailableTranscriptionService:
        return UnavailableTranscriptionService()

    app.dependency_overrides[get_auth_service] = override_auth_service
    app.dependency_overrides[get_transcription_route_service] = (
        override_transcription_service
    )

    try:
        client = TestClient(app)

        response = client.post(
            "/transcriptions",
            files={
                "audio": (
                    "practice.webm",
                    b"audio-bytes",
                    "audio/webm",
                )
            },
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 502
        assert response.json() == {
            "detail": "Transcription could not be completed.",
        }
    finally:
        app.dependency_overrides.clear()


def test_transcriptions_route_returns_service_unavailable_when_openai_key_is_missing(
    monkeypatch,
) -> None:
    def override_auth_service() -> StubAuthService:
        return StubAuthService()

    def fail_to_build_service() -> SuccessfulTranscriptionService:
        raise TranscriptionConfigurationError(
            "OPENAI_API_KEY must be configured for transcription routes."
        )

    app.dependency_overrides[get_auth_service] = override_auth_service
    monkeypatch.setattr(
        transcriptions_route_module,
        "get_transcription_service",
        fail_to_build_service,
    )

    try:
        client = TestClient(app)

        response = client.post(
            "/transcriptions",
            files={
                "audio": (
                    "practice.webm",
                    b"audio-bytes",
                    "audio/webm",
                )
            },
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 503
        assert response.json() == {
            "detail": "OPENAI_API_KEY must be configured for transcription routes.",
        }
    finally:
        app.dependency_overrides.clear()
