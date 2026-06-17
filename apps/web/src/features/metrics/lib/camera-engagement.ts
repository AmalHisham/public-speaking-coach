import type { FaceLandmarkerLatestResult, VisionTransformationMatrix } from "@/types/vision";

export const CAMERA_ENGAGEMENT_METRIC_ID = "VIS-001";
export const CAMERA_ENGAGEMENT_VERSION = "v1";
export const CAMERA_ENGAGEMENT_CONFIDENCE = "Medium";
export const CAMERA_ENGAGEMENT_FORMULA =
  "camera_facing_frames / total_frames * 100";
export const CAMERA_ENGAGEMENT_INPUTS = ["Yaw", "Pitch", "Roll"] as const;
export const CAMERA_ENGAGEMENT_OUTPUT_RANGE = {
  max: 100,
  min: 0,
} as const;
export const CAMERA_ENGAGEMENT_OUTPUT_UNIT = "percentage";
export const CAMERA_ENGAGEMENT_TARGET_RANGE = {
  excellent: {
    max: 100,
    min: 80,
  },
  fair: {
    max: 59.99999999999999,
    min: 40,
  },
  good: {
    max: 79.99999999999999,
    min: 60,
  },
} as const;
export const CAMERA_ENGAGEMENT_LIMITATIONS = [
  "Does not represent true audience eye contact.",
  "Assumes camera acts as audience proxy.",
] as const;
export const CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES = 15;
export const CAMERA_ENGAGEMENT_MIN_FACE_VISIBLE_PERCENTAGE = 30;

export type CameraEngagementRating = "Excellent" | "Good" | "Fair" | "Poor";

export type CameraEngagementUnavailableReason =
  | "face_results_missing"
  | "face_visibility_below_threshold"
  | "head_pose_unavailable"
  | "mediapipe_failure"
  | "no_face_detected";

export type HeadPose = {
  pitchDegrees: number;
  rollDegrees: number;
  yawDegrees: number;
};

type CameraEngagementBaseResult = {
  confidence: typeof CAMERA_ENGAGEMENT_CONFIDENCE;
  formula: typeof CAMERA_ENGAGEMENT_FORMULA;
  inputs: typeof CAMERA_ENGAGEMENT_INPUTS;
  limitations: typeof CAMERA_ENGAGEMENT_LIMITATIONS;
  metricId: typeof CAMERA_ENGAGEMENT_METRIC_ID;
  outputRange: typeof CAMERA_ENGAGEMENT_OUTPUT_RANGE;
  outputUnit: typeof CAMERA_ENGAGEMENT_OUTPUT_UNIT;
  targetRange: typeof CAMERA_ENGAGEMENT_TARGET_RANGE;
  version: typeof CAMERA_ENGAGEMENT_VERSION;
};

export type AvailableCameraEngagementMetricResult =
  CameraEngagementBaseResult & {
    cameraFacingFrameCount: number;
    faceVisibleFrameCount: number;
    faceVisiblePercentage: number;
    rating: CameraEngagementRating;
    status: "available";
    totalFrameCount: number;
    value: number;
  };

export type UnavailableCameraEngagementMetricResult =
  CameraEngagementBaseResult & {
    reason: CameraEngagementUnavailableReason;
    status: "unavailable";
  };

export type CameraEngagementMetricResult =
  | AvailableCameraEngagementMetricResult
  | UnavailableCameraEngagementMetricResult;

export type CalculateCameraEngagementInput = {
  frameResults: readonly FaceLandmarkerLatestResult[] | null;
};

type CameraFacingSample = {
  headPose: HeadPose;
};

type CameraEngagementFrameSummary = {
  detectedFaceFrameCount: number;
  headPoseAvailableFrameCount: number;
  headPoseUnavailableFrameCount: number;
};

function createBaseResult(): CameraEngagementBaseResult {
  return {
    confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
    formula: CAMERA_ENGAGEMENT_FORMULA,
    inputs: CAMERA_ENGAGEMENT_INPUTS,
    limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
    metricId: CAMERA_ENGAGEMENT_METRIC_ID,
    outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
    outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
    targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
    version: CAMERA_ENGAGEMENT_VERSION,
  };
}

function createUnavailableResult(
  reason: CameraEngagementUnavailableReason,
): UnavailableCameraEngagementMetricResult {
  return {
    ...createBaseResult(),
    reason,
    status: "unavailable",
  };
}

function degreesFromRadians(value: number): number {
  return (value * 180) / Math.PI;
}

