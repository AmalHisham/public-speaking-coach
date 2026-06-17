import type {
  Matrix,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type {
  VisionLandmark,
  VisionTransformationMatrix,
} from "@/types/vision";

export const MEDIAPIPE_WASM_BASE_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

export const MEDIAPIPE_FACE_LANDMARKER_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export const MEDIAPIPE_POSE_LANDMARKER_MODEL_ASSET_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const HAVE_CURRENT_DATA_READY_STATE = 2;

export type VisionTasksModule = typeof import("@mediapipe/tasks-vision");

export type VisionVideoElement = Pick<
  HTMLVideoElement,
  | "autoplay"
  | "currentTime"
  | "muted"
  | "pause"
  | "play"
  | "playsInline"
  | "readyState"
  | "srcObject"
>;

export type VisionBrowserEnvironment = {
  cancelAnimationFrame: (handle: number) => void;
  createVideoElement: () => VisionVideoElement;
  now: () => number;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
};

let cachedVisionTasksModulePromise: Promise<VisionTasksModule> | null = null;

export function loadVisionTasksModule(): Promise<VisionTasksModule> {
  if (cachedVisionTasksModulePromise === null) {
    cachedVisionTasksModulePromise = import("@mediapipe/tasks-vision");
  }

  return cachedVisionTasksModulePromise;
}

export function getDefaultVisionBrowserEnvironment():
  | VisionBrowserEnvironment
  | null {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof window.requestAnimationFrame !== "function" ||
    typeof window.cancelAnimationFrame !== "function" ||
    typeof window.performance?.now !== "function"
  ) {
    return null;
  }

  return {
    cancelAnimationFrame: (handle) => {
      window.cancelAnimationFrame(handle);
    },
    createVideoElement: () => document.createElement("video"),
    now: () => window.performance.now(),
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  };
}

export function configureVisionVideoElement(
  videoElement: VisionVideoElement,
  stream: MediaStream,
) {
  videoElement.autoplay = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.srcObject = stream;
}

export function cleanupVisionVideoElement(
  videoElement: VisionVideoElement | null,
) {
  if (videoElement === null) {
    return;
  }

  videoElement.pause();
  videoElement.srcObject = null;
}

export function hasActiveVideoTrack(stream: MediaStream): boolean {
  return stream
    .getVideoTracks()
    .some((track) => track.readyState === "live");
}

export function canReadVideoFrame(videoElement: VisionVideoElement): boolean {
  return videoElement.readyState >= HAVE_CURRENT_DATA_READY_STATE;
}

export function copyVisionLandmarks(
  landmarks: readonly NormalizedLandmark[],
): readonly VisionLandmark[] {
  return landmarks.map((landmark) => ({
    visibility: landmark.visibility,
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
  }));
}

export function copyVisionTransformationMatrix(
  matrix: Matrix | null | undefined,
): VisionTransformationMatrix | null {
  if (!matrix) {
    return null;
  }

  return {
    columns: matrix.columns,
    data: [...matrix.data],
    rows: matrix.rows,
  };
}

export function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallbackMessage;
}
