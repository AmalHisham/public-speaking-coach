"use client";

import { Button } from "@/components/ui/button";
import {
  FillerUsageMetric,
  type FillerUsageMetricProps,
} from "@/features/metrics/components/filler-usage-metric";
import { PauseQualityMetric } from "@/features/metrics/components/pause-quality-metric";
import {
  SpeakingPaceMetric,
  type SpeakingPaceMetricProps,
} from "@/features/metrics/components/speaking-pace-metric";
import type { AudioSilenceAnalysisResult } from "@/features/speech/lib/audio-silence-analysis";
import { analyzeAudioSilence } from "@/features/speech/lib/audio-silence-analysis";
import type {
  SpeechProcessingStatus,
  SpeechTranscription,
  SpeechTranscriptionWord,
} from "@/features/speech/lib/transcription-client";
import type { SessionTimerState } from "@/features/session/lib/session-timer";
import type { SessionStatus } from "@/types/session";
import { useSessionStore } from "@/stores/session-store";
import { useEffect, useState } from "react";

function getSpeechDescription(
  processingStatus:
    | "failed"
    | "idle"
    | "transcribing"
    | "transcript_ready"
    | "uploading",
  recordingStatus: "failed" | "idle" | "recorded" | "recording",
  hasAudioBlob: boolean,
): string {
  if (recordingStatus === "failed") {
    return "Browser recording did not complete, so no transcription request can be sent.";
  }

  if (recordingStatus === "recording") {
    return "Browser audio recording is active while the session is running.";
  }

  if (!hasAudioBlob) {
    return "Audio capture will begin after camera and microphone access succeed.";
  }

  switch (processingStatus) {
    case "uploading":
      return "Recording complete. Uploading audio to the backend transcription service.";
    case "transcribing":
      return "Audio upload finished and Whisper transcription is running on the backend.";
    case "transcript_ready":
      return "Transcription data is ready for later speech-analysis phases.";
    case "failed":
      return "Recording completed, but transcription did not finish successfully.";
    case "idle":
      return "Recording complete. Preparing the transcription request.";
  }
}

export function getTranscriptDisplayText(
  transcript: SpeechTranscription | null,
): string | null {
  if (transcript === null) {
    return null;
  }

  const normalizedText = transcript.text.trim();

  if (normalizedText.length === 0) {
    return null;
  }

  return normalizedText;
}

type SpeechMetricTranscriptState = {
  processingStatus: SpeechProcessingStatus;
  transcript: SpeechTranscription | null;
};

type PauseQualityMetricSpeechState = {
  audioBlob: Blob | null;
  processingStatus: SpeechProcessingStatus;
  recordingStatus: "failed" | "idle" | "recorded" | "recording";
  transcript: SpeechTranscription | null;
};

type PauseQualityAnalysisSnapshot = {
  analysis: AudioSilenceAnalysisResult;
  audioBlob: Blob;
  transcriptWords: readonly SpeechTranscriptionWord[] | null;
};

export type PauseQualityAnalysisInput = {
  audioBlob: Blob | null;
  shouldAnalyze: boolean;
  transcriptWords: readonly SpeechTranscriptionWord[] | null;
};

export function getFillerUsageMetricProps(
  speech: SpeechMetricTranscriptState,
): FillerUsageMetricProps {
  return {
    // The current app finalizes transcript text through the Whisper-backed
    // transcription pipeline, so a failed processing state is the runtime
    // mapping of the SPK-002 speech-recognition failure condition.
    transcriptGenerationFailed: speech.processingStatus === "failed",
    transcript: speech.transcript,
  };
}

export function getSpeakingPaceMetricProps(
  speech: SpeechMetricTranscriptState,
  timer: Pick<SessionTimerState, "elapsedMs">,
): SpeakingPaceMetricProps {
  return {
    sessionDurationMs: timer.elapsedMs,
    // The current app finalizes transcript text through the Whisper-backed
    // transcription pipeline, so a failed processing state is the runtime
    // mapping of the SPK-001 transcript-generation failure condition.
    transcriptGenerationFailed: speech.processingStatus === "failed",
    transcript: speech.transcript,
  };
}

export function getPauseQualityAnalysisInput(
  sessionStatus: SessionStatus,
  speech: PauseQualityMetricSpeechState,
): PauseQualityAnalysisInput {
  return {
    audioBlob: speech.audioBlob,
    shouldAnalyze:
      sessionStatus === "COMPLETED" &&
      speech.audioBlob !== null &&
      speech.recordingStatus === "recorded" &&
      (speech.processingStatus === "failed" ||
        speech.processingStatus === "transcript_ready"),
    transcriptWords: speech.transcript?.words ?? null,
  };
}

function matchesPauseQualityAnalysisSnapshot(
  snapshot: PauseQualityAnalysisSnapshot | null,
  analysisInput: PauseQualityAnalysisInput,
): snapshot is PauseQualityAnalysisSnapshot {
  return (
    snapshot !== null &&
    analysisInput.audioBlob !== null &&
    snapshot.audioBlob === analysisInput.audioBlob &&
    snapshot.transcriptWords === analysisInput.transcriptWords
  );
}

