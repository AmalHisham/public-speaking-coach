import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FillerUsageMetric,
  getFillerUsageMetricResult,
} from "@/features/metrics/components/filler-usage-metric";

test("calculates filler usage from transcript text instead of transcript word entries", () => {
  const result = getFillerUsageMetricResult({
    transcript: {
      duration_seconds: 999,
      language: "en",
      model: "whisper-1",
      segments: [],
      text: "you know one two three",
      words: [],
    },
    transcriptGenerationFailed: false,
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.fillerCount, 1);
  assert.equal(result.totalWordCount, 5);
  assert.equal(result.value, 20);
});

test("renders filler usage details when calculation is available", () => {
  const html = renderToStaticMarkup(
    <FillerUsageMetric
      transcript={{
        duration_seconds: 999,
        language: "en",
        model: "whisper-1",
        segments: [],
        text: "um one two three",
        words: [],
      }}
      transcriptGenerationFailed={false}
    />,
  );

  assert.match(html, /25%/);
  assert.match(html, /Fillers counted: 1/);
  assert.match(html, /Total words: 4/);
});

test("renders unavailable when transcript generation fails", () => {
  const html = renderToStaticMarkup(
    <FillerUsageMetric transcript={null} transcriptGenerationFailed />,
  );

  assert.match(html, /Unavailable/);
  assert.match(html, /Transcript generation failed\./);
});
