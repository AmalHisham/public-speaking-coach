from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx


OPENAI_AUDIO_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions"
WHISPER_MODEL = "whisper-1"
VERBOSE_JSON_RESPONSE_FORMAT = "verbose_json"


class OpenAITranscriptionRequestError(RuntimeError):
    """Raised when the OpenAI transcription API request fails."""


@dataclass(frozen=True)
class OpenAITranscriptionWord:
    start: float
    end: float
    word: str


@dataclass(frozen=True)
class OpenAITranscriptionSegment:
    end: float
    id: int | None
    start: float
    text: str


@dataclass(frozen=True)
class OpenAITranscriptionResult:
    duration_seconds: float | None
    language: str | None
    model: str
    segments: tuple[OpenAITranscriptionSegment, ...]
    text: str
    words: tuple[OpenAITranscriptionWord, ...]


class HTTPXResponseProtocol(Protocol):
    def json(self) -> object:
        ...

    def raise_for_status(self) -> None:
        ...


class HTTPXClientProtocol(Protocol):
    def post(
        self,
        url: str,
        *,
        headers: dict[str, str],
        data: dict[str, str],
        files: dict[str, tuple[str, bytes, str]],
    ) -> HTTPXResponseProtocol:
        ...


class OpenAITranscriptionIntegration:
    def __init__(
        self,
        api_key: str,
        http_client: HTTPXClientProtocol | None = None,
    ) -> None:
        self._api_key = api_key
        self._http_client = http_client or httpx.Client(timeout=30.0)

    def transcribe_audio(
        self,
        *,
        audio_bytes: bytes,
        content_type: str,
        filename: str,
    ) -> OpenAITranscriptionResult:
        try:
            response = self._http_client.post(
                OPENAI_AUDIO_TRANSCRIPTIONS_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                },
                data={
                    "model": WHISPER_MODEL,
                    "response_format": VERBOSE_JSON_RESPONSE_FORMAT,
                    "timestamp_granularities[]": "word",
                },
                files={
                    "file": (
                        filename,
                        audio_bytes,
                        content_type,
                    )
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise OpenAITranscriptionRequestError(
                "OpenAI transcription request failed."
            ) from error

        payload = response.json()

        if not isinstance(payload, dict):
            raise OpenAITranscriptionRequestError(
                "OpenAI transcription response was not a JSON object."
            )

        return OpenAITranscriptionResult(
            duration_seconds=_read_optional_float(payload.get("duration")),
            language=_read_optional_string(payload.get("language")),
            model=WHISPER_MODEL,
            segments=_read_segments(payload.get("segments")),
            text=_read_required_string(
                field_name="text",
                value=payload.get("text"),
            ),
            words=_read_words(payload.get("words")),
        )


def _read_optional_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, (float, int)):
        return float(value)

    return None


def _read_optional_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    return None


def _read_optional_string(value: object) -> str | None:
    if isinstance(value, str):
        return value

    return None


def _read_required_string(*, field_name: str, value: object) -> str:
    if isinstance(value, str):
        return value

    raise OpenAITranscriptionRequestError(
        f'OpenAI transcription response did not include a valid "{field_name}" field.'
    )


def _read_segments(value: object) -> tuple[OpenAITranscriptionSegment, ...]:
    if not isinstance(value, list):
        return ()

    segments: list[OpenAITranscriptionSegment] = []

    for item in value:
        if not isinstance(item, dict):
            continue

        text = _read_optional_string(item.get("text"))
        start = _read_optional_float(item.get("start"))
        end = _read_optional_float(item.get("end"))

        if text is None or start is None or end is None:
            continue

        segments.append(
            OpenAITranscriptionSegment(
                end=end,
                id=_read_optional_int(item.get("id")),
                start=start,
                text=text,
            )
        )

    return tuple(segments)


def _read_words(value: object) -> tuple[OpenAITranscriptionWord, ...]:
    if not isinstance(value, list):
        return ()

    words: list[OpenAITranscriptionWord] = []

    for item in value:
        if not isinstance(item, dict):
            continue

        word = _read_optional_string(item.get("word"))
        start = _read_optional_float(item.get("start"))
        end = _read_optional_float(item.get("end"))

        if word is None or start is None or end is None:
            continue

        words.append(
            OpenAITranscriptionWord(
                start=start,
                end=end,
                word=word,
            )
        )

    return tuple(words)
