"use client";

import type {
  PoseLandmarker as MediaPipePoseLandmarker,
  PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

import {
  createInitialPoseLandmarkerLatestResult,
  type PoseLandmarkerLatestResult,
  type PoseLandmarkerService,
} from "@/types/vision";

import {
  MEDIAPIPE_POSE_LANDMARKER_MODEL_ASSET_PATH,
  MEDIAPIPE_WASM_BASE_PATH,
  canReadVideoFrame,
  cleanupVisionVideoElement,
  configureVisionVideoElement,
  copyVisionLandmarks,
  getDefaultVisionBrowserEnvironment,
  getErrorMessage,
  hasActiveVideoTrack,
  loadVisionTasksModule,
  type VisionBrowserEnvironment,
  type VisionTasksModule,
  type VisionVideoElement,
} from "./vision-service-utils";

type PoseLandmarkerServiceOptions = {
  browserEnvironment?: VisionBrowserEnvironment | null;
  loadTasksModule?: () => Promise<VisionTasksModule>;
  onResult?: (result: PoseLandmarkerLatestResult) => void;
};

function createCameraUnavailableResult(
  message: string,
  updatedAtMs: number,
): PoseLandmarkerLatestResult {
  return {
    ...createInitialPoseLandmarkerLatestResult(),
    error: {
      code: "camera_unavailable",
      message,
    },
    serviceStatus: "failed",
    updatedAtMs,
  };
}

export function createPoseLandmarkerService(
  options: PoseLandmarkerServiceOptions = {},
): PoseLandmarkerService {
  const browserEnvironment =
    options.browserEnvironment ?? getDefaultVisionBrowserEnvironment();
  const loadTasksModule = options.loadTasksModule ?? loadVisionTasksModule;
  const onResult = options.onResult;
  const now = () => browserEnvironment?.now() ?? Date.now();

  let activeRunId = 0;
  let animationFrameHandle: number | null = null;
  let latestResult = createInitialPoseLandmarkerLatestResult();
  let landmarker: MediaPipePoseLandmarker | null = null;
  let videoElement: VisionVideoElement | null = null;

  const publishResult = (result: PoseLandmarkerLatestResult) => {
    latestResult = result;
    onResult?.(result);
  };

  const cleanup = () => {
    if (animationFrameHandle !== null && browserEnvironment !== null) {
      browserEnvironment.cancelAnimationFrame(animationFrameHandle);
      animationFrameHandle = null;
    }

    landmarker?.close();
    landmarker = null;

    cleanupVisionVideoElement(videoElement);
    videoElement = null;
  };

  const scheduleNextFrame = (runId: number, stream: MediaStream) => {
    if (browserEnvironment === null || landmarker === null || videoElement === null) {
      return;
    }

    animationFrameHandle = browserEnvironment.requestAnimationFrame(() => {
      if (runId !== activeRunId || landmarker === null || videoElement === null) {
        return;
      }

      if (!hasActiveVideoTrack(stream)) {
        cleanup();
        publishResult({
          ...createInitialPoseLandmarkerLatestResult(),
          error: {
            code: "camera_unavailable",
            message: "Camera stream became unavailable during pose landmark detection.",
          },
          serviceStatus: "failed",
          updatedAtMs: now(),
        });

        return;
      }

      if (canReadVideoFrame(videoElement)) {
        try {
          const detectionResult = landmarker.detectForVideo(
            videoElement as HTMLVideoElement,
            now(),
          );

          publishResult(
            mapPoseLandmarkerResult(detectionResult, {
              updatedAtMs: now(),
            }),
          );
        } catch (error: unknown) {
          cleanup();
          publishResult({
            ...createInitialPoseLandmarkerLatestResult(),
            error: {
              code: "pose_detection_failed",
              message: getErrorMessage(
                error,
                "Pose landmark detection failed while processing the camera stream.",
              ),
            },
            serviceStatus: "failed",
            updatedAtMs: now(),
          });

          return;
        }
      }

      scheduleNextFrame(runId, stream);
    });
  };

  return {
    getLatestResult: () => latestResult,
    start: async ({ stream }) => {
      activeRunId += 1;
      const runId = activeRunId;

      cleanup();

      publishResult({
        ...createInitialPoseLandmarkerLatestResult(),
        serviceStatus: "starting",
        updatedAtMs: now(),
      });

      if (browserEnvironment === null) {
        publishResult(
          createCameraUnavailableResult(
            "Pose landmark detection is unavailable in this browser.",
            now(),
          ),
        );

        return;
      }

      if (!hasActiveVideoTrack(stream)) {
        publishResult(
          createCameraUnavailableResult(
            "Camera stream is unavailable for pose landmark detection.",
            now(),
          ),
        );

        return;
      }

      try {
        const tasksModule = await loadTasksModule();
        const wasmFileset =
          await tasksModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH);
        const nextLandmarker = await tasksModule.PoseLandmarker.createFromOptions(
          wasmFileset,
          {
            baseOptions: {
              modelAssetPath: MEDIAPIPE_POSE_LANDMARKER_MODEL_ASSET_PATH,
            },
            numPoses: 1,
            runningMode: "VIDEO",
          },
        );

        if (runId !== activeRunId) {
          nextLandmarker.close();
          return;
        }

        const nextVideoElement = browserEnvironment.createVideoElement();

        configureVisionVideoElement(nextVideoElement, stream);

        try {
          await nextVideoElement.play();
        } catch (error: unknown) {
          nextLandmarker.close();
          cleanupVisionVideoElement(nextVideoElement);

          if (runId !== activeRunId) {
            return;
          }

          publishResult(
            createCameraUnavailableResult(
              getErrorMessage(
                error,
                "Camera stream is unavailable for pose landmark detection.",
              ),
              now(),
            ),
          );

          return;
        }

        if (runId !== activeRunId) {
          nextLandmarker.close();
          cleanupVisionVideoElement(nextVideoElement);
          return;
        }

        landmarker = nextLandmarker;
        videoElement = nextVideoElement;

        publishResult({
          ...createInitialPoseLandmarkerLatestResult(),
          serviceStatus: "running",
          updatedAtMs: now(),
        });

        scheduleNextFrame(runId, stream);
      } catch (error: unknown) {
        if (runId !== activeRunId) {
          return;
        }

        cleanup();
        publishResult({
          ...createInitialPoseLandmarkerLatestResult(),
          error: {
            code: "pose_model_load_failed",
            message: getErrorMessage(
              error,
              "Pose landmarker model failed to load.",
            ),
          },
          serviceStatus: "failed",
          updatedAtMs: now(),
        });
      }
    },
    stop: () => {
      activeRunId += 1;
      cleanup();

      publishResult({
        ...latestResult,
        serviceStatus: "stopped",
        updatedAtMs: now(),
      });
    },
  };
}

function mapPoseLandmarkerResult(
  detectionResult: PoseLandmarkerResult,
  options: {
    updatedAtMs: number;
  },
): PoseLandmarkerLatestResult {
  const [firstPoseLandmarks] = detectionResult.landmarks;

  if (!firstPoseLandmarks) {
    return {
      ...createInitialPoseLandmarkerLatestResult(),
      detectionStatus: "no_pose_detected",
      serviceStatus: "running",
      updatedAtMs: options.updatedAtMs,
    };
  }

  return {
    detectionStatus: "detected",
    error: null,
    poseLandmarks: copyVisionLandmarks(firstPoseLandmarks),
    serviceStatus: "running",
    updatedAtMs: options.updatedAtMs,
  };
}
