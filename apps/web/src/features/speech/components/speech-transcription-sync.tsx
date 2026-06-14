"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";

import { requestSpeechTranscription } from "@/features/speech/lib/transcription-client";
import { useSessionStore } from "@/stores/session-store";

export function SpeechTranscriptionSync() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const setSpeechTranscriptionRequester = useSessionStore(
    (state) => state.setSpeechTranscriptionRequester,
  );

  useEffect(() => {
    const requestTranscription = async ({
      audioBlob,
      onProcessingStatusChange,
      recordingMimeType,
      signal,
    }: {
      audioBlob: Blob;
      onProcessingStatusChange: (status: "transcribing" | "uploading") => void;
      recordingMimeType: string | null;
      signal: AbortSignal;
    }) => {
      if (!isLoaded || !isSignedIn) {
        throw new Error("You must be signed in to transcribe recorded audio.");
      }

      const token = await getToken();

      if (!token) {
        throw new Error("Clerk did not return a session token.");
      }

      return requestSpeechTranscription({
        audioBlob,
        onStatusChange: onProcessingStatusChange,
        recordingMimeType,
        signal,
        token,
      });
    };

    setSpeechTranscriptionRequester(requestTranscription);

    return () => {
      setSpeechTranscriptionRequester(null);
    };
  }, [getToken, isLoaded, isSignedIn, setSpeechTranscriptionRequester]);

  return null;
}
