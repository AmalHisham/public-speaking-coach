import httpx
import pytest

from app.integrations.openai_transcription import (
    OpenAITranscriptionIntegration,
    OpenAITranscriptionRequestError,
    OpenAITranscriptionResult,
    OpenAITranscriptionSegment,
    OpenAITranscriptionWord,
)


def test_openai_transcription_uploads_audio_as_multipart_form_data() -> None:
    captured_request: httpx.Request | None = None

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request

        return httpx.Response(
            200,
            json={
                "duration": 8.2,
                "language": "en",
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
            },
        )

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    integration = OpenAITranscriptionIntegration(
        api_key="test-api-key",
        http_client=http_client,
    )

    try:
        response = integration.transcribe_audio(
            audio_bytes=b"audio-bytes",
            content_type="audio/webm",
            filename="practice.webm",
        )
    finally:
        http_client.close()

    assert response == OpenAITranscriptionResult(
        duration_seconds=8.2,
        language="en",
        model="whisper-1",
        segments=(
            OpenAITranscriptionSegment(
                end=1.0,
                id=0,
                start=0.0,
                text="steady pacing",
            ),
        ),
        text="steady pacing",
        words=(
            OpenAITranscriptionWord(
                end=0.6,
                start=0.0,
                word="steady",
            ),
        ),
    )

    assert captured_request is not None
    assert (
        captured_request.headers["Authorization"] == "Bearer test-api-key"
    )
    assert captured_request.headers["Content-Type"].startswith(
        "multipart/form-data; boundary="
    )

    request_body = captured_request.read()

    assert b'name="model"' in request_body
    assert b"whisper-1" in request_body
    assert b'name="response_format"' in request_body
    assert b"verbose_json" in request_body
    assert b'name="timestamp_granularities[]"' in request_body
    assert b"word" in request_body
    assert b'name="file"; filename="practice.webm"' in request_body
    assert b"Content-Type: audio/webm" in request_body
    assert b"audio-bytes" in request_body


def test_openai_transcription_maps_httpx_failures_to_request_errors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection failed", request=request)

    http_client = httpx.Client(transport=httpx.MockTransport(handler))
    integration = OpenAITranscriptionIntegration(
        api_key="test-api-key",
        http_client=http_client,
    )

    try:
        with pytest.raises(OpenAITranscriptionRequestError) as exc_info:
            integration.transcribe_audio(
                audio_bytes=b"audio-bytes",
                content_type="audio/webm",
                filename="practice.webm",
            )
    finally:
        http_client.close()

    assert exc_info.value.args == ("OpenAI transcription request failed.",)
