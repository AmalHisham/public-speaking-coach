export const PAUSE_QUALITY_METRIC_ID = "SPK-003";
export const PAUSE_QUALITY_VERSION = "v1";
export const PAUSE_QUALITY_CONFIDENCE = "High";
export const PAUSE_QUALITY_FORMULA =
  "silence_duration >= 500 milliseconds creates a pause event";
export const PAUSE_QUALITY_OUTPUT_TYPE = "Composite Metric";
export const PAUSE_QUALITY_MIN_SILENCE_DURATION_SECONDS = 0.5;
export const PAUSE_QUALITY_TARGET_RANGE = {
  averagePauseDurationSeconds: {
    max: 2.0,
    min: 0.5,
  },
} as const;
export const PAUSE_QUALITY_INPUTS = [
  "Audio timestamps",
  "Speech activity timeline",
] as const;
export const PAUSE_QUALITY_MEASUREMENTS = [
  "Pause Count",
  "Average Pause Duration",
  "Longest Pause",
] as const;
export const PAUSE_QUALITY_LIMITATIONS = [
  "Cannot determine rhetorical intent.",
  "Cannot distinguish intentional pauses from thinking pauses.",
] as const;

export type AudioTimestamps = {
  endTimeSeconds: number;
  startTimeSeconds: number;
};

export type SpeechActivityTimelineEntry = {
  endTimeSeconds: number;
  startTimeSeconds: number;
};

export type PauseEvent = {
  durationSeconds: number;
  endTimeSeconds: number;
  startTimeSeconds: number;
};

export type PauseQualityUnavailableReason =
  | "audio_unavailable"
  | "timestamp_generation_failure";

type PauseQualityBaseResult = {
  confidence: typeof PAUSE_QUALITY_CONFIDENCE;
  formula: typeof PAUSE_QUALITY_FORMULA;
  inputs: typeof PAUSE_QUALITY_INPUTS;
  limitations: typeof PAUSE_QUALITY_LIMITATIONS;
  measurements: typeof PAUSE_QUALITY_MEASUREMENTS;
  metricId: typeof PAUSE_QUALITY_METRIC_ID;
  outputType: typeof PAUSE_QUALITY_OUTPUT_TYPE;
  targetRange: typeof PAUSE_QUALITY_TARGET_RANGE;
  version: typeof PAUSE_QUALITY_VERSION;
};

export type AvailablePauseQualityMetricResult = PauseQualityBaseResult & {
  averagePauseDurationSeconds: number;
  longestPauseDurationSeconds: number;
  pauseCount: number;
  status: "available";
};

export type UnavailablePauseQualityMetricResult = PauseQualityBaseResult & {
  reason: PauseQualityUnavailableReason;
  status: "unavailable";
};

export type PauseQualityMetricResult =
  | AvailablePauseQualityMetricResult
  | UnavailablePauseQualityMetricResult;

export type CalculatePauseQualityInput = {
  audioTimestamps: AudioTimestamps | null;
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[] | null;
};

function createBaseResult(): PauseQualityBaseResult {
  return {
    confidence: PAUSE_QUALITY_CONFIDENCE,
    formula: PAUSE_QUALITY_FORMULA,
    inputs: PAUSE_QUALITY_INPUTS,
    limitations: PAUSE_QUALITY_LIMITATIONS,
    measurements: PAUSE_QUALITY_MEASUREMENTS,
    metricId: PAUSE_QUALITY_METRIC_ID,
    outputType: PAUSE_QUALITY_OUTPUT_TYPE,
    targetRange: PAUSE_QUALITY_TARGET_RANGE,
    version: PAUSE_QUALITY_VERSION,
  };
}

