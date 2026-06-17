import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getPauseQualityMetricResult,
  PauseQualityMetric,
} from "@/features/metrics/components/pause-quality-metric";

test("calculates pause quality from analyzed timestamps instead of transcript text", () => {
  const result = getPauseQualityMetricResult({
    analysis: {
      audioTimestamps: {
        endTimeSeconds: 4,
        startTimeSeconds: 0,
      },
      pauseTimeline: [],
      speechActivityTimeline: [
        {
          endTimeSeconds: 0.4,
          startTimeSeconds: 0.0,
        },
        {
          endTimeSeconds: 1.6,
          startTimeSeconds: 1.0,
        },
      ],
      status: "available",
    },
  });

  assert.equal(result?.status, "available");

  if (result === null || result.status !== "available") {
    return;
  }

  assert.equal(result.pauseCount, 1);
  assert.equal(result.averagePauseDurationSeconds, 0.6);
  assert.equal(result.longestPauseDurationSeconds, 0.6);
});

test("renders pause quality details when calculation is available", () => {
  const html = renderToStaticMarkup(
    <PauseQualityMetric
      analysis={{
        audioTimestamps: {
          endTimeSeconds: 4,
          startTimeSeconds: 0,
        },
        pauseTimeline: [],
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
            startTimeSeconds: 2.2,
          },
        ],
        status: "available",
      }}
    />,
  );

  assert.match(html, /Pause count: 2/);
  assert.match(html, /Average pause duration: 0.6 seconds/);
  assert.match(html, /Longest pause: 0.7 seconds/);
});

test("renders unavailable when timestamp generation fails", () => {
  const html = renderToStaticMarkup(
    <PauseQualityMetric
      analysis={{
        reason: "timestamp_generation_failure",
        status: "unavailable",
      }}
    />,
  );

  assert.match(html, /Unavailable/);
  assert.match(html, /Timestamp generation failed\./);
});

test("renders an analyzing state while pause-quality analysis is pending", () => {
  const html = renderToStaticMarkup(<PauseQualityMetric analysis={null} />);

  assert.match(html, /Analyzing\.\.\./);
  assert.match(html, /Preparing pause-quality inputs from recorded audio\./);
});
