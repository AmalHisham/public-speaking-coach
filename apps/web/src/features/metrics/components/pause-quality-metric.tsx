"use client";

import {
  calculatePauseQuality,
  createPauseQualityUnavailableResult,
  type PauseQualityMetricResult,
} from "@/features/metrics/lib/pause-quality";
import type { AudioSilenceAnalysisResult } from "@/features/speech/lib/audio-silence-analysis";

export type PauseQualityMetricProps = {
  analysis: AudioSilenceAnalysisResult | null;
};

function formatDurationSeconds(durationSeconds: number): string {
  return Number.isInteger(durationSeconds)
    ? `${durationSeconds}`
    : durationSeconds.toFixed(1);
}

function formatUnavailableReason(result: PauseQualityMetricResult): string {
  if (result.status === "available") {
    return "";
  }

  switch (result.reason) {
    case "audio_unavailable":
      return "Audio is unavailable.";
    case "timestamp_generation_failure":
      return "Timestamp generation failed.";
  }
}

export function getPauseQualityMetricResult(
  props: PauseQualityMetricProps,
): PauseQualityMetricResult | null {
  if (props.analysis === null) {
    return null;
  }

  if (props.analysis.status === "unavailable") {
    return createPauseQualityUnavailableResult(props.analysis.reason);
  }

  return calculatePauseQuality({
    audioTimestamps: props.analysis.audioTimestamps,
    speechActivityTimeline: props.analysis.speechActivityTimeline,
  });
}

export function PauseQualityMetric(props: PauseQualityMetricProps) {
  const result = getPauseQualityMetricResult(props);

  return (
    <div className="mt-4 rounded-[1rem] border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Pause Quality
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Metric SPK-003 v1
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
          High
        </p>
      </div>

      {result === null ? (
        <div className="mt-4 space-y-2 text-sm leading-7 text-stone-700">
          <p className="text-lg font-semibold tracking-tight text-stone-950">
            Analyzing...
          </p>
          <p>Preparing pause-quality inputs from recorded audio.</p>
        </div>
      ) : result.status === "available" ? (
        <div className="mt-4 space-y-2 text-sm leading-7 text-stone-700">
          <p>Pause count: {result.pauseCount}</p>
          <p>
            Average pause duration:{" "}
            {formatDurationSeconds(result.averagePauseDurationSeconds)} seconds
          </p>
          <p>
            Longest pause:{" "}
            {formatDurationSeconds(result.longestPauseDurationSeconds)} seconds
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2 text-sm leading-7 text-stone-700">
          <p className="text-lg font-semibold tracking-tight text-stone-950">
            Unavailable
          </p>
          <p>{formatUnavailableReason(result)}</p>
        </div>
      )}
    </div>
  );
}
