import assert from "node:assert/strict";
import test from "node:test";

import {
  PAUSE_QUALITY_CONFIDENCE,
  PAUSE_QUALITY_FORMULA,
  PAUSE_QUALITY_INPUTS,
  PAUSE_QUALITY_LIMITATIONS,
  PAUSE_QUALITY_MEASUREMENTS,
  PAUSE_QUALITY_METRIC_ID,
  PAUSE_QUALITY_MIN_SILENCE_DURATION_SECONDS,
  PAUSE_QUALITY_OUTPUT_TYPE,
  PAUSE_QUALITY_TARGET_RANGE,
  PAUSE_QUALITY_VERSION,
  calculatePauseQuality,
  collectPauseEvents,
} from "@/features/metrics/lib/pause-quality";

test("counts a pause when silence duration is exactly 500 milliseconds", () => {
  const result = calculatePauseQuality({
    audioTimestamps: {
      endTimeSeconds: 3,
      startTimeSeconds: 0,
    },
    speechActivityTimeline: [
      {
        endTimeSeconds: 1.0,
        startTimeSeconds: 0.0,
      },
      {
        endTimeSeconds: 2.0,
        startTimeSeconds: 1.5,
      },
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.pauseCount, 1);
  assert.equal(
    result.averagePauseDurationSeconds,
    PAUSE_QUALITY_MIN_SILENCE_DURATION_SECONDS,
  );
  assert.equal(
    result.longestPauseDurationSeconds,
    PAUSE_QUALITY_MIN_SILENCE_DURATION_SECONDS,
  );
});

test("ignores silence below the 500 millisecond threshold", () => {
  const result = calculatePauseQuality({
    audioTimestamps: {
      endTimeSeconds: 3,
      startTimeSeconds: 0,
    },
    speechActivityTimeline: [
      {
        endTimeSeconds: 1.0,
        startTimeSeconds: 0.0,
      },
      {
        endTimeSeconds: 2.0,
        startTimeSeconds: 1.49,
      },
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.pauseCount, 0);
  assert.equal(result.averagePauseDurationSeconds, 0);
  assert.equal(result.longestPauseDurationSeconds, 0);
});

test("tracks multiple pauses and their durations", () => {
  const pauses = collectPauseEvents(
    {
      endTimeSeconds: 6,
      startTimeSeconds: 0,
    },
    [
      {
        endTimeSeconds: 0.5,
        startTimeSeconds: 0.0,
      },
      {
        endTimeSeconds: 1.5,
        startTimeSeconds: 1.0,
      },
      {
        endTimeSeconds: 3.0,
        startTimeSeconds: 2.0,
      },
      {
        endTimeSeconds: 4.5,
        startTimeSeconds: 4.0,
      },
    ],
  );

  assert.deepStrictEqual(pauses, [
    {
      durationSeconds: 0.5,
      endTimeSeconds: 1.0,
      startTimeSeconds: 0.5,
    },
    {
      durationSeconds: 0.5,
      endTimeSeconds: 2.0,
      startTimeSeconds: 1.5,
    },
    {
      durationSeconds: 1.0,
      endTimeSeconds: 4.0,
      startTimeSeconds: 3.0,
    },
  ]);
});

test("calculates average and longest pause duration", () => {
  const result = calculatePauseQuality({
    audioTimestamps: {
      endTimeSeconds: 6,
      startTimeSeconds: 0,
    },
    speechActivityTimeline: [
      {
        endTimeSeconds: 0.5,
        startTimeSeconds: 0.0,
      },
      {
        endTimeSeconds: 1.5,
        startTimeSeconds: 1.0,
      },
      {
        endTimeSeconds: 3.0,
        startTimeSeconds: 2.0,
      },
      {
        endTimeSeconds: 5.0,
        startTimeSeconds: 4.5,
      },
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.metricId, PAUSE_QUALITY_METRIC_ID);
  assert.equal(result.version, PAUSE_QUALITY_VERSION);
  assert.equal(result.confidence, PAUSE_QUALITY_CONFIDENCE);
  assert.equal(result.formula, PAUSE_QUALITY_FORMULA);
  assert.equal(result.outputType, PAUSE_QUALITY_OUTPUT_TYPE);
  assert.deepStrictEqual(result.inputs, PAUSE_QUALITY_INPUTS);
  assert.deepStrictEqual(result.measurements, PAUSE_QUALITY_MEASUREMENTS);
  assert.deepStrictEqual(result.limitations, PAUSE_QUALITY_LIMITATIONS);
  assert.deepStrictEqual(result.targetRange, PAUSE_QUALITY_TARGET_RANGE);
  assert.equal(result.pauseCount, 3);
  assert.equal(result.averagePauseDurationSeconds, (0.5 + 0.5 + 1.5) / 3);
  assert.equal(result.longestPauseDurationSeconds, 1.5);
});

test("returns zeroed measurements when no pauses are detected", () => {
  const result = calculatePauseQuality({
    audioTimestamps: {
      endTimeSeconds: 2,
      startTimeSeconds: 0,
    },
    speechActivityTimeline: [
      {
        endTimeSeconds: 0.5,
        startTimeSeconds: 0.0,
      },
      {
        endTimeSeconds: 1.0,
        startTimeSeconds: 0.7,
      },
      {
        endTimeSeconds: 1.5,
        startTimeSeconds: 1.2,
      },
    ],
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.pauseCount, 0);
  assert.equal(result.averagePauseDurationSeconds, 0);
  assert.equal(result.longestPauseDurationSeconds, 0);
});

test("returns unavailable when audio timestamps are missing", () => {
  assert.deepStrictEqual(
    calculatePauseQuality({
      audioTimestamps: null,
      speechActivityTimeline: [
        {
          endTimeSeconds: 1,
          startTimeSeconds: 0,
        },
      ],
    }),
    {
      confidence: PAUSE_QUALITY_CONFIDENCE,
      formula: PAUSE_QUALITY_FORMULA,
      inputs: PAUSE_QUALITY_INPUTS,
      limitations: PAUSE_QUALITY_LIMITATIONS,
      measurements: PAUSE_QUALITY_MEASUREMENTS,
      metricId: PAUSE_QUALITY_METRIC_ID,
      outputType: PAUSE_QUALITY_OUTPUT_TYPE,
      reason: "audio_unavailable",
      status: "unavailable",
      targetRange: PAUSE_QUALITY_TARGET_RANGE,
      version: PAUSE_QUALITY_VERSION,
    },
  );
});

test("returns unavailable when speech timestamps are missing", () => {
  assert.deepStrictEqual(
    calculatePauseQuality({
      audioTimestamps: {
        endTimeSeconds: 2,
        startTimeSeconds: 0,
      },
      speechActivityTimeline: null,
    }),
    {
      confidence: PAUSE_QUALITY_CONFIDENCE,
      formula: PAUSE_QUALITY_FORMULA,
      inputs: PAUSE_QUALITY_INPUTS,
      limitations: PAUSE_QUALITY_LIMITATIONS,
      measurements: PAUSE_QUALITY_MEASUREMENTS,
      metricId: PAUSE_QUALITY_METRIC_ID,
      outputType: PAUSE_QUALITY_OUTPUT_TYPE,
      reason: "timestamp_generation_failure",
      status: "unavailable",
      targetRange: PAUSE_QUALITY_TARGET_RANGE,
      version: PAUSE_QUALITY_VERSION,
    },
  );
});

test("returns unavailable when speech timestamps fall outside audio timestamps", () => {
  assert.deepStrictEqual(
    calculatePauseQuality({
      audioTimestamps: {
        endTimeSeconds: 2,
        startTimeSeconds: 0,
      },
      speechActivityTimeline: [
        {
          endTimeSeconds: 2.5,
          startTimeSeconds: 0,
        },
      ],
    }),
    {
      confidence: PAUSE_QUALITY_CONFIDENCE,
      formula: PAUSE_QUALITY_FORMULA,
      inputs: PAUSE_QUALITY_INPUTS,
      limitations: PAUSE_QUALITY_LIMITATIONS,
      measurements: PAUSE_QUALITY_MEASUREMENTS,
      metricId: PAUSE_QUALITY_METRIC_ID,
      outputType: PAUSE_QUALITY_OUTPUT_TYPE,
      reason: "timestamp_generation_failure",
      status: "unavailable",
      targetRange: PAUSE_QUALITY_TARGET_RANGE,
      version: PAUSE_QUALITY_VERSION,
    },
  );
});
