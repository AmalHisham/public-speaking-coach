import assert from "node:assert/strict";
import test from "node:test";

import type { PoseLandmarkerLatestResult, VisionLandmark } from "@/types/vision";

import {
  POSTURE_STABILITY_COMPONENT_WEIGHTS,
  POSTURE_STABILITY_CONFIDENCE,
  POSTURE_STABILITY_FORMULA,
  POSTURE_STABILITY_INPUTS,
  POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD,
  POSTURE_STABILITY_LIMITATIONS,
  POSTURE_STABILITY_METRIC_ID,
  POSTURE_STABILITY_MIN_POSE_VISIBLE_PERCENTAGE,
  POSTURE_STABILITY_OUTPUT_RANGE,
  POSTURE_STABILITY_OUTPUT_TYPE,
  POSTURE_STABILITY_TARGET_RANGE,
  POSTURE_STABILITY_VERSION,
  aggregatePostureStabilityScore,
  calculateBodyLeanScore,
  calculateBodySwayScore,
  calculateHeadAlignmentScore,
  calculatePostureStability,
  calculateShoulderAlignmentScore,
} from "@/features/metrics/lib/posture-stability";

function createPoseLandmarks(): VisionLandmark[] {
  return Array.from({ length: 33 }, () => ({
    visibility: 0.95,
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
}

function createPoseResult(
  configure?: (landmarks: VisionLandmark[]) => void,
  overrides: Partial<PoseLandmarkerLatestResult> = {},
): PoseLandmarkerLatestResult {
  const poseLandmarks = createPoseLandmarks();

  configure?.(poseLandmarks);

  return {
    detectionStatus: "detected",
    error: null,
    poseLandmarks,
    serviceStatus: "running",
    updatedAtMs: 1_000,
    ...overrides,
  };
}

function setLandmark(
  landmarks: VisionLandmark[],
  index: number,
  values: Partial<VisionLandmark>,
) {
  const currentLandmark = landmarks[index];

  if (currentLandmark === undefined) {
    return;
  }

  landmarks[index] = {
    ...currentLandmark,
    ...values,
  };
}

function configureBalancedPosture(landmarks: VisionLandmark[]) {
  setLandmark(landmarks, 0, {
    x: 0.5,
    y: 0.2,
  });
  setLandmark(landmarks, 7, {
    x: 0.46,
    y: 0.22,
  });
  setLandmark(landmarks, 8, {
    x: 0.54,
    y: 0.22,
  });
  setLandmark(landmarks, 11, {
    x: 0.4,
    y: 0.4,
  });
  setLandmark(landmarks, 12, {
    x: 0.6,
    y: 0.4,
  });
  setLandmark(landmarks, 23, {
    x: 0.43,
    y: 0.7,
  });
  setLandmark(landmarks, 24, {
    x: 0.57,
    y: 0.7,
  });
}

function configureNoseOnlyHeadReference(landmarks: VisionLandmark[]) {
  configureBalancedPosture(landmarks);
  setLandmark(landmarks, 7, {
    visibility: POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD - 0.01,
  });
  setLandmark(landmarks, 8, {
    visibility: POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD - 0.01,
  });
}

function configureSingleEarOnlyHeadReference(landmarks: VisionLandmark[]) {
  configureBalancedPosture(landmarks);
  setLandmark(landmarks, 0, {
    visibility: POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD - 0.01,
  });
  setLandmark(landmarks, 8, {
    visibility: POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD - 0.01,
  });
}

test("calculates shoulder alignment from shoulder tilt", () => {
  assert.equal(
    calculateShoulderAlignmentScore(
      {
        x: 0.4,
        y: 0.4,
      },
      {
        x: 0.6,
        y: 0.4,
      },
    ),
    100,
  );

  assert.ok(
    Math.abs(
      calculateShoulderAlignmentScore(
        {
          x: 0.4,
          y: 0.4,
        },
        {
          x: 0.4 + Math.cos(Math.PI / 6),
          y: 0.4 + Math.sin(Math.PI / 6),
        },
      ),
    ) < 0.000001,
  );
});

test("calculates head alignment from head position relative to the torso centerline", () => {
  assert.equal(
    calculateHeadAlignmentScore({
      headCenter: {
        x: 0.5,
        y: 0.2,
      },
      hipMidpoint: {
        x: 0.5,
        y: 0.7,
      },
      shoulderMidpoint: {
        x: 0.5,
        y: 0.4,
      },
      shoulderWidth: 0.2,
    }),
    100,
  );

  assert.ok(
    Math.abs(
      calculateHeadAlignmentScore({
        headCenter: {
          x: 0.6,
          y: 0.2,
        },
        hipMidpoint: {
          x: 0.5,
          y: 0.7,
        },
        shoulderMidpoint: {
          x: 0.5,
          y: 0.4,
        },
        shoulderWidth: 0.2,
      }),
    ) < 0.000001,
  );
});

test("calculates body lean from torso angle relative to vertical", () => {
  assert.equal(
    calculateBodyLeanScore(
      {
        x: 0.5,
        y: 0.4,
      },
      {
        x: 0.5,
        y: 0.7,
      },
    ),
    100,
  );

  assert.ok(
    Math.abs(
      calculateBodyLeanScore(
        {
          x: Math.sin(Math.PI / 9),
          y: 0,
        },
        {
          x: 0,
          y: Math.cos(Math.PI / 9),
        },
      ),
    ) < 0.000001,
  );
});

test("calculates body sway from torso center movement over time", () => {
  assert.equal(
    calculateBodySwayScore([
      {
        shoulderWidth: 0.2,
        torsoCenterX: 0.5,
      },
      {
        shoulderWidth: 0.2,
        torsoCenterX: 0.5,
      },
    ]),
    100,
  );

  assert.ok(
    Math.abs(
      calculateBodySwayScore([
        {
          shoulderWidth: 0.2,
          torsoCenterX: 0.4,
        },
        {
          shoulderWidth: 0.2,
          torsoCenterX: 0.5,
        },
      ]),
    ) < 0.000001,
  );
});

test("aggregates VIS-002 with the exact spec weights", () => {
  const score = aggregatePostureStabilityScore({
    bodyLean: 80,
    bodySway: 50,
    headAlignment: 60,
    shoulderAlignment: 90,
  });

  assert.equal(score, 73);
  assert.deepStrictEqual(POSTURE_STABILITY_COMPONENT_WEIGHTS, {
    bodyLean: 0.3,
    bodySway: 0.2,
    headAlignment: 0.2,
    shoulderAlignment: 0.3,
  });
});

test("calculates posture stability from usable pose frames", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
        setLandmark(landmarks, 0, {
          x: 0.53,
        });
        setLandmark(landmarks, 7, {
          x: 0.49,
        });
        setLandmark(landmarks, 8, {
          x: 0.57,
        });
      }),
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
        setLandmark(landmarks, 11, {
          y: 0.43,
        });
        setLandmark(landmarks, 12, {
          y: 0.37,
        });
        setLandmark(landmarks, 23, {
          x: 0.45,
        });
        setLandmark(landmarks, 24, {
          x: 0.59,
        });
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.metricId, POSTURE_STABILITY_METRIC_ID);
  assert.equal(result.version, POSTURE_STABILITY_VERSION);
  assert.equal(result.confidence, POSTURE_STABILITY_CONFIDENCE);
  assert.equal(result.formula, POSTURE_STABILITY_FORMULA);
  assert.deepStrictEqual(result.inputs, POSTURE_STABILITY_INPUTS);
  assert.deepStrictEqual(result.limitations, POSTURE_STABILITY_LIMITATIONS);
  assert.deepStrictEqual(result.outputRange, POSTURE_STABILITY_OUTPUT_RANGE);
  assert.equal(result.outputType, POSTURE_STABILITY_OUTPUT_TYPE);
  assert.deepStrictEqual(result.targetRange, POSTURE_STABILITY_TARGET_RANGE);
  assert.equal(result.totalFrameCount, 4);
  assert.equal(result.poseVisibleFrameCount, 3);
  assert.equal(result.poseVisiblePercentage, 75);
  assert.ok(result.components.shoulderAlignment < 100);
  assert.ok(result.components.headAlignment < 100);
  assert.ok(result.components.bodyLean < 100);
  assert.ok(result.components.bodySway < 100);
  assert.equal(
    result.score,
    aggregatePostureStabilityScore(result.components),
  );
});

