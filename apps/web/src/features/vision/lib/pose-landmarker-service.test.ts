import assert from "node:assert/strict";
import test from "node:test";

import { createPoseLandmarkerService } from "@/features/vision/lib/pose-landmarker-service";

import {
  MockVisionVideoElement,
  createMockMediaStream,
  createMockVisionBrowserEnvironment,
  createMockVisionTasksModule,
  createNormalizedLandmark,
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

test("initializes the pose landmarker and stores detected pose landmarks", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();
  let closeCallCount = 0;

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createPoseLandmarker: () => ({
          close: () => {
            closeCallCount += 1;
          },
          detectForVideo: () => ({
            close: () => {},
            landmarks: [[createNormalizedLandmark()]],
            segmentationMasks: undefined,
            worldLandmarks: [],
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
    poseLandmarks: [
      {
        visibility: 0.95,
        x: 0.1,
        y: 0.2,
        z: 0.3,
      },
    ],
    serviceStatus: "running",
    updatedAtMs: 1_000,
  });

  service.stop();

  assert.equal(closeCallCount, 1);
  assert.equal(browser.videoElement.pauseCallCount, 1);
  assert.equal(service.getLatestResult().serviceStatus, "stopped");
});

test("stores a model load failure when the pose landmarker initialization fails", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createPoseLandmarker: () => {
          throw new Error("Pose task bundle missing.");
        },
      }),
  });

  await service.start({
    stream,
  });

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: {
      code: "pose_model_load_failed",
      message: "Pose task bundle missing.",
    },
    poseLandmarks: [],
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("marks the pose landmarker as failed when the camera stream is unavailable", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream({
    readyState: "ended",
  });

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
  });

  await service.start({
    stream,
  });

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "awaiting_input",
    error: {
      code: "camera_unavailable",
      message: "Camera stream is unavailable for pose landmark detection.",
    },
    poseLandmarks: [],
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("stores a no-pose-detected result when MediaPipe returns no pose landmarks", async () => {
  const browser = createMockVisionBrowserEnvironment();
  const { stream } = createMockMediaStream();

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createPoseLandmarker: () => ({
          close: () => {},
          detectForVideo: () => ({
            close: () => {},
            landmarks: [],
            segmentationMasks: undefined,
            worldLandmarks: [],
          }),
        }),
      }),
  });

  await service.start({
    stream,
  });
  browser.advanceFrame();

  assert.deepStrictEqual(service.getLatestResult(), {
    detectionStatus: "no_pose_detected",
    error: null,
    poseLandmarks: [],
    serviceStatus: "running",
    updatedAtMs: 1_000,
  });
});

test("reports camera unavailability when the pose video element cannot start playing", async () => {
  const videoElement = new MockVisionVideoElement();
  const browser = createMockVisionBrowserEnvironment({
    videoElement,
  });
  const { stream } = createMockMediaStream();

  videoElement.playError = new Error("Video playback failed.");

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createPoseLandmarker: () => ({
          close: () => {},
          detectForVideo: () => ({
            close: () => {},
            landmarks: [],
            segmentationMasks: undefined,
            worldLandmarks: [],
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
    poseLandmarks: [],
    serviceStatus: "failed",
    updatedAtMs: 1_000,
  });
});

test("ignores a late play rejection after stop while pose initialization is still pending", async () => {
  const videoElement = new MockVisionVideoElement();
  const browser = createMockVisionBrowserEnvironment({
    videoElement,
  });
  const { stream } = createMockMediaStream();
  const playDeferred = createDeferred();
  let closeCallCount = 0;

  videoElement.playResult = playDeferred.promise;

  const service = createPoseLandmarkerService({
    browserEnvironment: browser.environment,
    loadTasksModule: async () =>
      createMockVisionTasksModule({
        createPoseLandmarker: () => ({
          close: () => {
            closeCallCount += 1;
          },
          detectForVideo: () => ({
            close: () => {},
            landmarks: [],
            segmentationMasks: undefined,
            worldLandmarks: [],
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
    poseLandmarks: [],
    serviceStatus: "stopped",
    updatedAtMs: 1_000,
  });
  assert.equal(closeCallCount, 1);
  assert.equal(videoElement.pauseCallCount, 1);
});
