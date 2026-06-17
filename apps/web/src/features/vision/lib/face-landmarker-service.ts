"use client";

import type {
  FaceLandmarkerResult,
  FaceLandmarker as MediaPipeFaceLandmarker,
} from "@mediapipe/tasks-vision";

import {
  createInitialFaceLandmarkerLatestResult,
  type FaceLandmarkerLatestResult,
  type FaceLandmarkerService,
} from "@/types/vision";

import {
  MEDIAPIPE_FACE_LANDMARKER_MODEL_ASSET_PATH,
  MEDIAPIPE_WASM_BASE_PATH,
  canReadVideoFrame,
  cleanupVisionVideoElement,
  configureVisionVideoElement,
  copyVisionLandmarks,
  copyVisionTransformationMatrix,
  getDefaultVisionBrowserEnvironment,
  getErrorMessage,
  hasActiveVideoTrack,
  loadVisionTasksModule,
  type VisionBrowserEnvironment,
  type VisionTasksModule,
  type VisionVideoElement,
} from "./vision-service-utils";

type FaceLandmarkerServiceOptions = {
  browserEnvironment?: VisionBrowserEnvironment | null;
  loadTasksModule?: () => Promise<VisionTasksModule>;
  onResult?: (result: FaceLandmarkerLatestResult) => void;
};

function createCameraUnavailableResult(
  message: string,
  updatedAtMs: number,
): FaceLandmarkerLatestResult {
  return {
    ...createInitialFaceLandmarkerLatestResult(),
    error: {
      code: "camera_unavailable",
      message,
    },
    serviceStatus: "failed",
    updatedAtMs,
  };
}

export function createFaceLandmarkerService(
  options: FaceLandmarkerServiceOptions = {},
): FaceLandmarkerService {
  const browserEnvironment =
    options.browserEnvironment ?? getDefaultVisionBrowserEnvironment();
  const loadTasksModule = options.loadTasksModule ?? loadVisionTasksModule;
  const onResult = options.onResult;
  const now = () => browserEnvironment?.now() ?? Date.now();

  let activeRunId = 0;
  let animationFrameHandle: number | null = null;
  let latestResult = createInitialFaceLandmarkerLatestResult();
  let landmarker: MediaPipeFaceLandmarker | null = null;
  let videoElement: VisionVideoElement | null = null;

  const publishResult = (result: FaceLandmarkerLatestResult) => {
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
          ...createInitialFaceLandmarkerLatestResult(),
          error: {
            code: "camera_unavailable",
            message: "Camera stream became unavailable during face landmark detection.",
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
            mapFaceLandmarkerResult(detectionResult, {
              updatedAtMs: now(),
            }),
          );
        } catch (error: unknown) {
          cleanup();
          publishResult({
            ...createInitialFaceLandmarkerLatestResult(),
            error: {
              code: "face_detection_failed",
              message: getErrorMessage(
                error,
                "Face landmark detection failed while processing the camera stream.",
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
        ...createInitialFaceLandmarkerLatestResult(),
        serviceStatus: "starting",
        updatedAtMs: now(),
      });

      if (browserEnvironment === null) {
        publishResult(
          createCameraUnavailableResult(
            "Face landmark detection is unavailable in this browser.",
            now(),
          ),
        );

        return;
      }

      if (!hasActiveVideoTrack(stream)) {
        publishResult(
          createCameraUnavailableResult(
            "Camera stream is unavailable for face landmark detection.",
            now(),
          ),
        );

        return;
      }

      try {
        const tasksModule = await loadTasksModule();
        const wasmFileset =
          await tasksModule.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH);
        const nextLandmarker = await tasksModule.FaceLandmarker.createFromOptions(
          wasmFileset,
          {
            baseOptions: {
              modelAssetPath: MEDIAPIPE_FACE_LANDMARKER_MODEL_ASSET_PATH,
            },
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
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
                "Camera stream is unavailable for face landmark detection.",
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
          ...createInitialFaceLandmarkerLatestResult(),
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
          ...createInitialFaceLandmarkerLatestResult(),
          error: {
            code: "face_model_load_failed",
            message: getErrorMessage(
              error,
              "Face landmarker model failed to load.",
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

function mapFaceLandmarkerResult(
  detectionResult: FaceLandmarkerResult,
  options: {
    updatedAtMs: number;
  },
): FaceLandmarkerLatestResult {
  const [firstFaceLandmarks] = detectionResult.faceLandmarks;
  const [firstFacialTransformationMatrix] =
    detectionResult.facialTransformationMatrixes;

  if (!firstFaceLandmarks) {
    return {
      ...createInitialFaceLandmarkerLatestResult(),
      detectionStatus: "no_face_detected",
      serviceStatus: "running",
      updatedAtMs: options.updatedAtMs,
    };
  }

  return {
    detectionStatus: "detected",
    error: null,
    faceLandmarks: copyVisionLandmarks(firstFaceLandmarks),
    facialTransformationMatrix: copyVisionTransformationMatrix(
      firstFacialTransformationMatrix,
    ),
    serviceStatus: "running",
    updatedAtMs: options.updatedAtMs,
  };
}