test("uses a nose-only head reference for head alignment when ears are unavailable", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureNoseOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureNoseOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureNoseOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureNoseOnlyHeadReference(landmarks);
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.components.headAlignment, 100);
  assert.equal(result.poseVisiblePercentage, 100);
});

test("does not allow a single ear landmark to become the head center", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.components.headAlignment, 0);
  assert.equal(result.poseVisibleFrameCount, 4);
  assert.equal(result.poseVisiblePercentage, 100);
});

test("keeps torso metrics available when the torso is visible but head landmarks are unavailable", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.components.shoulderAlignment, 100);
  assert.equal(result.components.bodyLean, 100);
  assert.equal(result.components.bodySway, 100);
  assert.equal(result.components.headAlignment, 0);
});

test("returns unavailable when no pose frame results are provided", () => {
  assert.deepStrictEqual(
    calculatePostureStability({
      frameResults: null,
    }),
    {
      confidence: POSTURE_STABILITY_CONFIDENCE,
      formula: POSTURE_STABILITY_FORMULA,
      inputs: POSTURE_STABILITY_INPUTS,
      limitations: POSTURE_STABILITY_LIMITATIONS,
      metricId: POSTURE_STABILITY_METRIC_ID,
      outputRange: POSTURE_STABILITY_OUTPUT_RANGE,
      outputType: POSTURE_STABILITY_OUTPUT_TYPE,
      reason: "pose_results_missing",
      status: "unavailable",
      targetRange: POSTURE_STABILITY_TARGET_RANGE,
      version: POSTURE_STABILITY_VERSION,
    },
  );
});

