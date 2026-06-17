import type { PoseLandmarkerLatestResult, VisionLandmark } from "@/types/vision";

export const POSTURE_STABILITY_METRIC_ID = "VIS-002";
export const POSTURE_STABILITY_VERSION = "v1";
export const POSTURE_STABILITY_CONFIDENCE = "High";
export const POSTURE_STABILITY_FORMULA =
  "shoulder_alignment * 0.30 + head_alignment * 0.20 + body_lean * 0.30 + body_sway * 0.20";
export const POSTURE_STABILITY_INPUTS = [
  "Nose",
  "Left Shoulder",
  "Right Shoulder",
  "Left Hip",
  "Right Hip",
  "Left Ear",
  "Right Ear",
] as const;
export const POSTURE_STABILITY_OUTPUT_RANGE = {
  max: 100,
  min: 0,
} as const;
export const POSTURE_STABILITY_OUTPUT_TYPE = "Score";
export const POSTURE_STABILITY_TARGET_RANGE = {
  excellent: {
    max: 100,
    min: 85,
  },
  fair: {
    max: 69.99999999999999,
    min: 50,
  },
  good: {
    max: 84.99999999999999,
    min: 70,
  },
} as const;
export const POSTURE_STABILITY_LIMITATIONS = [
  "Cannot determine intent behind movement.",
  "Cannot distinguish stage movement from instability.",
] as const;
export const POSTURE_STABILITY_COMPONENT_WEIGHTS = {
  bodyLean: 0.3,
  bodySway: 0.2,
  headAlignment: 0.2,
  shoulderAlignment: 0.3,
} as const;
export const POSTURE_STABILITY_MIN_POSE_VISIBLE_PERCENTAGE = 30;
export const POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD = 0.5;
// VIS-002 v1 scoring depends on these normalization caps.
// Changing them changes the metric behavior and should be versioned.
export const POSTURE_STABILITY_MAX_SHOULDER_TILT_DEGREES = 30;
export const POSTURE_STABILITY_MAX_HEAD_ALIGNMENT_RATIO = 0.5;
export const POSTURE_STABILITY_MAX_BODY_LEAN_DEGREES = 20;
export const POSTURE_STABILITY_MAX_BODY_SWAY_RATIO = 0.5;

const POSE_LANDMARK_INDEX = {
  leftEar: 7,
  leftHip: 23,
  leftShoulder: 11,
  nose: 0,
  rightEar: 8,
  rightHip: 24,
  rightShoulder: 12,
} as const;

type Point2D = {
  x: number;
  y: number;
};

type ShoulderAlignmentFrameSample = {
  leftShoulder: Point2D;
  rightShoulder: Point2D;
};

type TorsoFrameSample = {
  hipMidpoint: Point2D;
  shoulderMidpoint: Point2D;
  shoulderWidth: number;
  torsoCenterX: number;
};

type HeadAlignmentFrameSample = TorsoFrameSample & {
  headCenter: Point2D;
};

export type PostureStabilityRating =
  | "Excellent"
  | "Good"
  | "Fair"
  | "Poor";

export type PostureStabilityUnavailableReason =
  | "insufficient_pose_visibility"
  | "mediapipe_failure"
  | "pose_not_detected"
  | "pose_results_missing";

export type PostureStabilityComponentScores = {
  bodyLean: number;
  bodySway: number;
  headAlignment: number;
  shoulderAlignment: number;
};

type PostureStabilityBaseResult = {
  confidence: typeof POSTURE_STABILITY_CONFIDENCE;
  formula: typeof POSTURE_STABILITY_FORMULA;
  inputs: typeof POSTURE_STABILITY_INPUTS;
  limitations: typeof POSTURE_STABILITY_LIMITATIONS;
  metricId: typeof POSTURE_STABILITY_METRIC_ID;
  outputRange: typeof POSTURE_STABILITY_OUTPUT_RANGE;
  outputType: typeof POSTURE_STABILITY_OUTPUT_TYPE;
  targetRange: typeof POSTURE_STABILITY_TARGET_RANGE;
  version: typeof POSTURE_STABILITY_VERSION;
};

export type AvailablePostureStabilityMetricResult =
  PostureStabilityBaseResult & {
    components: PostureStabilityComponentScores;
    poseVisibleFrameCount: number;
    poseVisiblePercentage: number;
    rating: PostureStabilityRating;
    // VIS-002 uses `score` to mirror metrics-spec's output wording.
    score: number;
    status: "available";
    totalFrameCount: number;
  };

