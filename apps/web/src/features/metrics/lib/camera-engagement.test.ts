import assert from "node:assert/strict";
import test from "node:test";

import type { FaceLandmarkerLatestResult } from "@/types/vision";

import {
  CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES,
  CAMERA_ENGAGEMENT_CONFIDENCE,
  CAMERA_ENGAGEMENT_FORMULA,
  CAMERA_ENGAGEMENT_INPUTS,
  CAMERA_ENGAGEMENT_LIMITATIONS,
  CAMERA_ENGAGEMENT_METRIC_ID,
  CAMERA_ENGAGEMENT_MIN_FACE_VISIBLE_PERCENTAGE,
  CAMERA_ENGAGEMENT_OUTPUT_RANGE,
  CAMERA_ENGAGEMENT_OUTPUT_UNIT,
  CAMERA_ENGAGEMENT_TARGET_RANGE,
  CAMERA_ENGAGEMENT_VERSION,
  calculateCameraEngagement,
  classifyCameraEngagement,
  estimateHeadPoseFromTransformationMatrix,
  isFacingCamera,
  summarizeCameraEngagementFrames,
} from "@/features/metrics/lib/camera-engagement";
import { createTransformationMatrix } from "@/features/vision/lib/vision-test-helpers";

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function createHeadPoseTransformationMatrix(options: {
  pitchDegrees?: number;
  rollDegrees?: number;
  yawDegrees?: number;
} = {}) {
  const pitchRadians = degreesToRadians(options.pitchDegrees ?? 0);
  const rollRadians = degreesToRadians(options.rollDegrees ?? 0);
  const yawRadians = degreesToRadians(options.yawDegrees ?? 0);
  const c1 = Math.cos(yawRadians);
  const c2 = Math.cos(pitchRadians);
  const c3 = Math.cos(rollRadians);
  const s1 = Math.sin(yawRadians);
  const s2 = Math.sin(pitchRadians);
  const s3 = Math.sin(rollRadians);

  return createTransformationMatrix({
    data: [
      c1 * c3 + s1 * s2 * s3,
      s1 * s2 * c3 - c1 * s3,
      s1 * c2,
      0,
      c2 * s3,
      c2 * c3,
      -s2,
      0,
      c1 * s2 * s3 - s1 * c3,
      s1 * s3 + c1 * s2 * c3,
      c1 * c2,
      0,
      0,
      0,
      0,
      1,
    ],
  });
}

function createFaceResult(
  overrides: Partial<FaceLandmarkerLatestResult> = {},
): FaceLandmarkerLatestResult {
  return {
    detectionStatus: "detected",
    error: null,
    faceLandmarks: [],
    facialTransformationMatrix: createHeadPoseTransformationMatrix(),
    serviceStatus: "running",
    updatedAtMs: 1_000,
    ...overrides,
  };
}

test("extracts yaw, pitch, and roll from the facial transformation matrix", () => {
  const result = estimateHeadPoseFromTransformationMatrix(
    createHeadPoseTransformationMatrix({
      pitchDegrees: -10,
      rollDegrees: 12,
      yawDegrees: 20,
    }),
  );

  assert.notEqual(result, null);

  if (result === null) {
    return;
  }

  assert.ok(Math.abs(result.yawDegrees - 20) < 0.000001);
  assert.ok(Math.abs(result.pitchDegrees - -10) < 0.000001);
  assert.ok(Math.abs(result.rollDegrees - 12) < 0.000001);
});

test("returns null when the facial transformation matrix is unavailable or invalid", () => {
  assert.equal(estimateHeadPoseFromTransformationMatrix(null), null);
  assert.equal(
    estimateHeadPoseFromTransformationMatrix(
      createTransformationMatrix({
        columns: 3,
      }),
    ),
    null,
  );
  assert.equal(
    estimateHeadPoseFromTransformationMatrix(
      createTransformationMatrix({
        data: [1, 2, 3],
      }),
    ),
    null,
  );
});