test("returns unavailable when MediaPipe pose processing fails", () => {
  assert.deepStrictEqual(
    calculatePostureStability({
      frameResults: [
        createPoseResult(undefined, {
          error: {
            code: "pose_detection_failed",
            message: "Pose landmark detection failed.",
          },
          serviceStatus: "failed",
        }),
      ],
    }),
    {
      confidence: POSTURE_STABILITY_CONFIDENCE,
      formula: POSTURE_STABILITY_FORMULA,
      inputs: POSTURE_STABILITY_INPUTS,
      limitations: POSTURE_STABILITY_LIMITATIONS,
      metricId: POSTURE_STABILITY_METRIC_ID,
      outputRange: POSTURE_STABILITY_OUTPUT_RANGE,
      outputType: POSTURE_STABILITY_OUTPUT_TYPE,
      reason: "mediapipe_failure",
      status: "unavailable",
      targetRange: POSTURE_STABILITY_TARGET_RANGE,
      version: POSTURE_STABILITY_VERSION,
    },
  );
});

test("returns unavailable when no pose is detected in any frame", () => {
  assert.deepStrictEqual(
    calculatePostureStability({
      frameResults: [
        createPoseResult(undefined, {
          detectionStatus: "no_pose_detected",
          poseLandmarks: [],
        }),
        createPoseResult(undefined, {
          detectionStatus: "no_pose_detected",
          poseLandmarks: [],
        }),
      ],
    }),
    {
      confidence: POSTURE_STABILITY_CONFIDENCE,
      formula: POSTURE_STABILITY_FORMULA,
      inputs: POSTURE_STABILITY_INPUTS,
      limitations: POSTURE_STABILITY_LIMITATIONS,
      metricId: POSTURE_STABILITY_METRIC_ID,
      outputRange: POSTURE_STABILITY_OUTPUT_RANGE,
      outputType: POSTURE_STABILITY_OUTPUT_TYPE,
      reason: "pose_not_detected",
      status: "unavailable",
      targetRange: POSTURE_STABILITY_TARGET_RANGE,
      version: POSTURE_STABILITY_VERSION,
    },
  );
});

test("returns unavailable when usable pose visibility stays below 30%", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
        setLandmark(landmarks, 11, {
          visibility: POSTURE_STABILITY_LANDMARK_VISIBILITY_THRESHOLD - 0.01,
        });
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
    ],
  });

  assert.equal(result.status, "unavailable");

  if (result.status !== "unavailable") {
    return;
  }

  assert.equal(result.reason, "insufficient_pose_visibility");
  assert.equal(POSTURE_STABILITY_MIN_POSE_VISIBLE_PERCENTAGE, 30);
});

test("uses torso visibility instead of head availability for the visibility threshold", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureNoseOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureSingleEarOnlyHeadReference(landmarks);
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.poseVisibleFrameCount, 4);
  assert.equal(result.poseVisiblePercentage, 100);
  assert.equal(result.components.headAlignment, 100);
});

test("treats the 30% visibility boundary as available", () => {
  const result = calculatePostureStability({
    frameResults: [
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
      }),
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
        setLandmark(landmarks, 0, {
          x: 0.52,
        });
      }),
      createPoseResult((landmarks) => {
        configureBalancedPosture(landmarks);
        setLandmark(landmarks, 23, {
          x: 0.45,
        });
        setLandmark(landmarks, 24, {
          x: 0.59,
        });
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
      createPoseResult(undefined, {
        detectionStatus: "no_pose_detected",
        poseLandmarks: [],
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.poseVisiblePercentage, 30);
});
