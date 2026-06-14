import assert from "node:assert/strict";
import test from "node:test";

import { initialSessionState } from "@/features/session/lib/session-state-machine";
import { initialSessionTimerState } from "@/features/session/lib/session-timer";
import { initialSpeechRecordingState } from "@/features/speech/lib/media-recorder";
import { initialTranscriptState } from "@/features/speech/lib/speech-recognition";
import { useSessionStore } from "@/stores/session-store";

import {
  initialMicrophoneState,
  requestMicrophonePermission,
  stopMicrophoneStream,
} from "./microphone-permission";
import {
  initialCameraState,
  requestWebcamPermission,
  stopWebcamStream,
} from "./webcam-permission";

function createMockMediaTrack() {
  const track = {
    stopCalled: false,
    stop: () => {
      track.stopCalled = true;
    },
  };

  return track;
}

function createMockMediaStream(trackCount = 1): {
  stream: MediaStream;
  tracks: Array<ReturnType<typeof createMockMediaTrack>>;
} {
  const tracks = Array.from({ length: trackCount }, () => createMockMediaTrack());

  return {
    stream: {
      getTracks: () => tracks as unknown as MediaStreamTrack[],
    } as unknown as MediaStream,
    tracks,
  };
}

function createInitialSpeechState() {
  return {
    ...initialTranscriptState,
    ...initialSpeechRecordingState,
  };
}

function createPermissionDeniedError() {
  const error = new Error("Permission denied.");
  error.name = "NotAllowedError";

  return error;
}

class MockMediaRecorder {
  static deferStop = false;
  static instances: MockMediaRecorder[] = [];
  static lastInstance: MockMediaRecorder | null = null;
  static startError: Error | null = null;
  static supportedMimeTypes = new Set<string>();

  static isTypeSupported(mimeType: string) {
    return MockMediaRecorder.supportedMimeTypes.has(mimeType);
  }

  static reset() {
    MockMediaRecorder.deferStop = false;
    MockMediaRecorder.instances = [];
    MockMediaRecorder.lastInstance = null;
    MockMediaRecorder.startError = null;
    MockMediaRecorder.supportedMimeTypes = new Set<string>();
  }

  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: ((event: { error?: { message?: string; name?: string } }) => void) | null =
    null;
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
    this.mimeType = options?.mimeType ?? "";
    MockMediaRecorder.instances.push(this);
    MockMediaRecorder.lastInstance = this;
  }

  emitData(data: Blob) {
    this.ondataavailable?.({
      data,
    });
  }

  emitError(error?: { message?: string; name?: string }) {
    this.onerror?.({
      error,
    });
  }

  emitStop() {
    this.onstop?.();
  }

  start() {
    this.startCalls += 1;

    if (MockMediaRecorder.startError) {
      throw MockMediaRecorder.startError;
    }
  }

  stop() {
    this.stopCalls += 1;

    if (!MockMediaRecorder.deferStop) {
      this.emitStop();
    }
  }
}

function installMockMediaRecorder() {
  const originalWindow = "window" in globalThis ? globalThis.window : undefined;

  MockMediaRecorder.reset();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      MediaRecorder: MockMediaRecorder,
    },
  });

  return () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    MockMediaRecorder.reset();
  };
}

function resetSessionStore() {
  if (useSessionStore.getState().status === "ACTIVE") {
    useSessionStore.getState().failActive("Resetting the session store.");
  }

  useSessionStore.setState({
    ...initialSessionState,
    camera: initialCameraState,
    microphone: initialMicrophoneState,
    speech: createInitialSpeechState(),
    timer: initialSessionTimerState,
  });
}

function readSessionSnapshot() {
  const { camera, error, microphone, speech, status, timer } =
    useSessionStore.getState();

  return {
    camera,
    error,
    microphone,
    speech,
    status,
    timer,
  };
}

