import pytest

from app.integrations.openai_transcription import (
    OpenAITranscriptionRequestError,
    OpenAITranscriptionResult,
    OpenAITranscriptionSegment,
    OpenAITranscriptionWord,
)
from app.schemas.transcription import TranscriptionResponse
from app.services.transcription_service import (
    DEFAULT_MAX_AUDIO_UPLOAD_BYTES,
    TranscriptionService,
    TranscriptionServiceError,
    TranscriptionValidationError,
)


class SuccessfulTranscriptionIntegration:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def transcribe_audio(
        self,
        *,
        audio_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OpenAITranscriptionResult:
        self.calls.append(
            {
                "audio_bytes": audio_bytes,
                "content_type": content_type,
                "filename": filename,
            }
        )
        return OpenAITranscriptionResult(
            duration_seconds=12.5,
            language="en",
            model="whisper-1",
            segments=(
                OpenAITranscriptionSegment(
                    end=1.4,
                    id=0,
                    start=0.0,
                    text="hello there",
                ),
            ),
            text="hello there",
            words=(
                OpenAITranscriptionWord(
                    end=0.5,
                    start=0.0,
                    word="hello",
                ),
                OpenAITranscriptionWord(
                    end=1.0,
                    start=0.5,
                    word="there",
                ),
            ),
        )


class FailingTranscriptionIntegration:
    def transcribe_audio(
        self,
        *,
        audio_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OpenAITranscriptionResult:
        raise OpenAITranscriptionRequestError("request failed")


def test_transcription_service_maps_openai_result_to_application_schema() -> None:
    integration = SuccessfulTranscriptionIntegration()
    service = TranscriptionService(integration)

    response = service.transcribe_upload(
        audio_bytes=b"audio-bytes",
        content_type="audio/webm",
        filename="practice.webm",
    )

    assert response == TranscriptionResponse(
        duration_seconds=12.5,
        language="en",
        model="whisper-1",
        segments=[
            {
                "end": 1.4,
                "id": 0,
                "start": 0.0,
                "text": "hello there",
            }
        ],
        text="hello there",
        words=[
            {
                "end": 0.5,
                "start": 0.0,
                "word": "hello",
            },
            {
                "end": 1.0,
                "start": 0.5,
                "word": "there",
            },
        ],
    )
    assert integration.calls == [
        {
            "audio_bytes": b"audio-bytes",
            "content_type": "audio/webm",
            "filename": "practice.webm",
        }
    ]


def test_transcription_service_defaults_missing_content_type() -> None:
    integration = SuccessfulTranscriptionIntegration()
    service = TranscriptionService(integration)

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type=None,
            filename="practice.webm",
        )

    assert exc_info.value.args == ("Audio upload content type is required.",)


def test_transcription_service_normalizes_content_type_parameters() -> None:
    integration = SuccessfulTranscriptionIntegration()
    service = TranscriptionService(integration)

    service.transcribe_upload(
        audio_bytes=b"audio-bytes",
        content_type="audio/webm; codecs=opus",
        filename="practice.webm",
    )

    assert integration.calls[0]["content_type"] == "audio/webm"


def test_transcription_service_rejects_empty_audio_uploads() -> None:
    service = TranscriptionService(SuccessfulTranscriptionIntegration())

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"",
            content_type="audio/webm",
            filename="practice.webm",
        )

    assert exc_info.value.args == ("Audio upload must not be empty.",)


def test_transcription_service_rejects_oversized_audio_uploads() -> None:
    service = TranscriptionService(SuccessfulTranscriptionIntegration())

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"a" * (DEFAULT_MAX_AUDIO_UPLOAD_BYTES + 1),
            content_type="audio/webm",
            filename="practice.webm",
        )

    assert exc_info.value.args == (
        (
            "Audio upload exceeds the "
            f"{DEFAULT_MAX_AUDIO_UPLOAD_BYTES} byte transcription limit."
        ),
    )


def test_transcription_service_uses_configured_upload_limit() -> None:
    service = TranscriptionService(
        SuccessfulTranscriptionIntegration(),
        max_upload_bytes=4,
    )

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type="audio/webm",
            filename="practice.webm",
        )

    assert exc_info.value.args == (
        "Audio upload exceeds the 4 byte transcription limit.",
    )


def test_transcription_service_rejects_missing_filename() -> None:
    service = TranscriptionService(SuccessfulTranscriptionIntegration())

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type="audio/webm",
            filename=None,
        )

    assert exc_info.value.args == ("Audio upload filename is required.",)


def test_transcription_service_rejects_unsupported_audio_formats() -> None:
    service = TranscriptionService(SuccessfulTranscriptionIntegration())

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type="audio/ogg",
            filename="practice.ogg",
        )

    assert exc_info.value.args == ("Audio upload format is unsupported.",)


def test_transcription_service_rejects_unsupported_audio_content_types() -> None:
    service = TranscriptionService(SuccessfulTranscriptionIntegration())

    with pytest.raises(TranscriptionValidationError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type="application/octet-stream",
            filename="practice.webm",
        )

    assert exc_info.value.args == ("Audio upload content type is unsupported.",)


def test_transcription_service_maps_openai_failures_to_service_errors() -> None:
    service = TranscriptionService(FailingTranscriptionIntegration())

    with pytest.raises(TranscriptionServiceError) as exc_info:
        service.transcribe_upload(
            audio_bytes=b"audio-bytes",
            content_type="audio/webm",
            filename="practice.webm",
        )

    assert exc_info.value.args == ("Transcription could not be completed.",)
