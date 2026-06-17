import assert from "node:assert/strict";
import test from "node:test";

import {
  FILLER_DICTIONARY_V1,
  FILLER_USAGE_CONFIDENCE,
  FILLER_USAGE_FORMULA,
  FILLER_USAGE_LIMITATIONS,
  FILLER_USAGE_METRIC_ID,
  FILLER_USAGE_OUTPUT_RANGE,
  FILLER_USAGE_OUTPUT_UNIT,
  FILLER_USAGE_VERSION,
  calculateFillerUsage,
  classifyFillerUsage,
  countFillersInTranscript,
  countTranscriptWords,
} from "@/features/metrics/lib/filler-usage";

test("counts transcript words from normalized transcript text", () => {
  assert.equal(countTranscriptWords("  you know   steady\npractice  "), 4);
  assert.equal(countTranscriptWords("one-word"), 1);
});

test("counts single-word fillers from the approved dictionary", () => {
  assert.equal(countFillersInTranscript("um uh like actually basically so"), 6);
});

test('counts the "you know" filler phrase as a single filler occurrence', () => {
  assert.equal(countFillersInTranscript("you know this takes practice"), 1);
  assert.equal(countFillersInTranscript("you know, you know"), 2);
});

test("matches filler usage case-insensitively", () => {
  assert.equal(countFillersInTranscript("UM uh LIKE Actually basically So"), 6);
});

test("counts fillers when punctuation is attached", () => {
  assert.equal(
    countFillersInTranscript("Um, actually. basically! so? you know... uh;"),
    6,
  );
});

test("protects word boundaries when matching filler words", () => {
  assert.equal(
    countFillersInTranscript("likelihood something summary also"),
    0,
  );
});

test("calculates filler usage percentage from filler count and total words", () => {
  const result = calculateFillerUsage({
    transcriptText: "um steady delivery builds trust",
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.metricId, FILLER_USAGE_METRIC_ID);
  assert.equal(result.version, FILLER_USAGE_VERSION);
  assert.equal(result.confidence, FILLER_USAGE_CONFIDENCE);
  assert.equal(result.formula, FILLER_USAGE_FORMULA);
  assert.deepStrictEqual(result.outputRange, FILLER_USAGE_OUTPUT_RANGE);
  assert.equal(result.outputUnit, FILLER_USAGE_OUTPUT_UNIT);
  assert.deepStrictEqual(result.limitations, FILLER_USAGE_LIMITATIONS);
  assert.deepStrictEqual(result.fillerDictionary, FILLER_DICTIONARY_V1);
  assert.equal(result.fillerCount, 1);
  assert.equal(result.totalWordCount, 5);
  assert.equal(result.value, 20);
  assert.equal(result.rating, "Poor");
});

test("classifies filler usage using the spec target bands", () => {
  assert.equal(classifyFillerUsage(0), "Excellent");
  assert.equal(classifyFillerUsage(1), "Excellent");
  assert.equal(classifyFillerUsage(1.01), "Good");
  assert.equal(classifyFillerUsage(2), "Good");
  assert.equal(classifyFillerUsage(2.01), "Fair");
  assert.equal(classifyFillerUsage(3), "Fair");
  assert.equal(classifyFillerUsage(3.01), "Poor");
});

test("returns unavailable when the transcript is missing", () => {
  assert.deepStrictEqual(
    calculateFillerUsage({
      transcriptText: null,
    }),
    {
      confidence: FILLER_USAGE_CONFIDENCE,
      fillerDictionary: FILLER_DICTIONARY_V1,
      formula: FILLER_USAGE_FORMULA,
      limitations: FILLER_USAGE_LIMITATIONS,
      metricId: FILLER_USAGE_METRIC_ID,
      outputRange: FILLER_USAGE_OUTPUT_RANGE,
      outputUnit: FILLER_USAGE_OUTPUT_UNIT,
      reason: "transcript_missing",
      status: "unavailable",
      version: FILLER_USAGE_VERSION,
    },
  );
});

test("returns unavailable when the transcript is empty", () => {
  assert.deepStrictEqual(
    calculateFillerUsage({
      transcriptText: "   \n\t  ",
    }),
    {
      confidence: FILLER_USAGE_CONFIDENCE,
      fillerDictionary: FILLER_DICTIONARY_V1,
      formula: FILLER_USAGE_FORMULA,
      limitations: FILLER_USAGE_LIMITATIONS,
      metricId: FILLER_USAGE_METRIC_ID,
      outputRange: FILLER_USAGE_OUTPUT_RANGE,
      outputUnit: FILLER_USAGE_OUTPUT_UNIT,
      reason: "transcript_empty",
      status: "unavailable",
      version: FILLER_USAGE_VERSION,
    },
  );
});

test("returns unavailable when transcript generation fails", () => {
  assert.deepStrictEqual(
    calculateFillerUsage({
      transcriptGenerationFailed: true,
      transcriptText: "steady pacing",
    }),
    {
      confidence: FILLER_USAGE_CONFIDENCE,
      fillerDictionary: FILLER_DICTIONARY_V1,
      formula: FILLER_USAGE_FORMULA,
      limitations: FILLER_USAGE_LIMITATIONS,
      metricId: FILLER_USAGE_METRIC_ID,
      outputRange: FILLER_USAGE_OUTPUT_RANGE,
      outputUnit: FILLER_USAGE_OUTPUT_UNIT,
      reason: "transcript_generation_failed",
      status: "unavailable",
      version: FILLER_USAGE_VERSION,
    },
  );
});