test("counts a detected face with a null transformation matrix as visible with unavailable pose", () => {
  const summary = summarizeCameraEngagementFrames([
    createFaceResult({
      facialTransformationMatrix: null,
    }),
  ]);

  assert.deepStrictEqual(summary, {
    detectedFaceFrameCount: 1,
    headPoseAvailableFrameCount: 0,
    headPoseUnavailableFrameCount: 1,
  });
});

test("uses strict yaw and pitch thresholds for the camera-facing rule", () => {
  assert.equal(
    isFacingCamera({
      pitchDegrees: 14.999,
      rollDegrees: 40,
      yawDegrees: -14.999,
    }),
    true,
  );
  assert.equal(
    isFacingCamera({
      pitchDegrees: CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES,
      rollDegrees: 0,
      yawDegrees: 0,
    }),
    false,
  );
  assert.equal(
    isFacingCamera({
      pitchDegrees: 0,
      rollDegrees: 0,
      yawDegrees: -CAMERA_ENGAGEMENT_CAMERA_FACING_THRESHOLD_DEGREES,
    }),
    false,
  );
});

test("classifies camera engagement using the spec target bands", () => {
  assert.equal(classifyCameraEngagement(39.99), "Poor");
  assert.equal(classifyCameraEngagement(40), "Fair");
  assert.equal(classifyCameraEngagement(59.99), "Fair");
  assert.equal(classifyCameraEngagement(60), "Good");
  assert.equal(classifyCameraEngagement(79.99), "Good");
  assert.equal(classifyCameraEngagement(80), "Excellent");
});

