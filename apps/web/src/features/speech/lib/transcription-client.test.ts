import assert from "node:assert/strict";
import test from "node:test";

import { requestSpeechTranscription } from "@/features/speech/lib/transcription-client";

function createTranscriptionResponseBody() {
  return {
    duration_seconds: 8.2,
    language: "en",
    model: "whisper-1",
    segments: [
      {
        end: 1.5,
        id: 0,
        start: 0,
        text: "steady pacing",
      },
    ],
    text: "steady pacing",
    words: [
      {
        end: 0.6,
        start: 0,
        word: "steady",
      },
      {
        end: 1.2,
        start: 0.7,
        word: "pacing",
      },
    ],
  };
}

test("uploads audio using multipart form data and reports status changes", async () => {
  const observedStatuses: string[] = [];
  let receivedAuthorizationHeader: string | null = null;
  let receivedMethod: string | null = null;
  let receivedFileName: string | null = null;
  let receivedFileText: string | null = null;
  const abortController = new AbortController();
  let receivedSignal: AbortSignal | null = null;

  const transcript = await requestSpeechTranscription({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    fetchImplementation: async (_input, init) => {
      receivedAuthorizationHeader = init?.headers
        ? (init.headers as Record<string, string>).Authorization
        : null;
      receivedMethod = init?.method ?? null;
      receivedSignal = init?.signal ?? null;

      assert.ok(init?.body instanceof FormData);

      const uploadedAudio = init.body.get("audio");

      assert.ok(uploadedAudio instanceof File);
      receivedFileName = uploadedAudio.name;
      receivedFileText = await uploadedAudio.text();

      return new Response(JSON.stringify(createTranscriptionResponseBody()), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      });
    },
    onStatusChange: (status) => {
      observedStatuses.push(status);
    },
    recordingMimeType: "audio/webm",
    signal: abortController.signal,
    token: "clerk-token",
  });

  assert.deepStrictEqual(observedStatuses, ["uploading", "transcribing"]);
  assert.equal(receivedAuthorizationHeader, "Bearer clerk-token");
  assert.equal(receivedMethod, "POST");
  assert.equal(receivedSignal, abortController.signal);
  assert.equal(receivedFileName, "session-recording.webm");
  assert.equal(receivedFileText, "steady pacing");
  assert.equal(transcript.text, "steady pacing");
});

test("passes abort signals through to the upload request", async () => {
  const abortController = new AbortController();
  const requestPromise = requestSpeechTranscription({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    fetchImplementation: async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      }),
    recordingMimeType: "audio/webm",
    signal: abortController.signal,
    token: "clerk-token",
  });

  abortController.abort();

  await assert.rejects(
    requestPromise,
    {
      name: "AbortError",
    },
  );
});

test("returns the normalized transcript payload on success", async () => {
  const transcript = await requestSpeechTranscription({
    audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
    fetchImplementation: async () =>
      new Response(JSON.stringify(createTranscriptionResponseBody()), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 200,
      }),
    recordingMimeType: "audio/webm;codecs=opus",
    token: "clerk-token",
  });

  assert.deepStrictEqual(transcript, createTranscriptionResponseBody());
});

test("surfaces backend upload validation failures", async () => {
  await assert.rejects(
    requestSpeechTranscription({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      fetchImplementation: async () =>
        new Response(JSON.stringify({ detail: "Unsupported audio format." }), {
          headers: {
            "Content-Type": "application/json",
          },
          status: 400,
        }),
      recordingMimeType: "audio/webm",
      token: "clerk-token",
    }),
    {
      message: "Unsupported audio format.",
    },
  );
});

test("surfaces backend transcription failures", async () => {
  await assert.rejects(
    requestSpeechTranscription({
      audioBlob: new Blob(["steady pacing"], { type: "audio/webm" }),
      fetchImplementation: async () =>
        new Response(JSON.stringify({ detail: "OpenAI transcription failed." }), {
          headers: {
            "Content-Type": "application/json",
          },
          status: 502,
        }),
      recordingMimeType: "audio/webm",
      token: "clerk-token",
    }),
    {
      message: "OpenAI transcription failed.",
    },
  );
});