export type UnavailablePostureStabilityMetricResult =
  PostureStabilityBaseResult & {
    reason: PostureStabilityUnavailableReason;
    status: "unavailable";
  };

export type PostureStabilityMetricResult =
  | AvailablePostureStabilityMetricResult
  | UnavailablePostureStabilityMetricResult;

export type CalculatePostureStabilityInput = {
  frameResults: readonly PoseLandmarkerLatestResult[] | null;
};

function createBaseResult(): PostureStabilityBaseResult {
  return {
    confidence: POSTURE_STABILITY_CONFIDENCE,
    formula: POSTURE_STABILITY_FORMULA,
    inputs: POSTURE_STABILITY_INPUTS,
    limitations: POSTURE_STABILITY_LIMITATIONS,
    metricId: POSTURE_STABILITY_METRIC_ID,
    outputRange: POSTURE_STABILITY_OUTPUT_RANGE,
    outputType: POSTURE_STABILITY_OUTPUT_TYPE,
    targetRange: POSTURE_STABILITY_TARGET_RANGE,
    version: POSTURE_STABILITY_VERSION,
  };
}

function createUnavailableResult(
  reason: PostureStabilityUnavailableReason,
): UnavailablePostureStabilityMetricResult {
  return {
    ...createBaseResult(),
    reason,
    status: "unavailable",
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (value < minimum) {
    return minimum;
  }

  if (value > maximum) {
    return maximum;
  }

  return value;
}

function normalizeScore(measurement: number, maximumMeasurement: number): number {
  if (!isFiniteNumber(measurement) || maximumMeasurement <= 0) {
    return 0;
  }

  return clamp(1 - measurement / maximumMeasurement, 0, 1) * 100;
}

function calculateMidpoint(left: Point2D, right: Point2D): Point2D {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function calculateDistance(left: Point2D, right: Point2D): number {
  const deltaX = right.x - left.x;
  const deltaY = right.y - left.y;

  return Math.hypot(deltaX, deltaY);
}

function getVisibleLandmark(
  poseLandmarks: readonly VisionLandmark[],
  index: number,
): VisionLandmark | null {
  const landmark = poseLandmarks[index];

  if (
    landmark === undefined ||
    !isFiniteNumber(landmark.x) ||
    !isFiniteNumber(landmark.y) ||
    !isFiniteNumber(landmark.z) ||
    !isFiniteNumber(landmark.visibility) ||
    landmark.visibility < POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD
  ) {
    return null;
  }

  return landmark;
}

function calculateAveragePoint(points: readonly Point2D[]): Point2D | null {
  if (points.length === 0) {
    return null;
  }

  const totals = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    {
      x: 0,
      y: 0,
    },
  );

  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
  };
}

function hasDetectedPose(frameResult: PoseLandmarkerLatestResult): boolean {
  if (frameResult.detectionStatus !== "detected") {
    return false;
  }

  return true;
}

function collectShoulderAlignmentFrameSample(
  frameResult: PoseLandmarkerLatestResult,
): ShoulderAlignmentFrameSample | null {
  if (!hasDetectedPose(frameResult)) {
    return null;
  }

  const leftShoulder = getVisibleLandmark(
    frameResult.poseLandmarks,
    POSE_LANDMARK_INDEX.leftShoulder,
  );
  const rightShoulder = getVisibleLandmark(
    frameResult.poseLandmarks,
    POSE_LANDMARK_INDEX.rightShoulder,
  );
  if (leftShoulder === null || rightShoulder === null) {
    return null;
  }

  return {
    leftShoulder,
    rightShoulder,
  };
}

function collectTorsoFrameSample(
  frameResult: PoseLandmarkerLatestResult,
): TorsoFrameSample | null {
  if (!hasDetectedPose(frameResult)) {
    return null;
  }

  const shoulderSample = collectShoulderAlignmentFrameSample(frameResult);
  const leftHip = getVisibleLandmark(
    frameResult.poseLandmarks,
    POSE_LANDMARK_INDEX.leftHip,
  );
  const rightHip = getVisibleLandmark(
    frameResult.poseLandmarks,
    POSE_LANDMARK_INDEX.rightHip,
  );

  if (shoulderSample === null || leftHip === null || rightHip === null) {
    return null;
  }

  const { leftShoulder, rightShoulder } = shoulderSample;
  const shoulderMidpoint = calculateMidpoint(leftShoulder, rightShoulder);
  const hipMidpoint = calculateMidpoint(leftHip, rightHip);
  const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
  const torsoHeight = Math.abs(hipMidpoint.y - shoulderMidpoint.y);

  if (shoulderWidth <= Number.EPSILON || torsoHeight <= Number.EPSILON) {
    return null;
  }

  return {
    hipMidpoint,
    shoulderMidpoint,
    shoulderWidth,
    torsoCenterX: (shoulderMidpoint.x + hipMidpoint.x) / 2,
  };
}

