export const VISION_SERVICE_STATUSES = [
  "idle",
  "starting",
  "running",
  "stopped",
  "failed",
] as const;

export const FACE_DETECTION_STATUSES = [
  "awaiting_input",
  "detected",
  "no_face_detected",
] as const;

export const POSE_DETECTION_STATUSES = [
  "awaiting_input",
  "detected",
  "no_pose_detected",
] as const;

export type VisionServiceStatus = (typeof VISION_SERVICE_STATUSES)[number];

export type FaceDetectionStatus = (typeof FACE_DETECTION_STATUSES)[number];

export type PoseDetectionStatus = (typeof POSE_DETECTION_STATUSES)[number];

export type VisionLandmark = {
  visibility: number;
  x: number;
  y: number;
  z: number;
};

export type VisionTransformationMatrix = {
  columns: number;
  data: readonly number[];
  rows: number;
};

export type FaceLandmarkerErrorCode =
  | "camera_unavailable"
  | "face_detection_failed"
  | "face_model_load_failed";

export type PoseLandmarkerErrorCode =
  | "camera_unavailable"
  | "pose_detection_failed"
  | "pose_model_load_failed";

export type VisionError<TCode extends string> = {
  code: TCode;
  message: string;
};

type VisionLatestResultBase<TCode extends string> = {
  error: VisionError<TCode> | null;
  serviceStatus: VisionServiceStatus;
  updatedAtMs: number | null;
};

export type FaceLandmarkerLatestResult =
  VisionLatestResultBase<FaceLandmarkerErrorCode> & {
    detectionStatus: FaceDetectionStatus;
    faceLandmarks: readonly VisionLandmark[];
    facialTransformationMatrix: VisionTransformationMatrix | null;
  };

export type PoseLandmarkerLatestResult =
  VisionLatestResultBase<PoseLandmarkerErrorCode> & {
    detectionStatus: PoseDetectionStatus;
    poseLandmarks: readonly VisionLandmark[];
  };

export type FaceLandmarkerService = {
  getLatestResult: () => FaceLandmarkerLatestResult;
  start: (options: {
    stream: MediaStream;
  }) => Promise<void>;
  stop: () => void;
};

export type PoseLandmarkerService = {
  getLatestResult: () => PoseLandmarkerLatestResult;
  start: (options: {
    stream: MediaStream;
  }) => Promise<void>;
  stop: () => void;
};

export function createInitialFaceLandmarkerLatestResult(): FaceLandmarkerLatestResult {
  return {
    detectionStatus: "awaiting_input",
    error: null,
    faceLandmarks: [],
    facialTransformationMatrix: null,
    serviceStatus: "idle",
    updatedAtMs: null,
  };
}

export function createInitialPoseLandmarkerLatestResult(): PoseLandmarkerLatestResult {
  return {
    detectionStatus: "awaiting_input",
    error: null,
    poseLandmarks: [],
    serviceStatus: "idle",
    updatedAtMs: null,
  };
}
