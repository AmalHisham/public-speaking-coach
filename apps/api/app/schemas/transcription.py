from pydantic import BaseModel


class TranscriptionWordResponse(BaseModel):
    end: float
    start: float
    word: str


class TranscriptionSegmentResponse(BaseModel):
    end: float
    id: int | None = None
    start: float
    text: str


class TranscriptionResponse(BaseModel):
    duration_seconds: float | None
    language: str | None
    model: str
    segments: list[TranscriptionSegmentResponse]
    text: str
    words: list[TranscriptionWordResponse]
