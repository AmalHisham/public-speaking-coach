import assert from "node:assert/strict";
import test from "node:test";

import {
  SPEAKING_PACE_CONFIDENCE,
  SPEAKING_PACE_FORMULA,
  SPEAKING_PACE_LIMITATIONS,
  SPEAKING_PACE_METRIC_ID,
  SPEAKING_PACE_MIN_SESSION_DURATION_SECONDS,
  SPEAKING_PACE_OUTPUT_RANGE,
  SPEAKING_PACE_OUTPUT_UNIT,
  SPEAKING_PACE_VERSION,
  calculateSpeakingPace,
  classifySpeakingPace,
  countTranscriptWords,
} from "@/features/metrics/lib/speaking-pace";

test("counts transcript words from normalized transcript text", () => {
  assert.equal(countTranscriptWords("  steady   pacing\nbuilds confidence  "), 4);
  assert.equal(countTranscriptWords("one-word"), 1);
});

test("calculates words per minute from transcript text and session duration", () => {
  const result = calculateSpeakingPace({
    sessionDurationSeconds: 30,
    transcriptText: "steady pacing helps every speaker improve over time",
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.metricId, SPEAKING_PACE_METRIC_ID);
  assert.equal(result.version, SPEAKING_PACE_VERSION);
  assert.equal(result.confidence, SPEAKING_PACE_CONFIDENCE);
  assert.equal(result.formula, SPEAKING_PACE_FORMULA);
  assert.deepStrictEqual(result.outputRange, SPEAKING_PACE_OUTPUT_RANGE);
  assert.equal(result.outputUnit, SPEAKING_PACE_OUTPUT_UNIT);
  assert.deepStrictEqual(result.limitations, SPEAKING_PACE_LIMITATIONS);
  assert.equal(result.wordCount, 8);
  assert.equal(result.speakingMinutes, 0.5);
  assert.equal(result.value, 16);
  assert.equal(result.rating, "Needs Improvement");
});

test("classifies speaking pace using the spec target bands", () => {
  assert.equal(classifySpeakingPace(119.9), "Needs Improvement");
  assert.equal(classifySpeakingPace(120), "Good");
  assert.equal(classifySpeakingPace(139.9), "Good");
  assert.equal(classifySpeakingPace(140), "Excellent");
  assert.equal(classifySpeakingPace(160), "Excellent");
  assert.equal(classifySpeakingPace(160.1), "Good");
  assert.equal(classifySpeakingPace(180), "Good");
  assert.equal(classifySpeakingPace(180.1), "Needs Improvement");
});

test("returns unavailable when the transcript is missing", () => {
  assert.deepStrictEqual(
    calculateSpeakingPace({
      sessionDurationSeconds: 120,
      transcriptText: null,
    }),
    {
      confidence: SPEAKING_PACE_CONFIDENCE,
      formula: SPEAKING_PACE_FORMULA,
      limitations: SPEAKING_PACE_LIMITATIONS,
      metricId: SPEAKING_PACE_METRIC_ID,
      outputRange: SPEAKING_PACE_OUTPUT_RANGE,
      outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
      reason: "transcript_missing",
      status: "unavailable",
      version: SPEAKING_PACE_VERSION,
    },
  );
});

test("returns unavailable when the transcript is empty", () => {
  assert.deepStrictEqual(
    calculateSpeakingPace({
      sessionDurationSeconds: 120,
      transcriptText: "   \n\t  ",
    }),
    {
      confidence: SPEAKING_PACE_CONFIDENCE,
      formula: SPEAKING_PACE_FORMULA,
      limitations: SPEAKING_PACE_LIMITATIONS,
      metricId: SPEAKING_PACE_METRIC_ID,
      outputRange: SPEAKING_PACE_OUTPUT_RANGE,
      outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
      reason: "transcript_empty",
      status: "unavailable",
      version: SPEAKING_PACE_VERSION,
    },
  );
});

test("returns unavailable when the duration is below the minimum threshold", () => {
  assert.deepStrictEqual(
    calculateSpeakingPace({
      sessionDurationSeconds: SPEAKING_PACE_MIN_SESSION_DURATION_SECONDS - 0.1,
      transcriptText: "steady pacing",
    }),
    {
      confidence: SPEAKING_PACE_CONFIDENCE,
      formula: SPEAKING_PACE_FORMULA,
      limitations: SPEAKING_PACE_LIMITATIONS,
      metricId: SPEAKING_PACE_METRIC_ID,
      outputRange: SPEAKING_PACE_OUTPUT_RANGE,
      outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
      reason: "duration_below_minimum",
      status: "unavailable",
      version: SPEAKING_PACE_VERSION,
    },
  );
});

test("returns unavailable when transcript generation fails", () => {
  assert.deepStrictEqual(
    calculateSpeakingPace({
      sessionDurationSeconds: 120,
      transcriptGenerationFailed: true,
      transcriptText: "steady pacing",
    }),
    {
      confidence: SPEAKING_PACE_CONFIDENCE,
      formula: SPEAKING_PACE_FORMULA,
      limitations: SPEAKING_PACE_LIMITATIONS,
      metricId: SPEAKING_PACE_METRIC_ID,
      outputRange: SPEAKING_PACE_OUTPUT_RANGE,
      outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
      reason: "transcript_generation_failed",
      status: "unavailable",
      version: SPEAKING_PACE_VERSION,
    },
  );
});

test("returns unavailable when the duration input is invalid", () => {
  assert.deepStrictEqual(
    calculateSpeakingPace({
      sessionDurationSeconds: Number.NaN,
      transcriptText: "steady pacing",
    }),
    {
      confidence: SPEAKING_PACE_CONFIDENCE,
      formula: SPEAKING_PACE_FORMULA,
      limitations: SPEAKING_PACE_LIMITATIONS,
      metricId: SPEAKING_PACE_METRIC_ID,
      outputRange: SPEAKING_PACE_OUTPUT_RANGE,
      outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
      reason: "duration_invalid",
      status: "unavailable",
      version: SPEAKING_PACE_VERSION,
    },
  );
});
