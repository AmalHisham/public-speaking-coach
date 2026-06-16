export const SPEAKING_PACE_METRIC_ID = "SPK-001";
export const SPEAKING_PACE_VERSION = "v1";
export const SPEAKING_PACE_CONFIDENCE = "Very High";
export const SPEAKING_PACE_FORMULA = "words_spoken / speaking_minutes";
export const SPEAKING_PACE_MIN_SESSION_DURATION_SECONDS = 10;
export const SPEAKING_PACE_OUTPUT_RANGE = {
  max: 300,
  min: 0,
} as const;
export const SPEAKING_PACE_OUTPUT_UNIT = "words_per_minute";
export const SPEAKING_PACE_LIMITATIONS = [
  "Speaking style varies by context.",
  "Fast speakers can still be effective.",
] as const;

export type SpeakingPaceRating = "Excellent" | "Good" | "Needs Improvement";

export type SpeakingPaceUnavailableReason =
  | "duration_invalid"
  | "duration_below_minimum"
  | "transcript_generation_failed"
  | "transcript_missing"
  | "transcript_empty";

type SpeakingPaceBaseResult = {
  confidence: typeof SPEAKING_PACE_CONFIDENCE;
  formula: typeof SPEAKING_PACE_FORMULA;
  limitations: typeof SPEAKING_PACE_LIMITATIONS;
  metricId: typeof SPEAKING_PACE_METRIC_ID;
  outputRange: typeof SPEAKING_PACE_OUTPUT_RANGE;
  outputUnit: typeof SPEAKING_PACE_OUTPUT_UNIT;
  version: typeof SPEAKING_PACE_VERSION;
};

export type AvailableSpeakingPaceMetricResult = SpeakingPaceBaseResult & {
  rating: SpeakingPaceRating;
  sessionDurationSeconds: number;
  speakingMinutes: number;
  status: "available";
  value: number;
  wordCount: number;
};

export type UnavailableSpeakingPaceMetricResult = SpeakingPaceBaseResult & {
  reason: SpeakingPaceUnavailableReason;
  status: "unavailable";
};

export type SpeakingPaceMetricResult =
  | AvailableSpeakingPaceMetricResult
  | UnavailableSpeakingPaceMetricResult;

export type CalculateSpeakingPaceInput = {
  sessionDurationSeconds: number;
  transcriptGenerationFailed?: boolean;
  transcriptText: string | null;
};

function createBaseResult(): SpeakingPaceBaseResult {
  return {
    confidence: SPEAKING_PACE_CONFIDENCE,
    formula: SPEAKING_PACE_FORMULA,
    limitations: SPEAKING_PACE_LIMITATIONS,
    metricId: SPEAKING_PACE_METRIC_ID,
    outputRange: SPEAKING_PACE_OUTPUT_RANGE,
    outputUnit: SPEAKING_PACE_OUTPUT_UNIT,
    version: SPEAKING_PACE_VERSION,
  };
}

function createUnavailableResult(
  reason: SpeakingPaceUnavailableReason,
): UnavailableSpeakingPaceMetricResult {
  return {
    ...createBaseResult(),
    reason,
    status: "unavailable",
  };
}

export function countTranscriptWords(transcriptText: string): number {
  const normalizedTranscript = transcriptText.trim();

  if (normalizedTranscript.length === 0) {
    return 0;
  }

  return normalizedTranscript.split(/\s+/).length;
}

export function classifySpeakingPace(
  wordsPerMinute: number,
): SpeakingPaceRating {
  if (wordsPerMinute >= 140 && wordsPerMinute <= 160) {
    return "Excellent";
  }

  if (
    (wordsPerMinute >= 120 && wordsPerMinute < 140) ||
    (wordsPerMinute > 160 && wordsPerMinute <= 180)
  ) {
    return "Good";
  }

  return "Needs Improvement";
}

export function calculateSpeakingPace({
  sessionDurationSeconds,
  transcriptGenerationFailed = false,
  transcriptText,
}: CalculateSpeakingPaceInput): SpeakingPaceMetricResult {
  if (transcriptGenerationFailed) {
    return createUnavailableResult("transcript_generation_failed");
  }

  if (transcriptText === null) {
    return createUnavailableResult("transcript_missing");
  }

  if (!Number.isFinite(sessionDurationSeconds)) {
    return createUnavailableResult("duration_invalid");
  }

  if (sessionDurationSeconds < SPEAKING_PACE_MIN_SESSION_DURATION_SECONDS) {
    return createUnavailableResult("duration_below_minimum");
  }

  const wordCount = countTranscriptWords(transcriptText);

  if (wordCount === 0) {
    return createUnavailableResult("transcript_empty");
  }

  const speakingMinutes = sessionDurationSeconds / 60;
  const value = wordCount / speakingMinutes;

  return {
    ...createBaseResult(),
    rating: classifySpeakingPace(value),
    sessionDurationSeconds,
    speakingMinutes,
    status: "available",
    value,
    wordCount,
  };
}