test("requests webcam access with video only", async () => {
  const { stream } = createMockMediaStream();
  let receivedConstraints: MediaStreamConstraints | null | undefined = null;

  const result = await requestWebcamPermission({
    getUserMedia: async (constraints) => {
      receivedConstraints = constraints;
      return stream;
    },
  });

  assert.deepStrictEqual(receivedConstraints, {
    audio: false,
    video: true,
  });
  assert.equal(result.status, "granted");

  if (result.status === "granted") {
    assert.equal(result.permission, "granted");
    assert.equal(result.stream, stream);
  }
});

test("maps browser camera permission denial to a failed start result", async () => {
  const result = await requestWebcamPermission({
    getUserMedia: async () => {
      throw createPermissionDeniedError();
    },
  });

  assert.deepStrictEqual(result, {
    permission: "denied",
    error: "Camera permission denied.",
    status: "failed",
  });
});

test("requests microphone access with audio only", async () => {
  const { stream } = createMockMediaStream();
  let receivedConstraints: MediaStreamConstraints | null | undefined = null;

  const result = await requestMicrophonePermission({
    getUserMedia: async (constraints) => {
      receivedConstraints = constraints;
      return stream;
    },
  });

  assert.deepStrictEqual(receivedConstraints, {
    audio: true,
    video: false,
  });
  assert.equal(result.status, "granted");

  if (result.status === "granted") {
    assert.equal(result.permission, "granted");
    assert.equal(result.stream, stream);
  }
});

test(
  "maps browser microphone permission denial to a failed start result",
  async () => {
    const result = await requestMicrophonePermission({
      getUserMedia: async () => {
        throw createPermissionDeniedError();
      },
    });

    assert.deepStrictEqual(result, {
      permission: "denied",
      error: "Microphone permission denied.",
      status: "failed",
    });
  },
);

test("stops every track when webcam access is released", () => {
  const { stream, tracks } = createMockMediaStream(2);

  stopWebcamStream(stream);

  assert.deepStrictEqual(
    tracks.map((track) => track.stopCalled),
    [true, true],
  );
});

test("stops every track when microphone access is released", () => {
  const { stream, tracks } = createMockMediaStream(2);

  stopMicrophoneStream(stream);

  assert.deepStrictEqual(
    tracks.map((track) => track.stopCalled),
    [true, true],
  );
});

test("moves the session into failed when camera permission is denied", async () => {
  const originalNavigator = globalThis.navigator;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          throw createPermissionDeniedError();
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();
    assert.deepStrictEqual(readSessionSnapshot(), {
      camera: {
        permission: "denied",
        stream: null,
      },
      error: "Camera permission denied.",
      microphone: initialMicrophoneState,
      speech: createInitialSpeechState(),
      status: "FAILED",
      timer: initialSessionTimerState,
    });
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    resetSessionStore();
  }
});

test(
  "moves the session into failed when microphone permission is denied",
  async () => {
    const originalNavigator = globalThis.navigator;
    const { stream: cameraStream, tracks: cameraTracks } = createMockMediaStream();

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            if (constraints.video === true && constraints.audio === false) {
              return cameraStream;
            }

            throw createPermissionDeniedError();
          },
        },
      },
    });

    resetSessionStore();

    try {
      await useSessionStore.getState().requestStart();

      assert.deepStrictEqual(
        cameraTracks.map((track) => track.stopCalled),
        [true],
      );
      assert.deepStrictEqual(readSessionSnapshot(), {
        camera: {
          permission: "granted",
          stream: null,
        },
        error: "Microphone permission denied.",
        microphone: {
          permission: "denied",
          stream: null,
        },
        speech: createInitialSpeechState(),
        status: "FAILED",
        timer: initialSessionTimerState,
      });
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
      resetSessionStore();
    }
  },
);

