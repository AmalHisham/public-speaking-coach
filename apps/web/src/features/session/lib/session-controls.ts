import type { SessionStatus } from "@/types/session";

export type SessionControlsSnapshot = {
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

function getStatusDescription(status: SessionStatus): string {
  switch (status) {
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
  return {
    canStart:
      snapshot.status === "IDLE" ||
      snapshot.status === "COMPLETED" ||
      snapshot.status === "FAILED",
    canStop: snapshot.status === "ACTIVE",
    description: getStatusDescription(snapshot.status),
    startLabel:
      snapshot.status === "STARTING" ? "Starting session..." : "Start Session",
    statusLabel: toStatusLabel(snapshot.status),
    stopLabel:
      snapshot.status === "STOPPING" ? "Stopping session..." : "Stop Session",
  };
}