test("calculates camera engagement from camera-facing frames over total frames", () => {
  const result = calculateCameraEngagement({
    frameResults: [
      createFaceResult(),
      createFaceResult({
        facialTransformationMatrix: createHeadPoseTransformationMatrix({
          yawDegrees: 10,
        }),
      }),
      createFaceResult({
        facialTransformationMatrix: createHeadPoseTransformationMatrix({
          pitchDegrees: 16,
        }),
      }),
      createFaceResult({
        facialTransformationMatrix: createHeadPoseTransformationMatrix({
          yawDegrees: 30,
        }),
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.metricId, CAMERA_ENGAGEMENT_METRIC_ID);
  assert.equal(result.version, CAMERA_ENGAGEMENT_VERSION);
  assert.equal(result.confidence, CAMERA_ENGAGEMENT_CONFIDENCE);
  assert.equal(result.formula, CAMERA_ENGAGEMENT_FORMULA);
  assert.deepStrictEqual(result.inputs, CAMERA_ENGAGEMENT_INPUTS);
  assert.deepStrictEqual(result.limitations, CAMERA_ENGAGEMENT_LIMITATIONS);
  assert.deepStrictEqual(result.outputRange, CAMERA_ENGAGEMENT_OUTPUT_RANGE);
  assert.equal(result.outputUnit, CAMERA_ENGAGEMENT_OUTPUT_UNIT);
  assert.deepStrictEqual(result.targetRange, CAMERA_ENGAGEMENT_TARGET_RANGE);
  assert.equal(result.totalFrameCount, 5);
  assert.equal(result.faceVisibleFrameCount, 4);
  assert.equal(result.faceVisiblePercentage, 80);
  assert.equal(result.cameraFacingFrameCount, 2);
  assert.equal(result.value, 40);
  assert.equal(result.rating, "Fair");
});

test("returns unavailable when no frame results are provided", () => {
  assert.deepStrictEqual(
    calculateCameraEngagement({
      frameResults: null,
    }),
    {
      confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
      formula: CAMERA_ENGAGEMENT_FORMULA,
      inputs: CAMERA_ENGAGEMENT_INPUTS,
      limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
      metricId: CAMERA_ENGAGEMENT_METRIC_ID,
      outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
      outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
      reason: "face_results_missing",
      status: "unavailable",
      targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
      version: CAMERA_ENGAGEMENT_VERSION,
    },
  );
});

test("returns unavailable when MediaPipe face processing fails", () => {
  assert.deepStrictEqual(
    calculateCameraEngagement({
      frameResults: [
        createFaceResult({
          error: {
            code: "face_detection_failed",
            message: "Face landmark detection failed.",
          },
          facialTransformationMatrix: null,
          serviceStatus: "failed",
        }),
      ],
    }),
    {
      confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
      formula: CAMERA_ENGAGEMENT_FORMULA,
      inputs: CAMERA_ENGAGEMENT_INPUTS,
      limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
      metricId: CAMERA_ENGAGEMENT_METRIC_ID,
      outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
      outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
      reason: "mediapipe_failure",
      status: "unavailable",
      targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
      version: CAMERA_ENGAGEMENT_VERSION,
    },
  );
});

test("returns unavailable when no face is detected in any frame", () => {
  assert.deepStrictEqual(
    calculateCameraEngagement({
      frameResults: [
        createFaceResult({
          detectionStatus: "no_face_detected",
          facialTransformationMatrix: null,
        }),
        createFaceResult({
          detectionStatus: "no_face_detected",
          facialTransformationMatrix: null,
        }),
      ],
    }),
    {
      confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
      formula: CAMERA_ENGAGEMENT_FORMULA,
      inputs: CAMERA_ENGAGEMENT_INPUTS,
      limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
      metricId: CAMERA_ENGAGEMENT_METRIC_ID,
      outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
      outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
      reason: "no_face_detected",
      status: "unavailable",
      targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
      version: CAMERA_ENGAGEMENT_VERSION,
    },
  );
});

test("returns unavailable for missing pose inputs when the face is visible enough", () => {
  const result = calculateCameraEngagement({
    frameResults: [
      createFaceResult(),
      createFaceResult({
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
    ],
  });

  assert.deepStrictEqual(result, {
    confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
    formula: CAMERA_ENGAGEMENT_FORMULA,
    inputs: CAMERA_ENGAGEMENT_INPUTS,
    limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
    metricId: CAMERA_ENGAGEMENT_METRIC_ID,
    outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
    outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
    reason: "head_pose_unavailable",
    status: "unavailable",
    targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
    version: CAMERA_ENGAGEMENT_VERSION,
  });
});

test("prioritizes the visibility threshold when pose data is missing but visible frames stay below 30%", () => {
  const result = calculateCameraEngagement({
    frameResults: [
      createFaceResult({
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        detectionStatus: "no_face_detected",
        facialTransformationMatrix: null,
      }),
    ],
  });

  assert.equal(result.status, "unavailable");

  if (result.status !== "unavailable") {
    return;
  }

  assert.equal(result.reason, "face_visibility_below_threshold");
  assert.equal(CAMERA_ENGAGEMENT_MIN_FACE_VISIBLE_PERCENTAGE, 30);
});

test("keeps camera engagement unavailable when any detected frame is missing pose inputs", () => {
  const result = calculateCameraEngagement({
    frameResults: [
      createFaceResult(),
      createFaceResult({
        facialTransformationMatrix: null,
      }),
      createFaceResult({
        facialTransformationMatrix: createHeadPoseTransformationMatrix({
          yawDegrees: 12,
        }),
      }),
    ],
  });

  assert.deepStrictEqual(result, {
    confidence: CAMERA_ENGAGEMENT_CONFIDENCE,
    formula: CAMERA_ENGAGEMENT_FORMULA,
    inputs: CAMERA_ENGAGEMENT_INPUTS,
    limitations: CAMERA_ENGAGEMENT_LIMITATIONS,
    metricId: CAMERA_ENGAGEMENT_METRIC_ID,
    outputRange: CAMERA_ENGAGEMENT_OUTPUT_RANGE,
    outputUnit: CAMERA_ENGAGEMENT_OUTPUT_UNIT,
    reason: "head_pose_unavailable",
    status: "unavailable",
    targetRange: CAMERA_ENGAGEMENT_TARGET_RANGE,
    version: CAMERA_ENGAGEMENT_VERSION,
  });
});
