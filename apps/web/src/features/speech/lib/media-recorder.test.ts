import assert from "node:assert/strict";
import test from "node:test";

import {
  selectRecordingMimeType,
  startMediaRecording,
} from "@/features/speech/lib/media-recorder";

type MockMediaRecorderError = {
  message?: string;
  name?: string;
};

class MockMediaRecorder {
  static constructError: Error | null = null;
  static lastInstance: MockMediaRecorder | null = null;
  static supportedMimeTypes = new Set<string>();

  static isTypeSupported(mimeType: string) {
    return MockMediaRecorder.supportedMimeTypes.has(mimeType);
  }

  static reset() {
    MockMediaRecorder.constructError = null;
    MockMediaRecorder.lastInstance = null;
    MockMediaRecorder.supportedMimeTypes = new Set<string>();
  }

  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: ((event: { error?: MockMediaRecorderError }) => void) | null = null;
  onstop: (() => void) | null = null;
  startCalls = 0;
  stopCalls = 0;

  constructor(
    stream: MediaStream,
    options?: {
      mimeType?: string;
    },
  ) {
    void stream;

    if (MockMediaRecorder.constructError) {
      throw MockMediaRecorder.constructError;
    }

    this.mimeType = options?.mimeType ?? "";
    MockMediaRecorder.lastInstance = this;
  }

  emitData(data: Blob) {
    this.ondataavailable?.({
      data,
    });
  }

  emitError(error?: MockMediaRecorderError) {
    this.onerror?.({
      error,
    });
  }

  emitStop() {
    this.onstop?.();
  }

  start() {
    this.startCalls += 1;
  }

  stop() {
    this.stopCalls += 1;
  }
}

function getMockMediaRecorderConstructor(): NonNullable<
  Parameters<typeof startMediaRecording>[1]
> {
  return MockMediaRecorder as unknown as NonNullable<
    Parameters<typeof startMediaRecording>[1]
  >;
}

test("selects the first supported recording MIME type", () => {
  MockMediaRecorder.reset();
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  assert.equal(
    selectRecordingMimeType(getMockMediaRecorderConstructor()),
    "audio/webm",
  );
});

test("reports unsupported browsers before recording starts", () => {
  const errors: string[] = [];

  const result = startMediaRecording(
    {
      onError: (error) => {
        errors.push(error);
      },
      onRecordingComplete: () => {
        throw new Error("Recording should not complete.");
      },
      onRecordingStart: () => {
        throw new Error("Recording should not start.");
      },
      stream: {} as MediaStream,
    },
    null,
  );

  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(result, {
    error: "Audio recording is unavailable in this browser.",
    status: "failed",
  });
});

test("collects chunks and finalizes a Blob when recording stops", async () => {
  MockMediaRecorder.reset();
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm;codecs=opus"]);
  const startedMimeTypes: Array<string | null> = [];
  const completedRecordings: Array<{
    audioBlob: Blob;
    mimeType: string | null;
  }> = [];

  const result = startMediaRecording(
    {
      onError: () => {
        throw new Error("Recording should not fail.");
      },
      onRecordingComplete: (recording) => {
        completedRecordings.push(recording);
      },
      onRecordingStart: ({ mimeType }) => {
        startedMimeTypes.push(mimeType);
      },
      stream: {} as MediaStream,
    },
    getMockMediaRecorderConstructor(),
  );

  assert.equal(result.status, "started");
  if (result.status !== "started") {
    throw new Error("Recording should have started.");
  }

  const recorder = MockMediaRecorder.lastInstance;
  assert.ok(recorder instanceof MockMediaRecorder);

  recorder.emitData(new Blob(["steady "], { type: "audio/webm" }));
  recorder.emitData(new Blob(["pacing"], { type: "audio/webm" }));

  const stopPromise = result.controller.stop();
  recorder.emitStop();
  await stopPromise;

  assert.deepStrictEqual(startedMimeTypes, ["audio/webm;codecs=opus"]);
  assert.equal(completedRecordings.length, 1);
  assert.equal(completedRecordings[0]?.mimeType, "audio/webm;codecs=opus");
  assert.equal(await completedRecordings[0]?.audioBlob.text(), "steady pacing");
});

test("maps runtime recorder errors to recording failures", () => {
  MockMediaRecorder.reset();
  const errors: string[] = [];

  const result = startMediaRecording(
    {
      onError: (error) => {
        errors.push(error);
      },
      onRecordingComplete: () => {
        throw new Error("Recording should not complete.");
      },
      onRecordingStart: () => {
        return;
      },
      stream: {} as MediaStream,
    },
    getMockMediaRecorderConstructor(),
  );

  assert.equal(result.status, "started");
  if (result.status !== "started") {
    throw new Error("Recording should have started.");
  }

  const recorder = MockMediaRecorder.lastInstance;
  assert.ok(recorder instanceof MockMediaRecorder);

  recorder.emitError({
    message: "Recorder disconnected.",
  });

  assert.deepStrictEqual(errors, ["Recorder disconnected."]);
});