function collectStableHeadCenter(
  poseLandmarks: readonly VisionLandmark[],
): Point2D | null {
  const nose = getVisibleLandmark(poseLandmarks, POSE_LANDMARK_INDEX.nose);

  if (nose === null) {
    return null;
  }

  // VIS-002 v1 stable head reference rule:
  // require the nose, then refine the head center with any visible ear landmarks.
  const headLandmarks = [
    nose,
    getVisibleLandmark(poseLandmarks, POSE_LANDMARK_INDEX.leftEar),
    getVisibleLandmark(poseLandmarks, POSE_LANDMARK_INDEX.rightEar),
  ].flatMap((landmark) =>
    landmark === null
      ? []
      : [
          {
            x: landmark.x,
            y: landmark.y,
          },
        ],
  );

  return calculateAveragePoint(headLandmarks);
}

function collectHeadAlignmentFrameSample(
  frameResult: PoseLandmarkerLatestResult,
): HeadAlignmentFrameSample | null {
  const torsoSample = collectTorsoFrameSample(frameResult);

  if (torsoSample === null) {
    return null;
  }

  const headCenter = collectStableHeadCenter(frameResult.poseLandmarks);

  if (headCenter === null) {
    return null;
  }

  return {
    ...torsoSample,
    headCenter,
  };
}

export function calculateShoulderAlignmentScore(
  leftShoulder: Point2D,
  rightShoulder: Point2D,
): number {
  const shoulderTiltDegrees =
    (Math.atan2(
      Math.abs(rightShoulder.y - leftShoulder.y),
      Math.abs(rightShoulder.x - leftShoulder.x),
    ) *
      180) /
    Math.PI;

  return normalizeScore(
    shoulderTiltDegrees,
    POSTURE_STABILITY_MAX_SHOULDER_TILT_DEGREES,
  );
}

export function calculateHeadAlignmentScore(options: {
  headCenter: Point2D;
  hipMidpoint: Point2D;
  shoulderMidpoint: Point2D;
  shoulderWidth: number;
}): number {
  const { headCenter, hipMidpoint, shoulderMidpoint, shoulderWidth } = options;
  const torsoDeltaY = hipMidpoint.y - shoulderMidpoint.y;

  if (Math.abs(torsoDeltaY) <= Number.EPSILON || shoulderWidth <= Number.EPSILON) {
    return 0;
  }

  const centerlineRatio = (headCenter.y - shoulderMidpoint.y) / torsoDeltaY;
  const centerlineXAtHead =
    shoulderMidpoint.x +
    centerlineRatio * (hipMidpoint.x - shoulderMidpoint.x);
  const headOffsetRatio = Math.abs(headCenter.x - centerlineXAtHead) / shoulderWidth;

  return normalizeScore(
    headOffsetRatio,
    POSTURE_STABILITY_MAX_HEAD_ALIGNMENT_RATIO,
  );
}

export function calculateBodyLeanScore(
  shoulderMidpoint: Point2D,
  hipMidpoint: Point2D,
): number {
  const leanDegrees =
    (Math.atan2(
      Math.abs(shoulderMidpoint.x - hipMidpoint.x),
      Math.abs(hipMidpoint.y - shoulderMidpoint.y),
    ) *
      180) /
    Math.PI;

  return normalizeScore(leanDegrees, POSTURE_STABILITY_MAX_BODY_LEAN_DEGREES);
}

export function calculateBodySwayScore(
  frameSamples: readonly Pick<TorsoFrameSample, "shoulderWidth" | "torsoCenterX">[],
): number {
  if (frameSamples.length === 0) {
    return 0;
  }

  const torsoCenters = frameSamples.map((sample) => sample.torsoCenterX);
  const minimumCenterX = Math.min(...torsoCenters);
  const maximumCenterX = Math.max(...torsoCenters);
  const averageShoulderWidth =
    frameSamples.reduce((sum, sample) => sum + sample.shoulderWidth, 0) /
    frameSamples.length;

  if (averageShoulderWidth <= Number.EPSILON) {
    return 0;
  }

  const swayRatio = (maximumCenterX - minimumCenterX) / averageShoulderWidth;

  return normalizeScore(swayRatio, POSTURE_STABILITY_MAX_BODY_SWAY_RATIO);
}

