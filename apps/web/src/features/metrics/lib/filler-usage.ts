export const FILLER_USAGE_METRIC_ID = "SPK-002";
export const FILLER_USAGE_VERSION = "v1";
export const FILLER_USAGE_CONFIDENCE = "Very High";
export const FILLER_USAGE_FORMULA = "filler_count / total_words_spoken * 100";
export const FILLER_USAGE_OUTPUT_RANGE = {
  max: 100,
  min: 0,
} as const;
export const FILLER_USAGE_OUTPUT_UNIT = "percentage";
export const FILLER_USAGE_LIMITATIONS = [
  "Regional language patterns vary.",
  "Some fillers may be contextually valid.",
] as const;
export const FILLER_DICTIONARY_V1 = [
  "um",
  "uh",
  "like",
  "actually",
  "basically",
  "you know",
  "so",
] as const;

export type FillerUsageRating = "Excellent" | "Good" | "Fair" | "Poor";

export type FillerUsageUnavailableReason =
  | "transcript_generation_failed"
  | "transcript_missing"
  | "transcript_empty";

type FillerUsageBaseResult = {
  confidence: typeof FILLER_USAGE_CONFIDENCE;
  fillerDictionary: typeof FILLER_DICTIONARY_V1;
  formula: typeof FILLER_USAGE_FORMULA;
  limitations: typeof FILLER_USAGE_LIMITATIONS;
  metricId: typeof FILLER_USAGE_METRIC_ID;
  outputRange: typeof FILLER_USAGE_OUTPUT_RANGE;
  outputUnit: typeof FILLER_USAGE_OUTPUT_UNIT;
  version: typeof FILLER_USAGE_VERSION;
};

export type AvailableFillerUsageMetricResult = FillerUsageBaseResult & {
  fillerCount: number;
  rating: FillerUsageRating;
  status: "available";
  totalWordCount: number;
  value: number;
};

export type UnavailableFillerUsageMetricResult = FillerUsageBaseResult & {
  reason: FillerUsageUnavailableReason;
  status: "unavailable";
};

export type FillerUsageMetricResult =
  | AvailableFillerUsageMetricResult
  | UnavailableFillerUsageMetricResult;

export type CalculateFillerUsageInput = {
  transcriptGenerationFailed?: boolean;
  transcriptText: string | null;
};

function createBaseResult(): FillerUsageBaseResult {
  return {
    confidence: FILLER_USAGE_CONFIDENCE,
    fillerDictionary: FILLER_DICTIONARY_V1,
    formula: FILLER_USAGE_FORMULA,
    limitations: FILLER_USAGE_LIMITATIONS,
    metricId: FILLER_USAGE_METRIC_ID,
    outputRange: FILLER_USAGE_OUTPUT_RANGE,
    outputUnit: FILLER_USAGE_OUTPUT_UNIT,
    version: FILLER_USAGE_VERSION,
  };
}

function createUnavailableResult(
  reason: FillerUsageUnavailableReason,
): UnavailableFillerUsageMetricResult {
  return {
    ...createBaseResult(),
    reason,
    status: "unavailable",
  };
}

function escapeForRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createFillerMatcher(filler: string): RegExp {
  const pattern = filler
    .trim()
    .split(/\s+/)
    .map(escapeForRegularExpression)
    .join("\\s+");

  return new RegExp(`\\b${pattern}\\b`, "gi");
}

export function countTranscriptWords(transcriptText: string): number {
  const normalizedTranscript = transcriptText.trim();

  if (normalizedTranscript.length === 0) {
    return 0;
  }

  return normalizedTranscript.split(/\s+/).length;
}

export function countFillersInTranscript(transcriptText: string): number {
  return FILLER_DICTIONARY_V1.reduce((fillerCount, filler) => {
    const matches = transcriptText.match(createFillerMatcher(filler));

    return fillerCount + (matches?.length ?? 0);
  }, 0);
}

export function classifyFillerUsage(percentage: number): FillerUsageRating {
  if (percentage <= 1) {
    return "Excellent";
  }

  if (percentage <= 2) {
    return "Good";
  }

  if (percentage <= 3) {
    return "Fair";
  }

  return "Poor";
}

export function calculateFillerUsage({
  transcriptGenerationFailed = false,
  transcriptText,
}: CalculateFillerUsageInput): FillerUsageMetricResult {
  if (transcriptGenerationFailed) {
    return createUnavailableResult("transcript_generation_failed");
  }

  if (transcriptText === null) {
    return createUnavailableResult("transcript_missing");
  }

  const totalWordCount = countTranscriptWords(transcriptText);

  if (totalWordCount === 0) {
    return createUnavailableResult("transcript_empty");
  }

  const fillerCount = countFillersInTranscript(transcriptText);
  const value = (fillerCount / totalWordCount) * 100;

  return {
    ...createBaseResult(),
    fillerCount,
    rating: classifyFillerUsage(value),
    status: "available",
    totalWordCount,
    value,
  };
}
