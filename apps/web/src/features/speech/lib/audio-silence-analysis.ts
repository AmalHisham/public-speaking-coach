"use client";

import {
  collectPauseEvents,
  type AudioTimestamps,
  type PauseEvent,
  type PauseQualityUnavailableReason,
  type SpeechActivityTimelineEntry,
} from "@/features/metrics/lib/pause-quality";
import type { SpeechTranscriptionWord } from "@/features/speech/lib/transcription-client";

const AUDIO_ANALYSIS_FRAME_DURATION_SECONDS = 0.01;
const SILENCE_RMS_THRESHOLD = 0.01;

type DecodedAudioBuffer = {
  duration: number;
  getChannelData: (channel: number) => Float32Array;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
};

type TranscriptTimestampBounds = {
  endTimeSeconds: number;
  startTimeSeconds: number;
};

export type BrowserAudioContext = {
  close?: () => Promise<void>;
  decodeAudioData: (audioData: ArrayBuffer) => Promise<DecodedAudioBuffer>;
};

type BrowserAudioContextConstructor = new () => BrowserAudioContext;

type BrowserAudioWindow = Window &
  typeof globalThis & {
    AudioContext?: BrowserAudioContextConstructor;
    webkitAudioContext?: BrowserAudioContextConstructor;
  };

export type AudioSilenceAnalysisAvailableResult = {
  audioTimestamps: AudioTimestamps;
  pauseTimeline: readonly PauseEvent[];
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[];
  status: "available";
};

export type AudioSilenceAnalysisUnavailableResult = {
  reason: PauseQualityUnavailableReason;
  status: "unavailable";
};

export type AudioSilenceAnalysisResult =
  | AudioSilenceAnalysisAvailableResult
  | AudioSilenceAnalysisUnavailableResult;

type AnalyzeAudioSilenceInput = {
  audioBlob: Blob | null;
  createAudioContext?: () => BrowserAudioContext | null;
  transcriptWords: readonly SpeechTranscriptionWord[] | null;
};

function createUnavailableResult(
  reason: PauseQualityUnavailableReason,
): AudioSilenceAnalysisUnavailableResult {
  return {
    reason,
    status: "unavailable",
  };
}

function getBrowserAudioContextConstructor(
  browserWindow:
    | BrowserAudioWindow
    | null = typeof window === "undefined"
      ? null
      : (window as BrowserAudioWindow),
): BrowserAudioContextConstructor | null {
  if (!browserWindow) {
    return null;
  }

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
}