export function aggregatePostureStabilityScore(
  components: PostureStabilityComponentScores,
): number {
  return (
    components.shoulderAlignment *
      POSTURE_STABILITY_COMPONENT_WEIGHTS.shoulderAlignment +
    components.headAlignment * POSTURE_STABILITY_COMPONENT_WEIGHTS.headAlignment +
    components.bodyLean * POSTURE_STABILITY_COMPONENT_WEIGHTS.bodyLean +
    components.bodySway * POSTURE_STABILITY_COMPONENT_WEIGHTS.bodySway
  );
}

export function classifyPostureStability(
  score: number,
): PostureStabilityRating {
  if (score >= 85) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Good";
  }

  if (score >= 50) {
    return "Fair";
  }

  return "Poor";
}

export function calculatePostureStability({
  frameResults,
}: CalculatePostureStabilityInput): PostureStabilityMetricResult {
  if (frameResults === null || frameResults.length === 0) {
    return createUnavailableResult("pose_results_missing");
  }

  if (
    frameResults.some(
      (frameResult) =>
        frameResult.serviceStatus === "failed" || frameResult.error !== null,
    )
  ) {
    return createUnavailableResult("mediapipe_failure");
  }

  if (
    frameResults.every(
      (frameResult) => frameResult.detectionStatus !== "detected",
    )
  ) {
    return createUnavailableResult("pose_not_detected");
  }

  const shoulderAlignmentFrameSamples = frameResults.flatMap((frameResult) => {
    const sample = collectShoulderAlignmentFrameSample(frameResult);

    return sample === null ? [] : [sample];
  });
  const torsoFrameSamples = frameResults.flatMap((frameResult) => {
    const sample = collectTorsoFrameSample(frameResult);

    return sample === null ? [] : [sample];
  });
  const headAlignmentFrameSamples = frameResults.flatMap((frameResult) => {
    const sample = collectHeadAlignmentFrameSample(frameResult);

    return sample === null ? [] : [sample];
  });
  const totalFrameCount = frameResults.length;
  const poseVisibleFrameCount = torsoFrameSamples.length;
  const poseVisiblePercentage = (poseVisibleFrameCount / totalFrameCount) * 100;

  if (
    poseVisiblePercentage < POSTURE_STABILITY_MIN_POSE_VISIBLE_PERCENTAGE
  ) {
    return createUnavailableResult("insufficient_pose_visibility");
  }

  const averagedComponents: PostureStabilityComponentScores = {
    bodyLean:
      torsoFrameSamples.length === 0
        ? 0
        : torsoFrameSamples.reduce(
            (sum, sample) =>
              sum + calculateBodyLeanScore(sample.shoulderMidpoint, sample.hipMidpoint),
            0,
          ) / torsoFrameSamples.length,
    bodySway: calculateBodySwayScore(torsoFrameSamples),
    headAlignment:
      headAlignmentFrameSamples.length === 0
        ? 0
        : headAlignmentFrameSamples.reduce(
            (sum, sample) =>
              sum +
              calculateHeadAlignmentScore({
                headCenter: sample.headCenter,
                hipMidpoint: sample.hipMidpoint,
                shoulderMidpoint: sample.shoulderMidpoint,
                shoulderWidth: sample.shoulderWidth,
              }),
            0,
          ) / headAlignmentFrameSamples.length,
    shoulderAlignment:
      shoulderAlignmentFrameSamples.length === 0
        ? 0
        : shoulderAlignmentFrameSamples.reduce(
            (sum, sample) =>
              sum +
              calculateShoulderAlignmentScore(
                sample.leftShoulder,
                sample.rightShoulder,
              ),
            0,
          ) / shoulderAlignmentFrameSamples.length,
  };
  const score = aggregatePostureStabilityScore(averagedComponents);

  return {
    ...createBaseResult(),
    components: averagedComponents,
    poseVisibleFrameCount,
    poseVisiblePercentage,
    rating: classifyPostureStability(score),
    score,
    status: "available",
    totalFrameCount,
  };
}
