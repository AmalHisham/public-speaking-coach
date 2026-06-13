"use client";

type BrowserMediaDevices = Pick<MediaDevices, "getUserMedia">;

export const MICROPHONE_PERMISSION_STATUSES = [
  "idle",
  "granted",
  "denied",
] as const;

export type MicrophonePermissionStatus =
  (typeof MICROPHONE_PERMISSION_STATUSES)[number];

export type MicrophoneState = {
  permission: MicrophonePermissionStatus;
  stream: MediaStream | null;
};

export const initialMicrophoneState: MicrophoneState = {
  permission: "idle",
  stream: null,
};

export type MicrophonePermissionResult =
  | {
      permission: "granted";
      status: "granted";
      stream: MediaStream;
    }
  | {
      permission: MicrophonePermissionStatus;
      error: string;
      status: "failed";
    };

function getBrowserMediaDevices(): BrowserMediaDevices | null {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return null;
  }

  return navigator.mediaDevices;
}

function getErrorName(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    return error.name;
  }

  return null;
}

function mapMicrophonePermissionError(error: unknown): Omit<
  Extract<MicrophonePermissionResult, { status: "failed" }>,
  "status"
> {
  const errorName = getErrorName(error);

  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        permission: "denied",
        error: "Microphone permission denied.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        permission: "idle",
        error: "No microphone was found on this device.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        permission: "idle",
        error: "Microphone is currently unavailable.",
      };
    default:
      return {
        permission: "idle",
        error: "Unable to access the microphone.",
      };
  }
}

export async function requestMicrophonePermission(
  mediaDevices: BrowserMediaDevices | null = getBrowserMediaDevices(),
): Promise<MicrophonePermissionResult> {
  if (!mediaDevices?.getUserMedia) {
    return {
      permission: "idle",
      error: "Microphone access is unavailable in this browser.",
      status: "failed",
    };
  }

  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    return {
      permission: "granted",
      status: "granted",
      stream,
    };
  } catch (error: unknown) {
    return {
      ...mapMicrophonePermissionError(error),
      status: "failed",
    };
  }
}

export function stopMicrophoneStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
