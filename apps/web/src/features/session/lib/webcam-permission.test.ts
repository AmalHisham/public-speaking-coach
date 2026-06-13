import assert from "node:assert/strict";
import test from "node:test";

import { initialSessionState } from "@/features/session/lib/session-state-machine";
import { useSessionStore } from "@/stores/session-store";

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

function readSessionSnapshot() {
  const { camera, error, status } = useSessionStore.getState();

  return {
    camera,
    error,
    status,
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

test("maps browser permission denial to a failed start result", async () => {
  const result = await requestWebcamPermission({
    getUserMedia: async () => {
      const error = new Error("Permission denied.");
      error.name = "NotAllowedError";
      throw error;
    },
  });

  assert.deepStrictEqual(result, {
    permission: "denied",
    error: "Camera permission denied.",
    status: "failed",
  });
});

test("stops every track when webcam access is released", () => {
  const { stream, tracks } = createMockMediaStream(2);

  stopWebcamStream(stream);

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
          const error = new Error("Permission denied.");
          error.name = "NotAllowedError";
          throw error;
        },
      },
    },
  });

  useSessionStore.setState({
    ...initialSessionState,
    camera: initialCameraState,
  });

  try {
    await useSessionStore.getState().requestStart();
    assert.deepStrictEqual(readSessionSnapshot(), {
      ...initialSessionState,
      camera: {
        permission: "denied",
        stream: null,
      },
      error: "Camera permission denied.",
      status: "FAILED",
    });
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    useSessionStore.setState({
      ...initialSessionState,
      camera: initialCameraState,
    });
  }
});

test("keeps the session in starting with a retained stream when camera permission is granted", async () => {
  const originalNavigator = globalThis.navigator;
  const { stream } = createMockMediaStream();

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => stream,
      },
    },
  });

  useSessionStore.setState({
    ...initialSessionState,
    camera: initialCameraState,
  });

  try {
    await useSessionStore.getState().requestStart();
    assert.deepStrictEqual(readSessionSnapshot(), {
      ...initialSessionState,
      camera: {
        permission: "granted",
        stream,
      },
      error: null,
      status: "STARTING",
    });
  } finally {
    stopWebcamStream(useSessionStore.getState().camera.stream);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    useSessionStore.setState({
      ...initialSessionState,
      camera: initialCameraState,
    });
  }
});

test("stops the retained camera stream when the session completes", () => {
  const { stream, tracks } = createMockMediaStream();

  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream,
    },
    status: "STOPPING",
  });

  useSessionStore.getState().completeStop();

  assert.deepStrictEqual(
    tracks.map((track) => track.stopCalled),
    [true],
  );
  assert.deepStrictEqual(readSessionSnapshot(), {
    camera: {
      permission: "granted",
      stream: null,
    },
    error: null,
    status: "COMPLETED",
  });

  useSessionStore.setState({
    ...initialSessionState,
    camera: initialCameraState,
  });
});