export function createBrowserAudioContext(
  AudioContextConstructor: BrowserAudioContextConstructor | null = getBrowserAudioContextConstructor(),
): BrowserAudioContext | null {
  if (!AudioContextConstructor) {
    return null;
  }

  return new AudioContextConstructor();
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function readTranscriptTimestampBounds(
  transcriptWords: readonly SpeechTranscriptionWord[],
): TranscriptTimestampBounds | null {
  if (transcriptWords.length === 0) {
    return null;
  }

  const sortedWords = [...transcriptWords].sort((left, right) => {
    if (left.start === right.start) {
      return left.end - right.end;
    }

    return left.start - right.start;
  });
  const firstWord = sortedWords[0];
  const lastWord = sortedWords.at(-1);

  if (!firstWord || !lastWord) {
    return null;
  }

  for (const word of sortedWords) {
    if (
      !isFiniteNumber(word.start) ||
      !isFiniteNumber(word.end) ||
      word.start < 0 ||
      word.end < word.start
    ) {
      return null;
    }
  }

  return {
    endTimeSeconds: lastWord.end,
    startTimeSeconds: firstWord.start,
  };
}

function isValidDecodedAudioBuffer(decodedAudio: DecodedAudioBuffer): boolean {
  return (
    isFiniteNumber(decodedAudio.duration) &&
    decodedAudio.duration > 0 &&
    Number.isInteger(decodedAudio.length) &&
    decodedAudio.length > 0 &&
    Number.isInteger(decodedAudio.numberOfChannels) &&
    decodedAudio.numberOfChannels > 0 &&
    isFiniteNumber(decodedAudio.sampleRate) &&
    decodedAudio.sampleRate > 0
  );
}

function readFrameRootMeanSquare(
  decodedAudio: DecodedAudioBuffer,
  frameStartSample: number,
  frameEndSample: number,
): number {
  let sumSquares = 0;
  let sampleCount = 0;

  for (
    let channelIndex = 0;
    channelIndex < decodedAudio.numberOfChannels;
    channelIndex += 1
  ) {
    const channelSamples = decodedAudio.getChannelData(channelIndex);

    for (
      let sampleIndex = frameStartSample;
      sampleIndex < frameEndSample;
      sampleIndex += 1
    ) {
      const sample = channelSamples[sampleIndex] ?? 0;

      sumSquares += sample * sample;
      sampleCount += 1;
    }
  }

  if (sampleCount === 0) {
    return 0;
  }

  return Math.sqrt(sumSquares / sampleCount);
}

export function createSpeechActivityTimelineFromAudio(
  decodedAudio: DecodedAudioBuffer,
): SpeechActivityTimelineEntry[] | null {
  if (!isValidDecodedAudioBuffer(decodedAudio)) {
    return null;
  }

  const frameSizeSamples = Math.max(
    1,
    Math.round(decodedAudio.sampleRate * AUDIO_ANALYSIS_FRAME_DURATION_SECONDS),
  );
  const speechActivityTimeline: SpeechActivityTimelineEntry[] = [];
  let activeSpeechStartSample: number | null = null;

  for (
    let frameStartSample = 0;
    frameStartSample < decodedAudio.length;
    frameStartSample += frameSizeSamples
  ) {
    const frameEndSample = Math.min(
      decodedAudio.length,
      frameStartSample + frameSizeSamples,
    );
    const frameRootMeanSquare = readFrameRootMeanSquare(
      decodedAudio,
      frameStartSample,
      frameEndSample,
    );
    const isSpeechFrame = frameRootMeanSquare > SILENCE_RMS_THRESHOLD;

    if (isSpeechFrame && activeSpeechStartSample === null) {
      activeSpeechStartSample = frameStartSample;
    }

    if (!isSpeechFrame && activeSpeechStartSample !== null) {
      speechActivityTimeline.push({
        endTimeSeconds: frameStartSample / decodedAudio.sampleRate,
        startTimeSeconds: activeSpeechStartSample / decodedAudio.sampleRate,
      });
      activeSpeechStartSample = null;
    }
  }

  if (activeSpeechStartSample !== null) {
    speechActivityTimeline.push({
      endTimeSeconds: decodedAudio.duration,
      startTimeSeconds: activeSpeechStartSample / decodedAudio.sampleRate,
    });
  }

  return speechActivityTimeline;
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

function overlapsTranscriptBounds(
  speechEntry: SpeechActivityTimelineEntry,
  transcriptTimestampBounds: TranscriptTimestampBounds,
): boolean {
  return (
    speechEntry.endTimeSeconds > transcriptTimestampBounds.startTimeSeconds &&
    speechEntry.startTimeSeconds < transcriptTimestampBounds.endTimeSeconds
  );
}

function filterSpeechActivityTimelineByTranscriptBounds(
  speechActivityTimeline: readonly SpeechActivityTimelineEntry[],
  transcriptTimestampBounds: TranscriptTimestampBounds,
): SpeechActivityTimelineEntry[] {
  return speechActivityTimeline.filter((entry) =>
    overlapsTranscriptBounds(entry, transcriptTimestampBounds),
  );
}

export async function analyzeAudioSilence({
  audioBlob,
  createAudioContext = createBrowserAudioContext,
  transcriptWords,
}: AnalyzeAudioSilenceInput): Promise<AudioSilenceAnalysisResult> {
  if (audioBlob === null) {
    return createUnavailableResult("audio_unavailable");
  }

  if (transcriptWords === null) {
    return createUnavailableResult("timestamp_generation_failure");
  }

  const transcriptTimestampBounds = readTranscriptTimestampBounds(transcriptWords);

  if (transcriptTimestampBounds === null) {
    return createUnavailableResult("timestamp_generation_failure");
  }

  const audioContext = createAudioContext();

  if (audioContext === null) {
    return createUnavailableResult("audio_unavailable");
  }

  try {
    const decodedAudio = await audioContext.decodeAudioData(
      await audioBlob.arrayBuffer(),
    );
    const speechActivityTimelineFromAudio =
      createSpeechActivityTimelineFromAudio(decodedAudio);

    if (speechActivityTimelineFromAudio === null) {
      return createUnavailableResult("audio_unavailable");
    }

    const audioTimestamps = {
      endTimeSeconds: decodedAudio.duration,
      startTimeSeconds: 0,
    };

    if (
      transcriptTimestampBounds.startTimeSeconds < audioTimestamps.startTimeSeconds ||
      transcriptTimestampBounds.endTimeSeconds > audioTimestamps.endTimeSeconds
    ) {
      return createUnavailableResult("timestamp_generation_failure");
    }

    const speechActivityTimeline = filterSpeechActivityTimelineByTranscriptBounds(
      speechActivityTimelineFromAudio,
      transcriptTimestampBounds,
    );

    if (
      speechActivityTimeline.length === 0 ||
      !speechActivityFitsWithinAudio(audioTimestamps, speechActivityTimeline)
    ) {
      return createUnavailableResult("timestamp_generation_failure");
    }

    return {
      audioTimestamps,
      pauseTimeline: collectPauseEvents(audioTimestamps, speechActivityTimeline),
      speechActivityTimeline,
      status: "available",
    };
  } catch {
    return createUnavailableResult("audio_unavailable");
  } finally {
    await audioContext.close?.();
  }
}
