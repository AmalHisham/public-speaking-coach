import assert from "node:assert/strict";
import test from "node:test";

import {
  getFillerUsageMetricProps,
  getPauseQualityAnalysisInput,
  getSpeakingPaceMetricProps,
  getTranscriptDisplayText,
} from "@/features/speech/components/live-transcript";

test("returns transcript text when a completed transcription is available", () => {
  const transcriptText = getTranscriptDisplayText({
    duration_seconds: 8.2,
    language: "en",
    model: "whisper-1",
    segments: [
      {
        end: 1.0,
        id: 0,
        start: 0.0,
        text: "steady pacing",
      },
    ],
    text: " steady pacing ",
    words: [
      {
        end: 0.6,
        start: 0.0,
        word: "steady",
      },
      {
        end: 1.0,
        start: 0.6,
        word: "pacing",
      },
    ],
  });

  assert.equal(transcriptText, "steady pacing");
});

test("returns null when transcription text is unavailable", () => {
  assert.equal(getTranscriptDisplayText(null), null);
  assert.equal(
    getTranscriptDisplayText({
      duration_seconds: 8.2,
      language: "en",
      model: "whisper-1",
      segments: [],
      text: "   ",
      words: [],
    }),
    null,
  );
});

test("maps the canonical speech transcript and timer elapsed time into speaking pace props", () => {
  const transcript = {
    duration_seconds: 42,
    language: "en",
    model: "whisper-1",
    segments: [],
    text: "steady pacing",
    words: [],
  };

  const metricProps = getSpeakingPaceMetricProps(
    {
      processingStatus: "transcript_ready",
      transcript,
    },
    {
      elapsedMs: 31_500,
    },
  );

  assert.equal(metricProps.sessionDurationMs, 31_500);
  assert.equal(metricProps.transcript, transcript);
  assert.equal(metricProps.transcriptGenerationFailed, false);
});

test("maps the canonical speech transcript into filler usage props", () => {
  const transcript = {
    duration_seconds: 42,
    language: "en",
    model: "whisper-1",
    segments: [],
    text: "steady pacing",
    words: [],
  };

  const metricProps = getFillerUsageMetricProps({
    processingStatus: "transcript_ready",
    transcript,
  });

  assert.equal(metricProps.transcript, transcript);
  assert.equal(metricProps.transcriptGenerationFailed, false);
});

test("maps failed transcript processing into the speaking pace unavailable state", () => {
  const metricProps = getSpeakingPaceMetricProps(
    {
      processingStatus: "failed",
      transcript: null,
    },
    {
      elapsedMs: 12_000,
    },
  );

  assert.equal(metricProps.sessionDurationMs, 12_000);
  assert.equal(metricProps.transcript, null);
  assert.equal(metricProps.transcriptGenerationFailed, true);
});

test("maps failed transcript processing into the filler usage unavailable state", () => {
  const metricProps = getFillerUsageMetricProps({
    processingStatus: "failed",
    transcript: null,
  });

  assert.equal(metricProps.transcript, null);
  assert.equal(metricProps.transcriptGenerationFailed, true);
});

test("starts pause-quality analysis when the completed session has audio and word timestamps", () => {
  const audioBlob = new Blob(["steady pacing"], { type: "audio/webm" });
  const transcript = {
    duration_seconds: 42,
    language: "en",
    model: "whisper-1",
    segments: [],
    text: "steady pacing",
    words: [
      {
        end: 0.5,
        start: 0.0,
        word: "steady",
      },
    ],
  };

  const analysisInput = getPauseQualityAnalysisInput("COMPLETED", {
    audioBlob,
    processingStatus: "transcript_ready",
    recordingStatus: "recorded",
    transcript,
  });

  assert.equal(analysisInput.shouldAnalyze, true);
  assert.equal(analysisInput.audioBlob, audioBlob);
  assert.equal(analysisInput.transcriptWords, transcript.words);
});

test("waits for a final transcription state before pause-quality analysis begins", () => {
  const analysisInput = getPauseQualityAnalysisInput("COMPLETED", {
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    processingStatus: "transcribing",
    recordingStatus: "recorded",
    transcript: null,
  });

  assert.equal(analysisInput.shouldAnalyze, false);
  assert.equal(analysisInput.transcriptWords, null);
});
