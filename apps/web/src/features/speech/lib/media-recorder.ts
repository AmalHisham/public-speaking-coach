"use client";

export const SPEECH_RECORDING_STATUSES = [
  "idle",
  "recording",
  "recorded",
  "failed",
] as const;

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
] as const;

export type SpeechRecordingStatus = (typeof SPEECH_RECORDING_STATUSES)[number];

export type SpeechRecordingState = {
  audioBlob: Blob | null;
  recordingError: string | null;
  recordingMimeType: string | null;
  recordingStatus: SpeechRecordingStatus;
};

export const initialSpeechRecordingState: SpeechRecordingState = {
  audioBlob: null,
  recordingError: null,
  recordingMimeType: null,
  recordingStatus: "idle",
};

type BrowserMediaRecorderDataEvent = {
  data: Blob;
};

type BrowserMediaRecorderError = {
  message?: string;
  name?: string;
};

type BrowserMediaRecorderErrorEvent = {
  error?: BrowserMediaRecorderError;
};

type BrowserMediaRecorderInstance = {
  mimeType: string;
  ondataavailable:
    | ((event: BrowserMediaRecorderDataEvent) => void)
    | null;
  onerror: ((event: BrowserMediaRecorderErrorEvent) => void) | null;
  onstop: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserMediaRecorderOptions = {
  mimeType?: string;
};

type BrowserMediaRecorderConstructor = {
  isTypeSupported?: (mimeType: string) => boolean;
  new (
    stream: MediaStream,
    options?: BrowserMediaRecorderOptions,
  ): BrowserMediaRecorderInstance;
};

type BrowserMediaRecorderWindow = Window &
  typeof globalThis & {
    MediaRecorder?: BrowserMediaRecorderConstructor;
  };

export type MediaRecordingController = {
  stop: () => Promise<void>;
};

type RecordingStart = {
  mimeType: string | null;
};

type RecordingComplete = {
  audioBlob: Blob;
  mimeType: string | null;
};

export type MediaRecordingHandlers = {
  onError: (error: string) => void;
  onRecordingComplete: (recording: RecordingComplete) => void;
  onRecordingStart: (recording: RecordingStart) => void;
  stream: MediaStream;
};

export type StartMediaRecordingResult =
  | {
      controller: MediaRecordingController;
      status: "started";
    }
  | {
      error: string;
      status: "failed";
    };

function getBrowserMediaRecorderConstructor(
  browserWindow:
    | BrowserMediaRecorderWindow
    | null = typeof window === "undefined"
      ? null
      : (window as BrowserMediaRecorderWindow),
): BrowserMediaRecorderConstructor | null {
  if (!browserWindow) {
    return null;
  }

  return browserWindow.MediaRecorder ?? null;
}

export function selectRecordingMimeType(
  MediaRecorderConstructor: BrowserMediaRecorderConstructor | null,
): string | null {
  if (!MediaRecorderConstructor?.isTypeSupported) {
    return null;
  }

  for (const mimeType of PREFERRED_AUDIO_MIME_TYPES) {
    if (MediaRecorderConstructor.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

function mapMediaRecorderStartError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Audio recording permission denied.";
    }
  }

  return "Audio recording could not start.";
}

function mapMediaRecorderRuntimeError(error: BrowserMediaRecorderError | undefined): string {
  if (error?.name === "SecurityError") {
    return "Audio recording permission denied.";
  }

  if (typeof error?.message === "string" && error.message.length > 0) {
    return error.message;
  }

  return "Audio recording failed.";
}

export function startMediaRecording(
  handlers: MediaRecordingHandlers,
  MediaRecorderConstructor: BrowserMediaRecorderConstructor | null = getBrowserMediaRecorderConstructor(),
): StartMediaRecordingResult {
  if (!MediaRecorderConstructor) {
    return {
      error: "Audio recording is unavailable in this browser.",
      status: "failed",
    };
  }

  const selectedMimeType = selectRecordingMimeType(MediaRecorderConstructor);

  let recorder: BrowserMediaRecorderInstance;

  try {
    recorder = selectedMimeType
      ? new MediaRecorderConstructor(handlers.stream, {
          mimeType: selectedMimeType,
        })
      : new MediaRecorderConstructor(handlers.stream);
  } catch (error: unknown) {
    return {
      error: mapMediaRecorderStartError(error),
      status: "failed",
    };
  }

  const audioChunks: Blob[] = [];
  const resolvedMimeType = recorder.mimeType || selectedMimeType;
  let isFinished = false;
  let isStopping = false;
  let resolveStop: (() => void) | null = null;
  const stopPromise = new Promise<void>((resolve) => {
    resolveStop = resolve;
  });

  const cleanup = () => {
    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;
  };

  const finishStop = () => {
    resolveStop?.();
    resolveStop = null;
  };

  recorder.ondataavailable = (event) => {
    if (event.data.size === 0) {
      return;
    }

    audioChunks.push(event.data);
  };

  recorder.onerror = (event) => {
    if (isFinished) {
      return;
    }

    isFinished = true;
    cleanup();
    handlers.onError(mapMediaRecorderRuntimeError(event.error));
    finishStop();
  };

  recorder.onstop = () => {
    if (isFinished) {
      finishStop();
      return;
    }

    isFinished = true;
    cleanup();

    const audioBlob = new Blob(
      audioChunks,
      resolvedMimeType ? { type: resolvedMimeType } : {},
    );

    handlers.onRecordingComplete({
      audioBlob,
      mimeType: audioBlob.type || resolvedMimeType || null,
    });
    finishStop();
  };

  try {
    recorder.start();
  } catch (error: unknown) {
    cleanup();

    return {
      error: mapMediaRecorderStartError(error),
      status: "failed",
    };
  }

  handlers.onRecordingStart({
    mimeType: resolvedMimeType || null,
  });

  return {
    controller: {
      stop: () => {
        if (isFinished || isStopping) {
          return stopPromise;
        }

        isStopping = true;

        try {
          recorder.stop();
        } catch (error: unknown) {
          if (!isFinished) {
            isFinished = true;
            cleanup();
            handlers.onError(mapMediaRecorderStartError(error));
            finishStop();
          }
        }

        return stopPromise;
      },
    },
    status: "started",
  };
}
