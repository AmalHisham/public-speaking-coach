import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getSpeakingPaceMetricResult,
  SpeakingPaceMetric,
} from "@/features/metrics/components/speaking-pace-metric";

test("calculates speaking pace from transcript text instead of transcript word entries", () => {
  const result = getSpeakingPaceMetricResult({
    sessionDurationMs: 30_000,
    transcript: {
      duration_seconds: 999,
      language: "en",
      model: "whisper-1",
      segments: [],
      text: "one two three four",
      words: [],
    },
    transcriptGenerationFailed: false,
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.wordCount, 4);
  assert.equal(result.value, 8);
});

test("calculates speaking pace from timer elapsed time instead of transcript duration", () => {
  const html = renderToStaticMarkup(
    <SpeakingPaceMetric
      sessionDurationMs={30_000}
      transcript={{
        duration_seconds: 999,
        language: "en",
        model: "whisper-1",
        segments: [],
        text: "one two three four",
        words: [],
      }}
      transcriptGenerationFailed={false}
    />,
  );

  assert.match(html, /8 WPM/);
  assert.match(html, /Session duration: 30 seconds/);
  assert.doesNotMatch(html, /Session duration: 999 seconds/);
});

test("renders unavailable when transcript generation fails", () => {
  const html = renderToStaticMarkup(
    <SpeakingPaceMetric
      sessionDurationMs={30_000}
      transcript={null}
      transcriptGenerationFailed
    />,
  );

  assert.match(html, /Unavailable/);
  assert.match(html, /Transcript generation failed\./);
});

test("renders unavailable when the session duration is below the minimum threshold", () => {
  const html = renderToStaticMarkup(
    <SpeakingPaceMetric
      sessionDurationMs={9_000}
      transcript={{
        duration_seconds: 60,
        language: "en",
        model: "whisper-1",
        segments: [],
        text: "one two three four",
        words: [],
      }}
      transcriptGenerationFailed={false}
    />,
  );

  assert.match(html, /Unavailable/);
  assert.match(html, /Session duration must be at least 10 seconds\./);
});
