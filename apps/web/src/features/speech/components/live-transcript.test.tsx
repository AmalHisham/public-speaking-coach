import assert from "node:assert/strict";
import test from "node:test";

import { getTranscriptDisplayText } from "@/features/speech/components/live-transcript";

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