test(
  "moves the session into active with retained camera and microphone streams and starts recording",
  async () => {
    const originalNavigator = globalThis.navigator;
    const restoreWindow = installMockMediaRecorder();
    const { stream: cameraStream } = createMockMediaStream();
    const { stream: microphoneStream } = createMockMediaStream();
    const originalDateNow = Date.now;

    MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm;codecs=opus"]);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            if (constraints.video === true && constraints.audio === false) {
              return cameraStream;
            }

            if (constraints.audio === true && constraints.video === false) {
              return microphoneStream;
            }

            throw new Error("Unexpected media constraints.");
          },
        },
      },
    });

    resetSessionStore();
    Date.now = () => 15_000;

    try {
      await useSessionStore.getState().requestStart();
      const snapshot = readSessionSnapshot();
      const mediaRecorder = MockMediaRecorder.lastInstance;

      assert.ok(mediaRecorder instanceof MockMediaRecorder);
      assert.deepStrictEqual(
        {
          camera: snapshot.camera,
          error: snapshot.error,
          microphone: snapshot.microphone,
          speech: useSessionStore.getState().speech,
          status: snapshot.status,
        },
        {
          camera: {
            permission: "granted",
            stream: cameraStream,
          },
          error: null,
          microphone: {
            permission: "granted",
            stream: microphoneStream,
          },
          speech: {
            ...initialTranscriptState,
            audioBlob: null,
            recordingError: null,
            recordingMimeType: "audio/webm;codecs=opus",
            recordingStatus: "recording",
          },
          status: "ACTIVE",
        },
      );
      assert.deepStrictEqual(snapshot.timer, {
        elapsedMs: 0,
        startedAt: 15_000,
      });
    } finally {
      Date.now = originalDateNow;
      stopWebcamStream(useSessionStore.getState().camera.stream);
      stopMicrophoneStream(useSessionStore.getState().microphone.stream);
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
      restoreWindow();
      resetSessionStore();
    }
  },
);

