import assert from "node:assert/strict";
import test from "node:test";

import {
  startSpeechRecognition,
  type SpeechRecognitionHandlers,
} from "@/features/speech/lib/speech-recognition";

type MockResult = {
  isFinal: boolean;
  transcript: string;
};

function createRecognitionResults(results: readonly MockResult[]) {
  return results.map((result) => ({
    0: {
      transcript: result.transcript,
    },
    isFinal: result.isFinal,
    length: 1,
  }));
}

type MockSpeechRecognitionResult = ReturnType<
  typeof createRecognitionResults
>[number];

class MockSpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null;
  static startError: Error | null = null;

  continuous = false;
  interimResults = false;
  lang: string | undefined = undefined;
  maxAlternatives = 0;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult: ((event: { results: ArrayLike<MockSpeechRecognitionResult> }) => void) | null =
    null;
  onstart: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;

  constructor() {
    MockSpeechRecognition.lastInstance = this;
  }

  static reset() {
    MockSpeechRecognition.lastInstance = null;
    MockSpeechRecognition.startError = null;
  }

  emitEnd() {
    this.onend?.();
  }

  emitError(error: string) {
    this.onerror?.({
      error,
    });
  }

  emitResult(results: readonly MockResult[]) {
    this.onresult?.({
      results: createRecognitionResults(results),
    });
  }

  emitStart() {
    this.onstart?.();
  }

  start() {
    this.startCalls += 1;

    if (MockSpeechRecognition.startError) {
      throw MockSpeechRecognition.startError;
    }
  }

  stop() {
    this.stopCalls += 1;
  }
}

function createHandlers() {
  const errors: string[] = [];
  const listeningStates: boolean[] = [];
  const transcripts: Array<{
    finalTranscript: string;
    interimTranscript: string;
  }> = [];

  const handlers: SpeechRecognitionHandlers = {
    onError: (error) => {
      errors.push(error);
    },
    onListeningChange: (isListening) => {
      listeningStates.push(isListening);
    },
    onTranscript: (transcript) => {
      transcripts.push(transcript);
    },
  };

  return {
    errors,
    handlers,
    listeningStates,
    transcripts,
  };
}

function getMockSpeechRecognitionConstructor(): NonNullable<
  Parameters<typeof startSpeechRecognition>[1]
> {
  return MockSpeechRecognition as unknown as NonNullable<
    Parameters<typeof startSpeechRecognition>[1]
  >;
}

test("reports unsupported browsers before starting recognition", () => {
  const { handlers } = createHandlers();

  assert.deepStrictEqual(startSpeechRecognition(handlers, null), {
    error: "Speech recognition is unavailable in this browser.",
    status: "failed",
    support: "unsupported",
  });
});

test("configures browser speech recognition and emits live transcript updates", () => {
  MockSpeechRecognition.reset();
  const { handlers, listeningStates, transcripts } = createHandlers();

  const result = startSpeechRecognition(
    handlers,
    getMockSpeechRecognitionConstructor(),
  );

  assert.equal(result.status, "started");

  const instance = MockSpeechRecognition.lastInstance;

  assert.ok(instance instanceof MockSpeechRecognition);
  assert.equal(instance.continuous, true);
  assert.equal(instance.interimResults, true);
  assert.equal(instance.lang, "en-IN");
  assert.equal(instance.maxAlternatives, 1);
  assert.equal(instance.startCalls, 1);

  instance.emitStart();
  instance.emitResult([
    {
      isFinal: true,
      transcript: "hello there",
    },
    {
      isFinal: false,
      transcript: "general kenobi",
    },
  ]);
  instance.emitEnd();

  assert.deepStrictEqual(listeningStates, [true, false]);
  assert.deepStrictEqual(transcripts, [
    {
      finalTranscript: "hello there",
      interimTranscript: "general kenobi",
    },
    {
      finalTranscript: "hello there",
      interimTranscript: "",
    },
  ]);
  assert.equal(instance.startCalls, 2);
});

test("ignores no-speech errors and restarts the recognizer when it ends", () => {
  MockSpeechRecognition.reset();
  const { errors, handlers } = createHandlers();

  const result = startSpeechRecognition(
    handlers,
    getMockSpeechRecognitionConstructor(),
  );

  assert.equal(result.status, "started");

  const instance = MockSpeechRecognition.lastInstance;

  assert.ok(instance instanceof MockSpeechRecognition);

  instance.emitStart();
  instance.emitError("no-speech");
  instance.emitEnd();

  assert.deepStrictEqual(errors, []);
  assert.equal(instance.startCalls, 2);
});

test("propagates fatal recognition errors without restarting the recognizer", () => {
  MockSpeechRecognition.reset();
  const { errors, handlers, listeningStates } = createHandlers();

  const result = startSpeechRecognition(
    handlers,
    getMockSpeechRecognitionConstructor(),
  );

  assert.equal(result.status, "started");

  const instance = MockSpeechRecognition.lastInstance;

  assert.ok(instance instanceof MockSpeechRecognition);

  instance.emitStart();
  instance.emitError("network");
  instance.emitEnd();

  assert.deepStrictEqual(errors, [
    "Speech recognition encountered a network error.",
  ]);
  assert.deepStrictEqual(listeningStates, [true, false]);
  assert.equal(instance.startCalls, 1);
});

test("finalizes the transcript and stops cleanly when the session requests shutdown", () => {
  MockSpeechRecognition.reset();
  const { handlers, listeningStates, transcripts } = createHandlers();

  const result = startSpeechRecognition(
    handlers,
    getMockSpeechRecognitionConstructor(),
  );

  assert.equal(result.status, "started");

  const instance = MockSpeechRecognition.lastInstance;

  assert.ok(instance instanceof MockSpeechRecognition);

  instance.emitStart();
  instance.emitResult([
    {
      isFinal: true,
      transcript: "practice makes",
    },
    {
      isFinal: false,
      transcript: "progress",
    },
  ]);
  result.controller.stop();
  instance.emitEnd();

  assert.deepStrictEqual(listeningStates, [true, false]);
  assert.deepStrictEqual(transcripts.at(-1), {
    finalTranscript: "practice makes",
    interimTranscript: "",
  });
  assert.equal(instance.startCalls, 1);
  assert.equal(instance.stopCalls, 1);
});

test("maps browser start failures into a failed recognition result", () => {
  MockSpeechRecognition.reset();
  MockSpeechRecognition.startError = Object.assign(new Error("Denied"), {
    name: "NotAllowedError",
  });

  const { handlers } = createHandlers();

  assert.deepStrictEqual(
    startSpeechRecognition(handlers, getMockSpeechRecognitionConstructor()),
    {
      error: "Speech recognition permission denied.",
      status: "failed",
      support: "supported",
    },
  );
});
