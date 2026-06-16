"use client";

import type { SpeechTranscription } from "@/features/speech/lib/transcription-client";
import {
  calculateSpeakingPace,
  type SpeakingPaceMetricResult,
} from "@/features/metrics/lib/speaking-pace";

export type SpeakingPaceMetricProps = {
  sessionDurationMs: number;
  transcriptGenerationFailed: boolean;
  transcript: SpeechTranscription | null;
};

function formatWordsPerMinute(wordsPerMinute: number): string {
  return Number.isInteger(wordsPerMinute)
    ? `${wordsPerMinute}`
    : wordsPerMinute.toFixed(1);
}

function formatUnavailableReason(result: SpeakingPaceMetricResult): string {
  if (result.status === "available") {
    return "";
  }

  switch (result.reason) {
    case "duration_below_minimum":
      return "Session duration must be at least 10 seconds.";
    case "duration_invalid":
      return "Session duration was invalid.";
    case "transcript_generation_failed":
      return "Transcript generation failed.";
    case "transcript_empty":
      return "Transcript text was empty.";
    case "transcript_missing":
      return "Transcript is unavailable.";
  }
}

export function getSpeakingPaceMetricResult({
  sessionDurationMs,
  transcript,
  transcriptGenerationFailed,
}: SpeakingPaceMetricProps): SpeakingPaceMetricResult {
  return calculateSpeakingPace({
    sessionDurationSeconds: sessionDurationMs / 1000,
    transcriptGenerationFailed,
    transcriptText: transcript?.text ?? null,
  });
}

export function SpeakingPaceMetric({
  sessionDurationMs,
  transcriptGenerationFailed,
  transcript,
}: SpeakingPaceMetricProps) {
  const result = getSpeakingPaceMetricResult({
    sessionDurationMs,
    transcript,
    transcriptGenerationFailed,
  });

  return (
    <div className="mt-4 rounded-[1rem] border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Speaking Pace
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
            {formatWordsPerMinute(result.value)} WPM
          </p>
          <p>Rating: {result.rating}</p>
          <p>Words counted: {result.wordCount}</p>
          <p>Session duration: {result.sessionDurationSeconds} seconds</p>
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
