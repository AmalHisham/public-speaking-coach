import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeAudioSilence,
  createSpeechActivityTimelineFromAudio,
  readTranscriptTimestampBounds,
  type BrowserAudioContext,
} from "@/features/speech/lib/audio-silence-analysis";

type AudioSegment = {
  amplitude: number;
  durationSeconds: number;
};

function createDecodedAudioBuffer(segments: readonly AudioSegment[]) {
  const sampleRate = 1_000;
  const samples: number[] = [];

  for (const segment of segments) {
    const sampleCount = Math.round(segment.durationSeconds * sampleRate);

    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(segment.amplitude);
    }
  }

  const channelData = Float32Array.from(samples);

  return {
    duration: channelData.length / sampleRate,
    getChannelData: () => channelData,
    length: channelData.length,
    numberOfChannels: 1,
    sampleRate,
  };
}

function createMockAudioContext(
  decodedAudio:
    | ReturnType<typeof createDecodedAudioBuffer>
    | Error,
): BrowserAudioContext {
  return {
    close: async () => {
      return;
    },
    decodeAudioData: async () => {
      if (decodedAudio instanceof Error) {
        throw decodedAudio;
      }

      return decodedAudio;
    },
  };
}

function createTranscriptWords(
  startTimeSeconds: number,
  endTimeSeconds: number,
) {
  return [
    {
      end: endTimeSeconds,
      start: startTimeSeconds,
      word: "steady",
    },
  ] as const;
}

test("reads transcript timestamp bounds without deriving the speech timeline from words", () => {
  assert.deepStrictEqual(
    readTranscriptTimestampBounds([
      {
        end: 0.4,
        start: 0.0,
        word: "steady",
      },
      {
        end: 1.8,
        start: 1.2,
        word: "helps",
      },
    ]),
    {
      endTimeSeconds: 1.8,
      startTimeSeconds: 0.0,
    },
  );
});

test("creates a speech activity timeline from decoded audio samples", () => {
  const speechActivityTimeline = createSpeechActivityTimelineFromAudio(
    createDecodedAudioBuffer([
      {
        amplitude: 0,
        durationSeconds: 0.4,
      },
      {
        amplitude: 0.2,
        durationSeconds: 0.6,
      },
      {
        amplitude: 0,
        durationSeconds: 0.5,
      },
      {
        amplitude: 0.2,
        durationSeconds: 0.4,
      },
    ]),
  );

  assert.deepStrictEqual(speechActivityTimeline, [
    {
      endTimeSeconds: 1,
      startTimeSeconds: 0.4,
    },
    {
      endTimeSeconds: 1.9,
      startTimeSeconds: 1.5,
    },
  ]);
});

test("returns unavailable when recorded audio is missing", async () => {
  assert.deepStrictEqual(
    await analyzeAudioSilence({
      audioBlob: null,
      transcriptWords: [],
    }),
    {
      reason: "audio_unavailable",
      status: "unavailable",
    },
  );
});

test("returns unavailable when transcript word timestamps are missing", async () => {
  assert.deepStrictEqual(
    await analyzeAudioSilence({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      createAudioContext: () =>
        createMockAudioContext(
          createDecodedAudioBuffer([
            {
              amplitude: 0.2,
              durationSeconds: 1,
            },
          ]),
        ),
      transcriptWords: null,
    }),
    {
      reason: "timestamp_generation_failure",
      status: "unavailable",
    },
  );
});

test("returns unavailable when AudioContext support is missing", async () => {
  assert.deepStrictEqual(
    await analyzeAudioSilence({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      createAudioContext: () => null,
      transcriptWords: createTranscriptWords(0, 1),
    }),
    {
      reason: "audio_unavailable",
      status: "unavailable",
    },
  );
});

test("returns unavailable when audio decoding fails", async () => {
  assert.deepStrictEqual(
    await analyzeAudioSilence({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      createAudioContext: () =>
        createMockAudioContext(new Error("decode failed")),
      transcriptWords: createTranscriptWords(0, 1),
    }),
    {
      reason: "audio_unavailable",
      status: "unavailable",
    },
  );
});

test("returns unavailable when decoded audio duration is invalid", async () => {
  assert.deepStrictEqual(
    await analyzeAudioSilence({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      createAudioContext: () =>
        createMockAudioContext({
          duration: 0,
          getChannelData: () => new Float32Array([0]),
          length: 1,
          numberOfChannels: 1,
          sampleRate: 1_000,
        }),
      transcriptWords: createTranscriptWords(0, 1),
    }),
    {
      reason: "audio_unavailable",
      status: "unavailable",
    },
  );
});

test("detects multiple silence regions from audio-derived speech segments", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0,
            durationSeconds: 0.2,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.4,
          },
          {
            amplitude: 0,
            durationSeconds: 0.6,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.4,
          },
          {
            amplitude: 0,
            durationSeconds: 0.5,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.3,
          },
          {
            amplitude: 0,
            durationSeconds: 0.2,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0.2, 2.4),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.deepStrictEqual(result.speechActivityTimeline, [
    {
      endTimeSeconds: 0.6,
      startTimeSeconds: 0.2,
    },
    {
      endTimeSeconds: 1.6,
      startTimeSeconds: 1.2,
    },
    {
      endTimeSeconds: 2.4,
      startTimeSeconds: 2.1,
    },
  ]);
  assert.equal(result.pauseTimeline.length, 2);
  assert.equal(result.pauseTimeline[0]?.durationSeconds, 0.6);
  assert.equal(result.pauseTimeline[1]?.durationSeconds, 0.5);
});

test("does not create a pause for silence below the 500 millisecond threshold", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0.2,
            durationSeconds: 0.5,
          },
          {
            amplitude: 0,
            durationSeconds: 0.49,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.5,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0, 1.49),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.pauseTimeline.length, 0);
});

test("creates a pause when silence is exactly 500 milliseconds", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0.2,
            durationSeconds: 0.5,
          },
          {
            amplitude: 0,
            durationSeconds: 0.5,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.5,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0, 1.5),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.pauseTimeline.length, 1);
  assert.equal(result.pauseTimeline[0]?.durationSeconds, 0.5);
});

test("returns no pauses when speech is continuous", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0.2,
            durationSeconds: 1.2,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0, 1.2),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.deepStrictEqual(result.speechActivityTimeline, [
    {
      endTimeSeconds: 1.2,
      startTimeSeconds: 0,
    },
  ]);
  assert.equal(result.pauseTimeline.length, 0);
});

test("preserves leading silence as the start offset of the first speech segment", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0,
            durationSeconds: 0.4,
          },
          {
            amplitude: 0.2,
            durationSeconds: 0.6,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0.4, 1),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.speechActivityTimeline[0]?.startTimeSeconds, 0.4);
  assert.equal(result.pauseTimeline.length, 0);
});

test("preserves trailing silence after the final speech segment without creating a pause", async () => {
  const result = await analyzeAudioSilence({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    createAudioContext: () =>
      createMockAudioContext(
        createDecodedAudioBuffer([
          {
            amplitude: 0.2,
            durationSeconds: 0.7,
          },
          {
            amplitude: 0,
            durationSeconds: 0.5,
          },
        ]),
      ),
    transcriptWords: createTranscriptWords(0, 0.7),
  });

  assert.equal(result.status, "available");

  if (result.status !== "available") {
    return;
  }

  assert.equal(result.speechActivityTimeline[0]?.endTimeSeconds, 0.7);
  assert.equal(result.pauseTimeline.length, 0);
});
