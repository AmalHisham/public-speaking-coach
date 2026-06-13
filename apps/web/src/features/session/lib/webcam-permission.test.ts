import assert from "node:assert/strict";
import test from "node:test";

import { initialSessionState } from "@/features/session/lib/session-state-machine";
import { initialSessionTimerState } from "@/features/session/lib/session-timer";
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

function createPermissionDeniedError() {
  const error = new Error("Permission denied.");
  error.name = "NotAllowedError";
  return error;
}

function resetSessionStore() {
  useSessionStore.setState({
    ...initialSessionState,
    camera: initialCameraState,
    microphone: initialMicrophoneState,
    timer: initialSessionTimerState,
  });
}

function readSessionSnapshot() {
  const { camera, error, microphone, status, timer } = useSessionStore.getState();

  return {
    camera,
    error,
    microphone,
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
  "moves the session into active with retained camera and microphone streams",
  async () => {
    const originalNavigator = globalThis.navigator;
    const { stream: cameraStream } = createMockMediaStream();
    const { stream: microphoneStream } = createMockMediaStream();
    const originalDateNow = Date.now;

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

      assert.deepStrictEqual(
        {
          camera: snapshot.camera,
          error: snapshot.error,
          microphone: snapshot.microphone,
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
      resetSessionStore();
    }
  },
);

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
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 4_000,
    },
  });

  Date.now = () => 9_600;

  try {
    useSessionStore.getState().failActive("Speech recognition disconnected.");
  } finally {
    Date.now = originalDateNow;
  }

  assert.deepStrictEqual(readSessionSnapshot(), {
    camera: {
      permission: "granted",
      stream: null,
    },
    error: "Speech recognition disconnected.",
    microphone: {
      permission: "granted",
      stream: null,
    },
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
    status: "COMPLETED",
    timer: {
      elapsedMs: 5_000,
      startedAt: null,
    },
  });

  resetSessionStore();
});