test("stops recording on stop request and retains the recorded Blob", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: cameraStream } = createMockMediaStream();
  const { stream: microphoneStream } = createMockMediaStream();

  MockMediaRecorder.deferStop = true;
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            return cameraStream;
          }

          if (constraints.audio === true && constraints.video === false) {
            return microphoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const mediaRecorder = MockMediaRecorder.lastInstance;

    assert.ok(mediaRecorder instanceof MockMediaRecorder);
    mediaRecorder.emitData(new Blob(["steady pacing"], { type: "audio/webm" }));

    const stopPromise = useSessionStore.getState().requestStop();

    assert.equal(useSessionStore.getState().status, "STOPPING");
    assert.equal(mediaRecorder.stopCalls, 1);
    assert.equal(useSessionStore.getState().speech.recordingStatus, "recording");

    mediaRecorder.emitStop();
    await stopPromise;

    const speech = useSessionStore.getState().speech;

    assert.equal(useSessionStore.getState().status, "COMPLETED");
    assert.equal(speech.recordingStatus, "recorded");
    assert.equal(speech.recordingMimeType, "audio/webm");
    assert.equal(await speech.audioBlob?.text(), "steady pacing");
  } finally {
    stopWebcamStream(useSessionStore.getState().camera.stream);
    stopMicrophoneStream(useSessionStore.getState().microphone.stream);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("keeps reset state intact when an old recorder completes after failure teardown", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: cameraStream } = createMockMediaStream();
  const { stream: microphoneStream } = createMockMediaStream();

  MockMediaRecorder.deferStop = true;
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            return cameraStream;
          }

          if (constraints.audio === true && constraints.video === false) {
            return microphoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const mediaRecorder = MockMediaRecorder.lastInstance;
    assert.ok(mediaRecorder instanceof MockMediaRecorder);

    mediaRecorder.emitData(new Blob(["stale audio"], { type: "audio/webm" }));
    useSessionStore
      .getState()
      .failActive("Recording infrastructure disconnected.");
    useSessionStore.getState().reset();

    assert.deepStrictEqual(readSessionSnapshot(), {
      camera: initialCameraState,
      error: null,
      microphone: initialMicrophoneState,
      speech: createInitialSpeechState(),
      status: "IDLE",
      timer: initialSessionTimerState,
    });

    mediaRecorder.emitStop();

    assert.deepStrictEqual(readSessionSnapshot(), {
      camera: initialCameraState,
      error: null,
      microphone: initialMicrophoneState,
      speech: createInitialSpeechState(),
      status: "IDLE",
      timer: initialSessionTimerState,
    });
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("keeps failed session state intact when an old recorder completes later", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: cameraStream } = createMockMediaStream();
  const { stream: microphoneStream } = createMockMediaStream();

  MockMediaRecorder.deferStop = true;
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            return cameraStream;
          }

          if (constraints.audio === true && constraints.video === false) {
            return microphoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const mediaRecorder = MockMediaRecorder.lastInstance;
    assert.ok(mediaRecorder instanceof MockMediaRecorder);

    mediaRecorder.emitData(new Blob(["stale audio"], { type: "audio/webm" }));
    useSessionStore.getState().failActive("Recording infrastructure disconnected.");

    assert.deepStrictEqual(
      {
        error: useSessionStore.getState().error,
        speech: useSessionStore.getState().speech,
        status: useSessionStore.getState().status,
      },
      {
        error: "Recording infrastructure disconnected.",
        speech: {
          ...initialTranscriptState,
          audioBlob: null,
          recordingError: "Audio recording stopped before completion.",
          recordingMimeType: "audio/webm",
          recordingStatus: "failed",
        },
        status: "FAILED",
      },
    );

    mediaRecorder.emitStop();

    assert.deepStrictEqual(
      {
        error: useSessionStore.getState().error,
        speech: useSessionStore.getState().speech,
        status: useSessionStore.getState().status,
      },
      {
        error: "Recording infrastructure disconnected.",
        speech: {
          ...initialTranscriptState,
          audioBlob: null,
          recordingError: "Audio recording stopped before completion.",
          recordingMimeType: "audio/webm",
          recordingStatus: "failed",
        },
        status: "FAILED",
      },
    );
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("allows a new recording to start while the previous recorder stop is still pending", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: firstCameraStream } = createMockMediaStream();
  const { stream: firstMicrophoneStream } = createMockMediaStream();
  const { stream: secondCameraStream } = createMockMediaStream();
  const { stream: secondMicrophoneStream } = createMockMediaStream();
  let requestCount = 0;

  MockMediaRecorder.deferStop = true;
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          const isCameraRequest =
            constraints.video === true && constraints.audio === false;
          const isMicrophoneRequest =
            constraints.audio === true && constraints.video === false;

          if (isCameraRequest) {
            requestCount += 1;

            return requestCount === 1 ? firstCameraStream : secondCameraStream;
          }

          if (isMicrophoneRequest) {
            return requestCount === 1
              ? firstMicrophoneStream
              : secondMicrophoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const firstRecorder = MockMediaRecorder.instances[0];
    assert.ok(firstRecorder instanceof MockMediaRecorder);

    useSessionStore
      .getState()
      .failActive("Recording infrastructure disconnected.");
    useSessionStore.getState().reset();
    await useSessionStore.getState().requestStart();

    const secondRecorder = MockMediaRecorder.instances[1];
    assert.ok(secondRecorder instanceof MockMediaRecorder);
    assert.equal(MockMediaRecorder.instances.length, 2);
    assert.notEqual(firstRecorder, secondRecorder);
    assert.equal(useSessionStore.getState().status, "ACTIVE");
    assert.equal(useSessionStore.getState().speech.recordingStatus, "recording");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("ignores stale recorder completion after a replacement recorder becomes active", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: firstCameraStream } = createMockMediaStream();
  const { stream: firstMicrophoneStream } = createMockMediaStream();
  const { stream: secondCameraStream } = createMockMediaStream();
  const { stream: secondMicrophoneStream } = createMockMediaStream();
  let requestCount = 0;

  MockMediaRecorder.deferStop = true;
  MockMediaRecorder.supportedMimeTypes = new Set(["audio/webm"]);

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          const isCameraRequest =
            constraints.video === true && constraints.audio === false;
          const isMicrophoneRequest =
            constraints.audio === true && constraints.video === false;

          if (isCameraRequest) {
            requestCount += 1;

            return requestCount === 1 ? firstCameraStream : secondCameraStream;
          }

          if (isMicrophoneRequest) {
            return requestCount === 1
              ? firstMicrophoneStream
              : secondMicrophoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const firstRecorder = MockMediaRecorder.instances[0];
    assert.ok(firstRecorder instanceof MockMediaRecorder);
    firstRecorder.emitData(new Blob(["old audio"], { type: "audio/webm" }));

    useSessionStore
      .getState()
      .failActive("Recording infrastructure disconnected.");
    useSessionStore.getState().reset();
    await useSessionStore.getState().requestStart();

    const secondRecorder = MockMediaRecorder.instances[1];
    assert.ok(secondRecorder instanceof MockMediaRecorder);

    firstRecorder.emitStop();

    assert.deepStrictEqual(
      {
        speech: useSessionStore.getState().speech,
        status: useSessionStore.getState().status,
      },
      {
        speech: {
          ...initialTranscriptState,
          audioBlob: null,
          recordingError: null,
          recordingMimeType: "audio/webm",
          recordingStatus: "recording",
        },
        status: "ACTIVE",
      },
    );

    secondRecorder.emitData(new Blob(["fresh audio"], { type: "audio/webm" }));

    const stopPromise = useSessionStore.getState().requestStop();
    secondRecorder.emitStop();
    await stopPromise;

    assert.equal(useSessionStore.getState().status, "COMPLETED");
    assert.equal(await useSessionStore.getState().speech.audioBlob?.text(), "fresh audio");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("marks the speech slice as failed when MediaRecorder is unavailable", async () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = "window" in globalThis ? globalThis.window : undefined;
  const { stream: cameraStream } = createMockMediaStream();
  const { stream: microphoneStream } = createMockMediaStream();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            return cameraStream;
          }

          if (constraints.audio === true && constraints.video === false) {
            return microphoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    assert.deepStrictEqual(
      {
        error: useSessionStore.getState().error,
        speech: useSessionStore.getState().speech,
        status: useSessionStore.getState().status,
      },
      {
        error: null,
        speech: {
          ...initialTranscriptState,
          audioBlob: null,
          recordingError: "Audio recording is unavailable in this browser.",
          recordingMimeType: null,
          recordingStatus: "failed",
        },
        status: "ACTIVE",
      },
    );
  } finally {
    stopWebcamStream(useSessionStore.getState().camera.stream);
    stopMicrophoneStream(useSessionStore.getState().microphone.stream);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    resetSessionStore();
  }
});

test("handles runtime recorder errors without failing the session lifecycle", async () => {
  const originalNavigator = globalThis.navigator;
  const restoreWindow = installMockMediaRecorder();
  const { stream: cameraStream } = createMockMediaStream();
  const { stream: microphoneStream } = createMockMediaStream();

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            return cameraStream;
          }

          if (constraints.audio === true && constraints.video === false) {
            return microphoneStream;
          }

          throw new Error("Unexpected media constraints.");
        },
      },
    },
  });

  resetSessionStore();

  try {
    await useSessionStore.getState().requestStart();

    const mediaRecorder = MockMediaRecorder.lastInstance;

    assert.ok(mediaRecorder instanceof MockMediaRecorder);
    mediaRecorder.emitError({
      message: "Recorder disconnected.",
    });

    assert.deepStrictEqual(
      {
        error: useSessionStore.getState().error,
        speech: useSessionStore.getState().speech,
        status: useSessionStore.getState().status,
      },
      {
        error: null,
        speech: {
          ...initialTranscriptState,
          audioBlob: null,
          recordingError: "Recorder disconnected.",
          recordingMimeType: null,
          recordingStatus: "failed",
        },
        status: "ACTIVE",
      },
    );
  } finally {
    stopWebcamStream(useSessionStore.getState().camera.stream);
    stopMicrophoneStream(useSessionStore.getState().microphone.stream);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    restoreWindow();
    resetSessionStore();
  }
});