export function createPauseQualityUnavailableResult(
  reason: PauseQualityUnavailableReason,
): UnavailablePauseQualityMetricResult {
  return {
    ...createBaseResult(),
    reason,
    status: "unavailable",
  };
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function normalizeAudioTimestamps(
  audioTimestamps: AudioTimestamps | null,
): AudioTimestamps | null {
  if (audioTimestamps === null) {
    return null;
  }

  const { endTimeSeconds, startTimeSeconds } = audioTimestamps;

  if (
    !isFiniteNumber(startTimeSeconds) ||
    !isFiniteNumber(endTimeSeconds) ||
    startTimeSeconds < 0 ||
    endTimeSeconds < startTimeSeconds
  ) {
    return null;
  }

  return audioTimestamps;
}

function normalizeSpeechActivityTimeline(
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[] | null,
): SpeechActivityTimelineEntry[] | null {
  if (speechActivityTimeline === null || speechActivityTimeline.length === 0) {
    return null;
  }

  const sortedTimeline = [...speechActivityTimeline].sort((left, right) => {
    if (left.startTimeSeconds === right.startTimeSeconds) {
      return left.endTimeSeconds - right.endTimeSeconds;
    }

    return left.startTimeSeconds - right.startTimeSeconds;
  });

  const normalizedTimeline: SpeechActivityTimelineEntry[] = [];

  for (const entry of sortedTimeline) {
    if (
      !isFiniteNumber(entry.startTimeSeconds) ||
      !isFiniteNumber(entry.endTimeSeconds) ||
      entry.startTimeSeconds < 0 ||
      entry.endTimeSeconds < entry.startTimeSeconds
    ) {
      return null;
    }

    const currentEntry = {
      endTimeSeconds: entry.endTimeSeconds,
      startTimeSeconds: entry.startTimeSeconds,
    };
    const previousEntry = normalizedTimeline.at(-1);

    if (
      previousEntry &&
      currentEntry.startTimeSeconds <= previousEntry.endTimeSeconds
    ) {
      previousEntry.endTimeSeconds = Math.max(
        previousEntry.endTimeSeconds,
        currentEntry.endTimeSeconds,
      );

      continue;
    }

    normalizedTimeline.push(currentEntry);
  }

  return normalizedTimeline;
}

function speechActivityFitsWithinAudio(
  audioTimestamps: AudioTimestamps,
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[],
): boolean {
  return speechActivityTimeline.every(
    (entry) =>
      entry.startTimeSeconds >= audioTimestamps.startTimeSeconds &&
      entry.endTimeSeconds <= audioTimestamps.endTimeSeconds,
  );
}

export function collectPauseEvents(
  audioTimestamps: AudioTimestamps,
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[],
): PauseEvent[] {
  if (!speechActivityFitsWithinAudio(audioTimestamps, speechActivityTimeline)) {
    return [];
  }

  const pauses: PauseEvent[] = [];

  for (let index = 1; index < speechActivityTimeline.length; index += 1) {
    const previousEntry = speechActivityTimeline[index - 1];
    const currentEntry = speechActivityTimeline[index];

    if (!previousEntry || !currentEntry) {
      continue;
    }

    const durationSeconds =
      currentEntry.startTimeSeconds - previousEntry.endTimeSeconds;

    if (durationSeconds < PAUSE_QUALITY_MIN_SILENCE_DURATION_SECONDS) {
      continue;
    }

    pauses.push({
      durationSeconds,
      endTimeSeconds: currentEntry.startTimeSeconds,
      startTimeSeconds: previousEntry.endTimeSeconds,
    });
  }

  return pauses;
}

export function calculatePauseQuality({
  audioTimestamps,
  speechActivityTimeline,
}: CalculatePauseQualityInput): PauseQualityMetricResult {
  const normalizedAudioTimestamps = normalizeAudioTimestamps(audioTimestamps);

  if (normalizedAudioTimestamps === null) {
    return createPauseQualityUnavailableResult("audio_unavailable");
  }

  const normalizedSpeechActivityTimeline = normalizeSpeechActivityTimeline(
    speechActivityTimeline,
  );

  if (
    normalizedSpeechActivityTimeline === null ||
    !speechActivityFitsWithinAudio(
      normalizedAudioTimestamps,
      normalizedSpeechActivityTimeline,
    )
  ) {
    return createPauseQualityUnavailableResult("timestamp_generation_failure");
  }

  const pauses = collectPauseEvents(
    normalizedAudioTimestamps,
    normalizedSpeechActivityTimeline,
  );
  const pauseCount = pauses.length;
  const totalPauseDurationSeconds = pauses.reduce(
    (sum, pause) => sum + pause.durationSeconds,
    0,
  );
  const averagePauseDurationSeconds =
    pauseCount === 0 ? 0 : totalPauseDurationSeconds / pauseCount;
  const longestPauseDurationSeconds =
    pauseCount === 0
      ? 0
      : pauses.reduce(
          (longestDuration, pause) =>
            Math.max(longestDuration, pause.durationSeconds),
          0,
        );

  return {
    ...createBaseResult(),
    averagePauseDurationSeconds,
    longestPauseDurationSeconds,
    pauseCount,
    status: "available",
  };
}
