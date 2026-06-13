"use client";

type BrowserMediaDevices = Pick<MediaDevices, "getUserMedia">;

export const CAMERA_PERMISSION_STATUSES = [
  "idle",
  "granted",
  "denied",
] as const;

export type CameraPermissionStatus =
  (typeof CAMERA_PERMISSION_STATUSES)[number];

export type CameraState = {
  permission: CameraPermissionStatus;
  stream: MediaStream | null;
};

export const initialCameraState: CameraState = {
  permission: "idle",
  stream: null,
};

export type WebcamPermissionResult =
  | {
      permission: "granted";
      status: "granted";
      stream: MediaStream;
    }
  | {
      permission: CameraPermissionStatus;
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

function mapWebcamPermissionError(error: unknown): Omit<
  Extract<WebcamPermissionResult, { status: "failed" }>,
  "status"
> {
  const errorName = getErrorName(error);

  switch (errorName) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        permission: "denied",
        error: "Camera permission denied.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        permission: "idle",
        error: "No camera was found on this device.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        permission: "idle",
        error: "Camera is currently unavailable.",
      };
    default:
      return {
        permission: "idle",
        error: "Unable to access the camera.",
      };
  }
}

export async function requestWebcamPermission(
  mediaDevices: BrowserMediaDevices | null = getBrowserMediaDevices(),
): Promise<WebcamPermissionResult> {
  if (!mediaDevices?.getUserMedia) {
    return {
      permission: "idle",
      error: "Camera access is unavailable in this browser.",
      status: "failed",
    };
  }

  try {
    const stream = await mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });

    return {
      permission: "granted",
      status: "granted",
      stream,
    };
  } catch (error: unknown) {
    return {
      ...mapWebcamPermissionError(error),
      status: "failed",
    };
  }
}

export function stopWebcamStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
