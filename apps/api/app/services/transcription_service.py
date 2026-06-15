from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import Settings, get_settings
from app.integrations.openai_transcription import (
    OpenAITranscriptionIntegration,
    OpenAITranscriptionRequestError,
    OpenAITranscriptionResult,
)
from app.schemas.transcription import (
    TranscriptionResponse,
    TranscriptionSegmentResponse,
    TranscriptionWordResponse,
)


logger = logging.getLogger(__name__)

DEFAULT_MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024
SUPPORTED_AUDIO_FORMATS = {
    ".m4a": frozenset({"audio/mp4", "audio/x-m4a"}),
    ".mp3": frozenset({"audio/mpeg", "audio/mp3"}),
    ".mp4": frozenset({"audio/mp4", "video/mp4"}),
    ".mpeg": frozenset({"audio/mpeg"}),
    ".mpga": frozenset({"audio/mpeg"}),
    ".wav": frozenset({"audio/wav", "audio/x-wav", "audio/wave"}),
    ".webm": frozenset({"audio/webm"}),
}


class TranscriptionValidationError(ValueError):
    """Raised when an upload cannot be transcribed safely."""


class TranscriptionServiceError(RuntimeError):
    """Raised when transcription cannot be completed."""


class TranscriptionConfigurationError(RuntimeError):
    """Raised when transcription is not configured for the environment."""


class OpenAITranscriptionProtocol(Protocol):
    def transcribe_audio(
        self,
        *,
        audio_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OpenAITranscriptionResult:
        ...


class TranscriptionService:
    def __init__(
        self,
        transcription_integration: OpenAITranscriptionProtocol,
        max_upload_bytes: int = DEFAULT_MAX_AUDIO_UPLOAD_BYTES,
    ) -> None:
        if max_upload_bytes <= 0:
            raise ValueError("Transcription upload limit must be greater than zero.")

        self._transcription_integration = transcription_integration
        self._max_upload_bytes = max_upload_bytes

    def transcribe_upload(
        self,
        *,
        audio_bytes: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> TranscriptionResponse:
        validated_filename = self._validate_filename(filename)
        normalized_content_type = self._validate_content_type(
            content_type=content_type,
            filename=validated_filename,
        )
        validated_audio_bytes = self._validate_audio_bytes(audio_bytes)

        try:
            transcription_result = self._transcription_integration.transcribe_audio(
                audio_bytes=validated_audio_bytes,
                content_type=normalized_content_type,
                filename=validated_filename,
            )
        except OpenAITranscriptionRequestError as error:
            logger.exception("OpenAI transcription request failed.")
            raise TranscriptionServiceError(
                "Transcription could not be completed."
            ) from error

        return TranscriptionResponse(
            duration_seconds=transcription_result.duration_seconds,
            language=transcription_result.language,
            model=transcription_result.model,
            segments=[
                TranscriptionSegmentResponse(
                    end=segment.end,
                    id=segment.id,
                    start=segment.start,
                    text=segment.text,
                )
                for segment in transcription_result.segments
            ],
            text=transcription_result.text,
            words=[
                TranscriptionWordResponse(
                    end=word.end,
                    start=word.start,
                    word=word.word,
                )
                for word in transcription_result.words
            ],
        )

    def _validate_audio_bytes(self, audio_bytes: bytes) -> bytes:
        if len(audio_bytes) == 0:
            raise TranscriptionValidationError("Audio upload must not be empty.")

        if len(audio_bytes) > self._max_upload_bytes:
            raise TranscriptionValidationError(
                f"Audio upload exceeds the {self._max_upload_bytes} byte transcription limit."
            )

        return audio_bytes

    def _validate_filename(self, filename: str | None) -> str:
        if filename is None or filename.strip() == "":
            raise TranscriptionValidationError("Audio upload filename is required.")

        suffix = Path(filename).suffix.lower()

        if suffix not in SUPPORTED_AUDIO_FORMATS:
            raise TranscriptionValidationError(
                "Audio upload format is unsupported."
            )

        return filename

    def _validate_content_type(self, *, content_type: str | None, filename: str) -> str:
        if content_type is None or content_type.strip() == "":
            raise TranscriptionValidationError("Audio upload content type is required.")

        normalized_content_type = content_type.split(";", maxsplit=1)[0].strip().lower()
        suffix = Path(filename).suffix.lower()
        supported_content_types = SUPPORTED_AUDIO_FORMATS[suffix]

        if normalized_content_type not in supported_content_types:
            raise TranscriptionValidationError(
                "Audio upload content type is unsupported."
            )

        return normalized_content_type


@lru_cache
def get_transcription_service() -> TranscriptionService:
    settings = get_settings()

    return TranscriptionService(
        transcription_integration=OpenAITranscriptionIntegration(
            api_key=_get_openai_api_key(settings)
        ),
        max_upload_bytes=settings.transcription_max_upload_bytes,
    )


def _get_openai_api_key(settings: Settings) -> str:
    if settings.openai_api_key is None:
        raise TranscriptionConfigurationError(
            "OPENAI_API_KEY must be configured for transcription routes. "
            "Set it in the API environment and restart the backend."
        )

    api_key = settings.openai_api_key.get_secret_value().strip()

    if api_key == "":
        raise TranscriptionConfigurationError(
            "OPENAI_API_KEY must be configured for transcription routes. "
            "Set it in the API environment and restart the backend."
        )

    return api_key
