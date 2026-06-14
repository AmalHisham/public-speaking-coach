"use client";

export const SPEECH_SUPPORT_STATUSES = [
  "unknown",
  "supported",
  "unsupported",
] as const;

const DEFAULT_RECOGNITION_LANGUAGE = "en-IN";

export type SpeechSupportStatus = (typeof SPEECH_SUPPORT_STATUSES)[number];

export type TranscriptState = {
  finalTranscript: string;
  interimTranscript: string;
  isListening: boolean;
  support: SpeechSupportStatus;
};

export const initialTranscriptState: TranscriptState = {
  finalTranscript: "",
  interimTranscript: "",
  isListening: false,
  support: "unknown",
};

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = ArrayLike<
  BrowserSpeechRecognitionAlternative
> & {
  isFinal: boolean;
};

type BrowserSpeechRecognitionResultList =
  ArrayLike<BrowserSpeechRecognitionResult>;

type BrowserSpeechRecognitionEvent = {
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "phrases-not-supported"
  | "service-not-allowed";

type BrowserSpeechRecognitionErrorEvent = {
  error: BrowserSpeechRecognitionErrorCode | string;
};

type BrowserSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang?: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognitionInstance;

type BrowserSpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

export type SpeechRecognitionController = {
  stop: () => void;
};

type TranscriptUpdate = Pick<
  TranscriptState,
  "finalTranscript" | "interimTranscript"
>;

export type SpeechRecognitionHandlers = {
  onError: (error: string) => void;
  onListeningChange: (isListening: boolean) => void;
  onTranscript: (transcript: TranscriptUpdate) => void;
};

export type StartSpeechRecognitionResult =
  | {
      controller: SpeechRecognitionController;
      status: "started";
      support: "supported";
    }
  | {
      error: string;
      status: "failed";
      support: Exclude<SpeechSupportStatus, "unknown">;
    };

function getBrowserSpeechRecognitionConstructor(
  browserWindow:
    | BrowserSpeechRecognitionWindow
    | null = typeof window === "undefined"
      ? null
      : (window as BrowserSpeechRecognitionWindow),
): BrowserSpeechRecognitionConstructor | null {
  if (!browserWindow) {
    return null;
  }

  return (
    browserWindow.SpeechRecognition ??
    browserWindow.webkitSpeechRecognition ??
    null
  );
}

function appendTranscript(currentTranscript: string, nextFragment: string): string {
  const cleanFragment = nextFragment.trim();

  if (cleanFragment.length === 0) {
    return currentTranscript;
  }

  return currentTranscript.length === 0
    ? cleanFragment
    : `${currentTranscript} ${cleanFragment}`;
}

function readTranscript(result: BrowserSpeechRecognitionResult): string {
  const firstAlternative = result[0];

  return firstAlternative ? firstAlternative.transcript.trim() : "";
}

function mapSpeechRecognitionError(errorCode: BrowserSpeechRecognitionErrorCode | string) {
  switch (errorCode) {
    case "audio-capture":
      return "Speech recognition could not access microphone audio.";
    case "language-not-supported":
    case "phrases-not-supported":
      return "Speech recognition is unavailable for the current browser language settings.";
    case "network":
      return "Speech recognition encountered a network error.";
    case "not-allowed":
    case "service-not-allowed":
      return "Speech recognition permission denied.";
    default:
      return "Speech recognition failed.";
  }
}

function mapSpeechRecognitionStartError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Speech recognition permission denied.";
    }
  }

  return "Speech recognition could not start.";
}

export function startSpeechRecognition(
  handlers: SpeechRecognitionHandlers,
  SpeechRecognitionConstructor: BrowserSpeechRecognitionConstructor | null = getBrowserSpeechRecognitionConstructor(),
): StartSpeechRecognitionResult {
  if (!SpeechRecognitionConstructor) {
    return {
      error: "Speech recognition is unavailable in this browser.",
      status: "failed",
      support: "unsupported",
    };
  }

  const recognition = new SpeechRecognitionConstructor();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = DEFAULT_RECOGNITION_LANGUAGE;
  recognition.maxAlternatives = 1;

  let committedTranscript = "";
  let cycleFinalTranscript = "";
  let cycleInterimTranscript = "";
  let listening = false;
  let shouldRestart = true;
  let stopped = false;

  const emitTranscript = () => {
    handlers.onTranscript({
      finalTranscript: appendTranscript(
        committedTranscript,
        cycleFinalTranscript,
      ),
      interimTranscript: cycleInterimTranscript,
    });
  };

  recognition.onstart = () => {
    listening = true;
    handlers.onListeningChange(true);
  };

  recognition.onresult = (event) => {
    let nextCycleFinalTranscript = "";
    let nextCycleInterimTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = readTranscript(result);

      if (transcript.length === 0) {
        continue;
      }

      if (result.isFinal) {
        nextCycleFinalTranscript = appendTranscript(
          nextCycleFinalTranscript,
          transcript,
        );
      } else {
        nextCycleInterimTranscript = appendTranscript(
          nextCycleInterimTranscript,
          transcript,
        );
      }
    }

    cycleFinalTranscript = nextCycleFinalTranscript;
    cycleInterimTranscript = nextCycleInterimTranscript;
    emitTranscript();
  };

  recognition.onerror = (event) => {
    if (stopped && event.error === "aborted") {
      return;
    }

    if (event.error === "no-speech") {
      return;
    }

    shouldRestart = false;
    handlers.onError(mapSpeechRecognitionError(event.error));
  };

  recognition.onend = () => {
    if (listening) {
      listening = false;
      handlers.onListeningChange(false);
    }

    if (stopped) {
      return;
    }

    committedTranscript = appendTranscript(
      committedTranscript,
      cycleFinalTranscript,
    );
    cycleFinalTranscript = "";
    cycleInterimTranscript = "";
    emitTranscript();

    if (!shouldRestart) {
      return;
    }

    try {
      recognition.start();
    } catch (error: unknown) {
      shouldRestart = false;
      handlers.onError(mapSpeechRecognitionStartError(error));
    }
  };

  try {
    recognition.start();
  } catch (error: unknown) {
    return {
      error: mapSpeechRecognitionStartError(error),
      status: "failed",
      support: "supported",
    };
  }

  return {
    controller: {
      stop: () => {
        if (stopped) {
          return;
        }

        stopped = true;
        shouldRestart = false;
        committedTranscript = appendTranscript(
          committedTranscript,
          cycleFinalTranscript,
        );
        cycleFinalTranscript = "";
        cycleInterimTranscript = "";
        emitTranscript();

        if (listening) {
          listening = false;
          handlers.onListeningChange(false);
        }

        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.onstart = null;
        recognition.stop();
      },
    },
    status: "started",
    support: "supported",
  };
}