function clampToUnitRange(value: number): number {
  if (value > 1) {
    return 1;
  }

  if (value < -1) {
    return -1;
  }

  return value;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function hasValidTransformationMatrixShape(
  transformationMatrix: VisionTransformationMatrix,
): boolean {
  return (
    transformationMatrix.rows === 4 &&
    transformationMatrix.columns === 4 &&
    transformationMatrix.data.length === 16 &&
    transformationMatrix.data.every(isFiniteNumber)
  );
}

export function estimateHeadPoseFromTransformationMatrix(
  transformationMatrix: VisionTransformationMatrix | null,
): HeadPose | null {
  if (
    transformationMatrix === null ||
    !hasValidTransformationMatrixShape(transformationMatrix)
  ) {
    return null;
  }

  const { data } = transformationMatrix;
  const m02 = data[2];
  const m10 = data[4];
  const m11 = data[5];
  const m12 = data[6];
  const m22 = data[10];

  if (
    m02 === undefined ||
    m10 === undefined ||
    m11 === undefined ||
    m12 === undefined ||
    m22 === undefined
  ) {
    return null;
  }

  // Assumption for VIS-001 v1:
  // MediaPipe's facial transformation matrix is treated as a row-major 4x4
  // rigid transform whose upper-left 3x3 block represents rotation.
  // We then extract YXZ Euler angles from that 3x3 rotation block.
  //
  // TODO(TASK-3003): validate this convention against captured real MediaPipe
  // matrices before reusing the helper more broadly or sharing it with VIS-002.
  return {
    pitchDegrees: degreesFromRadians(Math.asin(clampToUnitRange(-m12))),
    rollDegrees: degreesFromRadians(Math.atan2(m10, m11)),
    yawDegrees: degreesFromRadians(Math.atan2(m02, m22)),
  };
}

export function isFacingCamera(headPose: HeadPose): boolean {
  return (
    Math.abs(headPose.yawDegrees) <
      CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES &&
    Math.abs(headPose.pitchDegrees) <
      CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES
  );
}

export function classifyCameraEngagement(
  percentage: number,
): CameraEngagementRating {
  if (percentage >= 80) {
    return "Excellent";
  }

  if (percentage >= 60) {
    return "Good";
  }

  if (percentage >= 40) {
    return "Fair";
  }

  return "Poor";
}

export function collectCameraFacingSamples(
  frameResults: readonly FaceLandmarkerLatestResult[],
): CameraFacingSample[] {
  return frameResults.flatMap((frameResult) => {
    if (frameResult.detectionStatus !== "detected") {
      return [];
    }

    const headPose = estimateHeadPoseFromTransformationMatrix(
      frameResult.facialTransformationMatrix,
    );

    if (headPose === null) {
      return [];
    }

    return [
      {
        headPose,
      },
    ];
  });
}

export function summarizeCameraEngagementFrames(
  frameResults: readonly FaceLandmarkerLatestResult[],
): CameraEngagementFrameSummary {
  return frameResults.reduce<CameraEngagementFrameSummary>(
    (summary, frameResult) => {
      if (frameResult.detectionStatus !== "detected") {
        return summary;
      }

      const headPose = estimateHeadPoseFromTransformationMatrix(
        frameResult.facialTransformationMatrix,
      );

      if (headPose === null) {
        return {
          ...summary,
          detectedFaceFrameCount: summary.detectedFaceFrameCount + 1,
          headPoseUnavailableFrameCount:
            summary.headPoseUnavailableFrameCount + 1,
        };
      }

      return {
        ...summary,
        detectedFaceFrameCount: summary.detectedFaceFrameCount + 1,
        headPoseAvailableFrameCount: summary.headPoseAvailableFrameCount + 1,
      };
    },
    {
      detectedFaceFrameCount: 0,
      headPoseAvailableFrameCount: 0,
      headPoseUnavailableFrameCount: 0,
    },
  );
}

export function calculateCameraEngagement({
  frameResults,
}: CalculateCameraEngagementInput): CameraEngagementMetricResult {
  if (frameResults === null || frameResults.length === 0) {
    return createUnavailableResult("face_results_missing");
  }

  if (
    frameResults.some(
      (frameResult) =>
        frameResult.serviceStatus === "failed" || frameResult.error !== null,
    )
  ) {
    return createUnavailableResult("mediapipe_failure");
  }

  const totalFrameCount = frameResults.length;
  const frameSummary = summarizeCameraEngagementFrames(frameResults);
  const faceVisibleFrameCount = frameSummary.detectedFaceFrameCount;

  if (faceVisibleFrameCount === 0) {
    return createUnavailableResult("no_face_detected");
  }

  const faceVisiblePercentage =
    (faceVisibleFrameCount / totalFrameCount) * 100;

  if (
    faceVisiblePercentage < CAMERA_ENGAGEMENT_MIN_FACE_VISIBLE_PERCENTAGE
  ) {
    return createUnavailableResult("face_visibility_below_threshold");
  }

  if (frameSummary.headPoseUnavailableFrameCount > 0) {
    return createUnavailableResult("head_pose_unavailable");
  }

  const cameraFacingSamples = collectCameraFacingSamples(frameResults);

  const cameraFacingFrameCount = cameraFacingSamples.filter((sample) =>
    isFacingCamera(sample.headPose),
  ).length;
  const value = (cameraFacingFrameCount / totalFrameCount) * 100;

  return {
    ...createBaseResult(),
    cameraFacingFrameCount,
    faceVisibleFrameCount,
    faceVisiblePercentage,
    rating: classifyCameraEngagement(value),
    status: "available",
    totalFrameCount,
    value,
  };
}
