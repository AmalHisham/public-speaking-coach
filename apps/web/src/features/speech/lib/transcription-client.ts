"use client";

const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "audio/mp4": "mp4",
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
};

export const SPEECH_PROCESSING_STATUSES = [
  "idle",
  "uploading",
  "transcribing",
  "transcript_ready",
  "failed",
] as const;

export type SpeechProcessingStatus =
  (typeof SPEECH_PROCESSING_STATUSES)[number];

export type SpeechProcessingPhase = Extract<
  SpeechProcessingStatus,
  "uploading" | "transcribing"
>;

export type SpeechTranscriptionWord = {
  end: number;
  start: number;
  word: string;
};

export type SpeechTranscriptionSegment = {
  end: number;
  id: number | null;
  start: number;
  text: string;
};

export type SpeechTranscription = {
  duration_seconds: number | null;
  language: string | null;
  model: string;
  segments: SpeechTranscriptionSegment[];
  text: string;
  words: SpeechTranscriptionWord[];
};

type RequestSpeechTranscriptionParams = {
  apiBaseUrl?: string;
  audioBlob: Blob;
  fetchImplementation?: typeof fetch;
  onStatusChange?: (status: SpeechProcessingPhase) => void;
  recordingMimeType: string | null;
  signal?: AbortSignal;
  token: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readFilenameExtension(recordingMimeType: string | null): string {
  if (recordingMimeType && recordingMimeType in MIME_TYPE_TO_EXTENSION) {
    return MIME_TYPE_TO_EXTENSION[recordingMimeType];
  }

  if (typeof Blob !== "undefined" && recordingMimeType === null) {
    return "webm";
  }

  return "webm";
}

function normalizeWord(value: unknown): SpeechTranscriptionWord {
  if (
    !isRecord(value) ||
    typeof value.word !== "string" ||
    typeof value.start !== "number" ||
    typeof value.end !== "number"
  ) {
    throw new Error("Transcription response contained an invalid word entry.");
  }

  return {
    end: value.end,
    start: value.start,
    word: value.word,
  };
}

function normalizeSegment(value: unknown): SpeechTranscriptionSegment {
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    typeof value.start !== "number" ||
    typeof value.end !== "number"
  ) {
    throw new Error("Transcription response contained an invalid segment entry.");
  }

  return {
    end: value.end,
    id: typeof value.id === "number" ? value.id : null,
    start: value.start,
    text: value.text,
  };
}

function normalizeSpeechTranscription(
  value: unknown,
): SpeechTranscription {
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    typeof value.model !== "string" ||
    !Array.isArray(value.words) ||
    !Array.isArray(value.segments)
  ) {
    throw new Error("Transcription response was malformed.");
  }

  const durationSeconds =
    typeof value.duration_seconds === "number" ? value.duration_seconds : null;
  const language = typeof value.language === "string" ? value.language : null;

  return {
    duration_seconds: durationSeconds,
    language,
    model: value.model,
    segments: value.segments.map(normalizeSegment),
    text: value.text,
    words: value.words.map(normalizeWord),
  };
}

async function readFailureMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;

    if (isRecord(payload) && typeof payload.detail === "string") {
      return payload.detail;
    }
  } catch (error) {
    if (error instanceof Error) {
      return `Transcription request failed with status ${response.status}.`;
    }
  }

  return `Transcription request failed with status ${response.status}.`;
}

export async function requestSpeechTranscription({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  audioBlob,
  fetchImplementation = fetch,
  onStatusChange,
  recordingMimeType,
  signal,
  token,
}: RequestSpeechTranscriptionParams): Promise<SpeechTranscription> {
  if (token.length === 0) {
    throw new Error("Clerk did not return a session token.");
  }

  onStatusChange?.("uploading");

  const formData = new FormData();
  const extension = readFilenameExtension(recordingMimeType || audioBlob.type);

  formData.append("audio", audioBlob, `session-recording.${extension}`);

  const responsePromise = fetchImplementation(`${apiBaseUrl}/transcriptions`, {
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
    signal,
  });

  onStatusChange?.("transcribing");

  const response = await responsePromise;

  if (!response.ok) {
    throw new Error(await readFailureMessage(response));
  }

  const payload = (await response.json()) as unknown;

  return normalizeSpeechTranscription(payload);
}