test("stops the timer as soon as the session leaves active", async () => {
  const { stream: cameraStream, tracks: cameraTracks } = createMockMediaStream();
  const { stream: microphoneStream, tracks: microphoneTracks } =
    createMockMediaStream();
  const originalDateNow = Date.now;

  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream: cameraStream,
    },
    microphone: {
      permission: "granted",
      stream: microphoneStream,
    },
    speech: createInitialSpeechState(),
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 10_000,
    },
  });

  Date.now = () => 18_250;

  try {
    await useSessionStore.getState().requestStop();
  } finally {
    Date.now = originalDateNow;
  }

  assert.deepStrictEqual(
    cameraTracks.map((track) => track.stopCalled),
    [true],
  );
  assert.deepStrictEqual(
    microphoneTracks.map((track) => track.stopCalled),
    [true],
  );
  assert.deepStrictEqual(readSessionSnapshot(), {
    camera: {
      permission: "granted",
      stream: null,
    },
    error: null,
    microphone: {
      permission: "granted",
      stream: null,
    },
    speech: createInitialSpeechState(),
    status: "COMPLETED",
    timer: {
      elapsedMs: 8_250,
      startedAt: null,
    },
  });

  resetSessionStore();
});

test("finalizes elapsed time when an active session fails", () => {
  const originalDateNow = Date.now;

  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream: null,
    },
    microphone: {
      permission: "granted",
      stream: null,
    },
    speech: createInitialSpeechState(),
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 4_000,
    },
  });

  Date.now = () => 9_600;

  try {
    useSessionStore.getState().failActive("Recording infrastructure disconnected.");
  } finally {
    Date.now = originalDateNow;
  }

  assert.deepStrictEqual(readSessionSnapshot(), {
    camera: {
      permission: "granted",
      stream: null,
    },
    error: "Recording infrastructure disconnected.",
    microphone: {
      permission: "granted",
      stream: null,
    },
    speech: createInitialSpeechState(),
    status: "FAILED",
    timer: {
      elapsedMs: 5_600,
      startedAt: null,
    },
  });

  resetSessionStore();
});

test("stops retained camera and microphone streams when the session completes", async () => {
  const { stream: cameraStream, tracks: cameraTracks } = createMockMediaStream();
  const { stream: microphoneStream, tracks: microphoneTracks } =
    createMockMediaStream();
  const originalDateNow = Date.now;

  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream: cameraStream,
    },
    microphone: {
      permission: "granted",
      stream: microphoneStream,
    },
    speech: createInitialSpeechState(),
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 2_000,
    },
  });

  Date.now = () => 7_000;

  try {
    await useSessionStore.getState().requestStop();
  } finally {
    Date.now = originalDateNow;
  }

  assert.deepStrictEqual(
    cameraTracks.map((track) => track.stopCalled),
    [true],
  );
  assert.deepStrictEqual(
    microphoneTracks.map((track) => track.stopCalled),
    [true],
  );
  assert.deepStrictEqual(readSessionSnapshot(), {
    camera: {
      permission: "granted",
      stream: null,
    },
    error: null,
    microphone: {
      permission: "granted",
      stream: null,
    },
    speech: createInitialSpeechState(),
    status: "COMPLETED",
    timer: {
      elapsedMs: 5_000,
      startedAt: null,
    },
  });

  resetSessionStore();
});
