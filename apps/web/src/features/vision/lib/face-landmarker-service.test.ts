import assert from "node:assert/strict";
import test from "node:test";

import { createFaceLandmarkerService } from "@/features/vision/lib/face-landmarker-service";

import {
  MockVisionVideoElement,
  createMockMediaStream,
  createMockVisionBrowserEnvironment,
  createMockVisionTasksModule,
  createNormalizedLandmark,
  createTransformationMatrix,
} from "./vision-test-helpers";

function createDeferred() {
  let reject: (reason?: unknown) => void = () => {};
  let resolve: () => void = () => {};
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

test("initializes the face landmarker and stores detected landmarks", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();
  let closeCallCount = 0;

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createFaceLandmarker: () => ({
          close: () => {
            closeCallCount += 1;
          },
          detectForVideo: () => ({
            faceBlendshapes: [],
            faceLandmarks: [[createNormalizedLandmark()]],
            facialTransformationMatrixes: [createTransformationMatrix()],
          }),
        }),
      }),
  });

  await service.start({
    stream,
  });

  assert.equal(service.getLatestResult().serviceStatus, "running");
  assert.equal(service.getLatestResult().detectionStatus, "awaiting_input");

  browser.advanceFrame();

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "detected",
    error: null,
    faceLandmarks: [
      {
        visibility: 0.95,
        x: 0.1,
        y: 0.2,
        z: 0.3,
      },
    ],
    facialTransformationMatrix: {
      columns: 4,
      data: Array.from({ length: 16 }, (_, index) => index + 1),
      rows: 4,
    },
    serviceStatus: "running",
    updatedAtMs: 1_000,
  });

  service.stop();

  assert.equal(closeCallCount, 1);
  assert.equal(browser.videoElement.pauseCallCount, 1);
  assert.equal(service.getLatestResult().serviceStatus, "stopped");
});

test("stores a model load failure when the face landmarker initialization fails", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createFaceLandmarker: () => {
          throw new Error("Face task bundle missing.");
        },
      }),
  });

  await service.start({
    stream,
  });

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: {
      code: "face_model_load_failed",
      message: "Face task bundle missing.",
    },
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("marks the face landmarker as failed when the camera stream is unavailable", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream({
    readyState: "ended",
  });

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
  });

  await service.start({
    stream,
  });

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: {
      code: "camera_unavailable",
      message: "Camera stream is unavailable for face landmark detection.",
    },
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("stores a no-face-detected result when MediaPipe returns no face landmarks", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createFaceLandmarker: () => ({
          close: () => {},
          detectForVideo: () => ({
            faceBlendshapes: [],
            faceLandmarks: [],
            facialTransformationMatrixes: [],
          }),
        }),
      }),
  });

  await service.start({
    stream,
  });
  browser.advanceFrame();

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "no_face_detected",
    error: null,
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "running",
    updatedAtMs: 1_000,
  });
});

test("reports camera unavailability when the face video element cannot start playing", async () => {
  const videoElement = new MockVisionVideoElement();
  const browser = createMockVisionBrowserEnvironment({
    videoElement,
  });
  const { stream } = createMockMediaStream();

  videoElement.playError = new Error("Video playback failed.");

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createFaceLandmarker: () => ({
          close: () => {},
          detectForVideo: () => ({
            faceBlendshapes: [],
            faceLandmarks: [],
            facialTransformationMatrixes: [],
          }),
        }),
      }),
  });

  await service.start({
    stream,
  });

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: {
      code: "camera_unavailable",
      message: "Video playback failed.",
    },
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("ignores a late play rejection after stop while face initialization is still pending", async () => {
  const videoElement = new MockVisionVideoElement();
  const browser = createMockVisionBrowserEnvironment({
    videoElement,
  });
  const { stream } = createMockMediaStream();
  const playDeferred = createDeferred();
  let closeCallCount = 0;

  videoElement.playResult = playDeferred.promise;

  const service = createFaceLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createFaceLandmarker: () => ({
          close: () => {
            closeCallCount += 1;
          },
          detectForVideo: () => ({
            faceBlendshapes: [],
            faceLandmarks: [],
            facialTransformationMatrixes: [],
          }),
        }),
      }),
  });

  const startPromise = service.start({
    stream,
  });

  await flushAsyncWork();
  service.stop();
  playDeferred.reject(new Error("Video playback failed after stop."));
  await startPromise;

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: null,
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "stopped",
    updatedAtMs: 1_000,
  });
  assert.equal(closeCallCount, 1);
  assert.equal(videoElement.pauseCallCount, 1);
});
