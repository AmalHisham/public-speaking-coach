"use client";

import type { SpeechTranscription } from "@/features/speech/lib/transcription-client";
import {
  calculateFillerUsage,
  type FillerUsageMetricResult,
} from "@/features/metrics/lib/filler-usage";

export type FillerUsageMetricProps = {
  transcriptGenerationFailed: boolean;
  transcript: SpeechTranscription | null;
};

function formatPercentage(percentage: number): string {
  return Number.isInteger(percentage) ? `${percentage}` : percentage.toFixed(1);
}

function formatUnavailableReason(result: FillerUsageMetricResult): string {
  if (result.status === "available") {
    return "";
  }

  switch (result.reason) {
    case "transcript_generation_failed":
      return "Transcript generation failed.";
    case "transcript_empty":
      return "Transcript text was empty.";
    case "transcript_missing":
      return "Transcript is unavailable.";
  }
}

export function getFillerUsageMetricResult({
  transcript,
  transcriptGenerationFailed,
}: FillerUsageMetricProps): FillerUsageMetricResult {
  return calculateFillerUsage({
    transcriptGenerationFailed,
    transcriptText: transcript?.text ?? null,
  });
}

export function FillerUsageMetric({
  transcript,
  transcriptGenerationFailed,
}: FillerUsageMetricProps) {
  const result = getFillerUsageMetricResult({
    transcript,
    transcriptGenerationFailed,
  });

  return (
    <div className="mt-4 rounded-[1rem] border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Filler Usage
          </p>
          <p className="mt-2 text-sm leading-7 text-stone-700">
            Metric {result.metricId} {result.version}
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
          {result.confidence}
        </p>
      </div>

      {result.status === "available" ? (
        <div className="mt-4 space-y-2 text-sm leading-7 text-stone-700">
          <p className="text-3xl font-semibold tracking-tight text-stone-950">
            {formatPercentage(result.value)}%
          </p>
          <p>Rating: {result.rating}</p>
          <p>Fillers counted: {result.fillerCount}</p>
          <p>Total words: {result.totalWordCount}</p>
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
