import assert from "node:assert/strict";
import test from "node:test";

import { createVisionServices } from "@/features/vision/lib/vision-services";
import { initialSessionState } from "@/features/session/lib/session-state-machine";
import { initialSessionTimerState } from "@/features/session/lib/session-timer";
import { initialMicrophoneState } from "@/features/session/lib/microphone-permission";
import { initialCameraState, stopWebcamStream } from "@/features/session/lib/webcam-permission";
import { initialSpeechRecordingState } from "@/features/speech/lib/media-recorder";
import { useSessionStore } from "@/stores/session-store";
import {
  createInitialFaceLandmarkerLatestResult,
  createInitialPoseLandmarkerLatestResult,
  type FaceLandmarkerLatestResult,
  type PoseLandmarkerLatestResult,
} from "@/types/vision";

type MockVisionService<TLatestResult> = {
  latestResult: TLatestResult;
  service: {
    getLatestResult: () => TLatestResult;
    start: (options: {
      stream: MediaStream;
    }) => Promise<void>;
    stop: () => void;
  };
  startCalls: Array<{
    statusAtStart: string;
    stream: MediaStream;
  }>;
  stopCallCount: number;
};

function createMockMediaStream(): MediaStream {
  const track = {
    readyState: "live",
    stop: () => {},
  } as unknown as MediaStreamTrack;

  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
}

function createInitialSpeechState() {
  return {
    ...initialSpeechRecordingState,
    processingError: null,
    processingStatus: "idle" as const,
    transcript: null,
  };
}

function createMockVisionService<TLatestResult>(options: {
  latestResult: TLatestResult;
  nextRunningResult: TLatestResult;
}): MockVisionService<TLatestResult> {
  let latestResult = options.latestResult;
  const startCalls: Array<{
    statusAtStart: string;
    stream: MediaStream;
  }> = [];
  let stopCallCount = 0;

  return {
    get latestResult() {
      return latestResult;
    },
    service: {
      getLatestResult: () => latestResult,
      start: async ({ stream }) => {
        startCalls.push({
          statusAtStart: useSessionStore.getState().status,
          stream,
        });
        latestResult = options.nextRunningResult;
      },
      stop: () => {
        stopCallCount += 1;
      },
    },
    startCalls,
    get stopCallCount() {
      return stopCallCount;
    },
  };
}

function resetSessionStore() {
  useSessionStore.getState().setSpeechTranscriptionRequester(null);
  useSessionStore.getState().setVisionServicesFactory(createVisionServices);

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

test("initializes face and pose landmarkers before the session becomes active", async () => {
  const originalNavigator = globalThis.navigator;
  const cameraStream = createMockMediaStream();
  const microphoneStream = createMockMediaStream();
  const faceService = createMockVisionService<FaceLandmarkerLatestResult>({
    latestResult: createInitialFaceLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialFaceLandmarkerLatestResult(),
      serviceStatus: "running",
      updatedAtMs: 1,
    },
  });
  const poseService = createMockVisionService<PoseLandmarkerLatestResult>({
    latestResult: createInitialPoseLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialPoseLandmarkerLatestResult(),
      serviceStatus: "running",
      updatedAtMs: 1,
    },
  });
  let mediaRequestCount = 0;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          if (constraints.video === true && constraints.audio === false) {
            mediaRequestCount += 1;
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
  useSessionStore.getState().setVisionServicesFactory(() => ({
    faceLandmarker: faceService.service,
    poseLandmarker: poseService.service,
  }));

  try {
    await useSessionStore.getState().requestStart();

    assert.equal(useSessionStore.getState().status, "ACTIVE");
    assert.equal(mediaRequestCount, 1);
    assert.deepStrictEqual(faceService.startCalls, [
      {
        statusAtStart: "STARTING",
        stream: cameraStream,
      },
    ]);
    assert.deepStrictEqual(poseService.startCalls, [
      {
        statusAtStart: "STARTING",
        stream: cameraStream,
      },
    ]);
    assert.equal(
      useSessionStore.getState().getLatestFaceLandmarkerResult().serviceStatus,
      "running",
    );
    assert.equal(
      useSessionStore.getState().getLatestPoseLandmarkerResult().serviceStatus,
      "running",
    );
  } finally {
    stopWebcamStream(useSessionStore.getState().camera.stream);
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    resetSessionStore();
  }
});