export function LiveTranscript() {
  const processCompletedSpeech = useSessionStore(
    (state) => state.processCompletedSpeech,
  );
  const sessionStatus = useSessionStore((state) => state.status);
  const speech = useSessionStore((state) => state.speech);
  const timer = useSessionStore((state) => state.timer);
  const [pauseQualityAnalysisSnapshot, setPauseQualityAnalysisSnapshot] =
    useState<PauseQualityAnalysisSnapshot | null>(null);
  const hasAudioBlob = speech.audioBlob !== null;
  const transcriptText = getTranscriptDisplayText(speech.transcript);
  const fillerUsageMetricProps = getFillerUsageMetricProps(speech);
  const pauseQualityAnalysisInput = getPauseQualityAnalysisInput(
    sessionStatus,
    speech,
  );
  const speakingPaceMetricProps = getSpeakingPaceMetricProps(speech, timer);
  const canRetryTranscription =
    sessionStatus === "COMPLETED" &&
    speech.audioBlob !== null &&
    speech.processingStatus === "failed" &&
    speech.recordingStatus === "recorded";
  const hasTranscript = speech.transcript !== null;
  const pauseQualityAnalysis: AudioSilenceAnalysisResult | null =
    sessionStatus !== "COMPLETED"
      ? null
      : speech.audioBlob === null
        ? {
            reason: "audio_unavailable",
            status: "unavailable",
          }
        : !pauseQualityAnalysisInput.shouldAnalyze
          ? null
          : matchesPauseQualityAnalysisSnapshot(
                pauseQualityAnalysisSnapshot,
                pauseQualityAnalysisInput,
              )
            ? pauseQualityAnalysisSnapshot.analysis
            : null;

  useEffect(() => {
    let isCancelled = false;

    if (
      !pauseQualityAnalysisInput.shouldAnalyze ||
      pauseQualityAnalysisInput.audioBlob === null
    ) {
      return () => {
        isCancelled = true;
      };
    }

    const audioBlob = pauseQualityAnalysisInput.audioBlob;

    void analyzeAudioSilence({
      audioBlob,
      transcriptWords: pauseQualityAnalysisInput.transcriptWords,
    }).then((analysis) => {
      if (!isCancelled) {
        setPauseQualityAnalysisSnapshot({
          analysis,
          audioBlob,
          transcriptWords: pauseQualityAnalysisInput.transcriptWords,
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [
    pauseQualityAnalysisInput.audioBlob,
    pauseQualityAnalysisInput.shouldAnalyze,
    pauseQualityAnalysisInput.transcriptWords,
  ]);

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm shadow-stone-200/60">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Speech Processing
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
            Recording and transcription
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-stone-700">
            {getSpeechDescription(
              speech.processingStatus,
              speech.recordingStatus,
              hasAudioBlob,
            )}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
            Speech State
          </p>
          <div className="mt-4 min-h-32 rounded-[1.25rem] border border-dashed border-stone-300 bg-white px-4 py-4 text-sm leading-7 text-stone-700">
            <p>Recording status: {speech.recordingStatus}</p>
            <p>Processing status: {speech.processingStatus}</p>
            <p>Audio retained: {hasAudioBlob ? "yes" : "no"}</p>
            <p>MIME type: {speech.recordingMimeType ?? "unavailable"}</p>
            <p>Blob size: {speech.audioBlob?.size ?? 0} bytes</p>
            <p>Transcript ready: {hasTranscript ? "yes" : "no"}</p>

            {speech.transcript ? (
              <>
                <p>Language: {speech.transcript.language ?? "unavailable"}</p>
                <p>Model: {speech.transcript.model}</p>
                <p>
                  Duration:{" "}
                  {speech.transcript.duration_seconds !== null
                    ? `${speech.transcript.duration_seconds} seconds`
                    : "unavailable"}
                </p>
                <p>Words captured: {speech.transcript.words.length}</p>
                <p>Segments captured: {speech.transcript.segments.length}</p>

                {transcriptText ? (
                  <div className="mt-4 rounded-[1rem] border border-stone-200 bg-stone-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Transcript
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-800">
                      {transcriptText}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

            {sessionStatus === "COMPLETED" ? (
              <>
                <SpeakingPaceMetric {...speakingPaceMetricProps} />
                <FillerUsageMetric {...fillerUsageMetricProps} />
                <PauseQualityMetric analysis={pauseQualityAnalysis} />
              </>
            ) : null}

            {speech.recordingError ? (
              <p className="text-rose-600">Recording error: {speech.recordingError}</p>
            ) : null}

            {speech.processingError ? (
              <p className="text-rose-600">
                Transcription error: {speech.processingError}
              </p>
            ) : null}
          </div>

          {canRetryTranscription ? (
            <div className="mt-4">
              <Button
                onClick={() => {
                  void processCompletedSpeech();
                }}
                size="sm"
                variant="outline"
              >
                Retry transcription
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
