"use client";

import { useSessionStore } from "@/stores/session-store";

function getRecordingDescription(
  recordingStatus: "failed" | "idle" | "recorded" | "recording",
  hasAudioBlob: boolean,
): string {
  if (recordingStatus === "failed") {
    return "Audio recording could not be initialized for this session.";
  }

  if (recordingStatus === "recording") {
    return "Browser audio recording is active while the session is running.";
  }

  if (recordingStatus === "recorded" && hasAudioBlob) {
    return "Recorded audio is stored locally in session state for later phases.";
  }

  return "Audio recording will start after camera and microphone access succeed.";
}

export function LiveTranscript() {
  const audioBlob = useSessionStore((state) => state.speech.audioBlob);
  const recordingError = useSessionStore((state) => state.speech.recordingError);
  const recordingMimeType = useSessionStore(
    (state) => state.speech.recordingMimeType,
  );
  const recordingStatus = useSessionStore(
    (state) => state.speech.recordingStatus,
  );
  const hasAudioBlob = audioBlob !== null;

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm shadow-stone-200/60">
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Speech Recording
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
            Browser audio capture
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-stone-700">
            {getRecordingDescription(recordingStatus, hasAudioBlob)}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
            Recording State
          </p>
          <div className="mt-4 min-h-32 rounded-[1.25rem] border border-dashed border-stone-300 bg-white px-4 py-4 text-sm leading-7 text-stone-700">
            <p>Status: {recordingStatus}</p>
            <p>Audio retained: {hasAudioBlob ? "yes" : "no"}</p>
            <p>MIME type: {recordingMimeType ?? "unavailable"}</p>
            <p>Blob size: {audioBlob?.size ?? 0} bytes</p>
            {recordingError ? (
              <p className="text-rose-600">Error: {recordingError}</p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
