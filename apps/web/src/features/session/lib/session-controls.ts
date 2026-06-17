import type { SpeechProcessingStatus } from "@/features/speech/lib/transcription-client";
import type { SessionStatus } from "@/types/session";

export type SessionControlsSnapshot = {
  processingStatus: SpeechProcessingStatus;
  status: SessionStatus;
};

export type SessionControlsViewModel = {
  canStart: boolean;
  canStop: boolean;
  description: string;
  startLabel: string;
  statusLabel: string;
  stopLabel: string;
};

function toStatusLabel(status: SessionStatus): string {
  return `${status.slice(0, 1)}${status.slice(1).toLowerCase()}`;
}

function isFinishingPreviousTranscription(
  snapshot: SessionControlsSnapshot,
): boolean {
  return (
    snapshot.status === "COMPLETED" &&
    (snapshot.processingStatus === "uploading" ||
      snapshot.processingStatus === "transcribing")
  );
}

function getStatusDescription(snapshot: SessionControlsSnapshot): string {
  if (isFinishingPreviousTranscription(snapshot)) {
    return "Session ended cleanly. Finishing the previous transcription before another practice run can begin.";
  }

  switch (snapshot.status) {
    case "IDLE":
      return "Ready to request camera and microphone access.";
    case "STARTING":
      return "Requesting permissions and preparing the session.";
    case "ACTIVE":
      return "Session is active. Stop it when your practice run is complete.";
    case "STOPPING":
      return "Stopping the session and releasing media access.";
    case "COMPLETED":
      return "Session ended cleanly. You can start another practice run.";
    case "FAILED":
      return "The session could not continue. Review the error and try again.";
  }
}

export function getSessionControlsViewModel(
  snapshot: SessionControlsSnapshot,
): SessionControlsViewModel {
  const isRestartBlocked = isFinishingPreviousTranscription(snapshot);

  return {
    canStart:
      snapshot.status === "IDLE" ||
      (snapshot.status === "COMPLETED" && !isRestartBlocked) ||
      snapshot.status === "FAILED",
    canStop: snapshot.status === "ACTIVE",
    description: getStatusDescription(snapshot),
    startLabel:
      snapshot.status === "STARTING"
        ? "Starting session..."
        : isRestartBlocked
          ? "Finishing transcription..."
          : "Start Session",
    statusLabel: toStatusLabel(snapshot.status),
    stopLabel:
      snapshot.status === "STOPPING" ? "Stopping session..." : "Stop Session",
  };
}