test("moves the session into failed when face landmarker initialization fails", async () => {
  const originalNavigator = globalThis.navigator;
  const cameraStream = createMockMediaStream();
  const microphoneStream = createMockMediaStream();
  const faceService = createMockVisionService<FaceLandmarkerLatestResult>({
    latestResult: createInitialFaceLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialFaceLandmarkerLatestResult(),
      error: {
        code: "face_model_load_failed",
        message: "Face landmarker model failed to load.",
      },
      serviceStatus: "failed",
      updatedAtMs: 1,
    },
  });
  const poseService = createMockVisionService<PoseLandmarkerLatestResult>({
    latestResult: createInitialPoseLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialPoseLandmarkerLatestResult(),
      serviceStatus: "running",
      updatedAtMs: 1,
    },
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
  useSessionStore.getState().setVisionServicesFactory(() => ({
    faceLandmarker: faceService.service,
    poseLandmarker: poseService.service,
  }));

  try {
    await useSessionStore.getState().requestStart();

    assert.deepStrictEqual(
      {
        camera: useSessionStore.getState().camera,
        error: useSessionStore.getState().error,
        microphone: useSessionStore.getState().microphone,
        status: useSessionStore.getState().status,
      },
      {
        camera: {
          permission: "granted",
          stream: null,
        },
        error: "Face landmarker model failed to load.",
        microphone: {
          permission: "granted",
          stream: null,
        },
        status: "FAILED",
      },
    );
    assert.ok(faceService.stopCallCount >= 2);
    assert.ok(poseService.stopCallCount >= 2);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    resetSessionStore();
  }
});

test("moves the session into failed when pose landmarker initialization fails", async () => {
  const originalNavigator = globalThis.navigator;
  const cameraStream = createMockMediaStream();
  const microphoneStream = createMockMediaStream();
  const faceService = createMockVisionService<FaceLandmarkerLatestResult>({
    latestResult: createInitialFaceLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialFaceLandmarkerLatestResult(),
      serviceStatus: "running",
      updatedAtMs: 1,
    },
  });
  const poseService = createMockVisionService<PoseLandmarkerLatestResult>({
    latestResult: createInitialPoseLandmarkerLatestResult(),
    nextRunningResult: {
      ...createInitialPoseLandmarkerLatestResult(),
      error: {
        code: "pose_model_load_failed",
        message: "Pose landmarker model failed to load.",
      },
      serviceStatus: "failed",
      updatedAtMs: 1,
    },
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
  useSessionStore.getState().setVisionServicesFactory(() => ({
    faceLandmarker: faceService.service,
    poseLandmarker: poseService.service,
  }));

  try {
    await useSessionStore.getState().requestStart();

    assert.deepStrictEqual(
      {
        camera: useSessionStore.getState().camera,
        error: useSessionStore.getState().error,
        microphone: useSessionStore.getState().microphone,
        status: useSessionStore.getState().status,
      },
      {
        camera: {
          permission: "granted",
          stream: null,
        },
        error: "Pose landmarker model failed to load.",
        microphone: {
          permission: "granted",
          stream: null,
        },
        status: "FAILED",
      },
    );
    assert.ok(faceService.stopCallCount >= 2);
    assert.ok(poseService.stopCallCount >= 2);
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    resetSessionStore();
  }
});

test("stops face and pose landmarker processing when the session stops", async () => {
  const faceService = createMockVisionService<FaceLandmarkerLatestResult>({
    latestResult: createInitialFaceLandmarkerLatestResult(),
    nextRunningResult: createInitialFaceLandmarkerLatestResult(),
  });
  const poseService = createMockVisionService<PoseLandmarkerLatestResult>({
    latestResult: createInitialPoseLandmarkerLatestResult(),
    nextRunningResult: createInitialPoseLandmarkerLatestResult(),
  });

  resetSessionStore();
  useSessionStore.getState().setVisionServicesFactory(() => ({
    faceLandmarker: faceService.service,
    poseLandmarker: poseService.service,
  }));
  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream: createMockMediaStream(),
    },
    microphone: {
      permission: "granted",
      stream: createMockMediaStream(),
    },
    speech: createInitialSpeechState(),
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 4_000,
    },
  });

  await useSessionStore.getState().requestStop();

  assert.equal(faceService.stopCallCount, 1);
  assert.equal(poseService.stopCallCount, 1);
  assert.equal(useSessionStore.getState().status, "COMPLETED");

  resetSessionStore();
});

test("stops face and pose landmarker processing when the active session fails", () => {
  const faceService = createMockVisionService<FaceLandmarkerLatestResult>({
    latestResult: createInitialFaceLandmarkerLatestResult(),
    nextRunningResult: createInitialFaceLandmarkerLatestResult(),
  });
  const poseService = createMockVisionService<PoseLandmarkerLatestResult>({
    latestResult: createInitialPoseLandmarkerLatestResult(),
    nextRunningResult: createInitialPoseLandmarkerLatestResult(),
  });

  resetSessionStore();
  useSessionStore.getState().setVisionServicesFactory(() => ({
    faceLandmarker: faceService.service,
    poseLandmarker: poseService.service,
  }));
  useSessionStore.setState({
    ...useSessionStore.getInitialState(),
    camera: {
      permission: "granted",
      stream: createMockMediaStream(),
    },
    microphone: {
      permission: "granted",
      stream: createMockMediaStream(),
    },
    speech: createInitialSpeechState(),
    status: "ACTIVE",
    timer: {
      elapsedMs: 0,
      startedAt: 10_000,
    },
  });

  useSessionStore
    .getState()
    .failActive("Vision processing dependencies were interrupted.");

  assert.equal(faceService.stopCallCount, 1);
  assert.equal(poseService.stopCallCount, 1);
  assert.equal(useSessionStore.getState().status, "FAILED");

  resetSessionStore();
});
