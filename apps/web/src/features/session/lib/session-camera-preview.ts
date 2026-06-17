import type { CameraPermissionStatus } from "@/features/session/lib/webcam-permission";
import type { SessionStatus } from "@/types/session";

export type SessionCameraPreviewSnapshot = {
  cameraPermission: CameraPermissionStatus;
  hasCameraStream: boolean;
  hasRenderableVideoTrack: boolean;
  playbackFailed: boolean;
  status: SessionStatus;
};

export type SessionCameraPreviewViewModel = {
  description: string;
  shouldRender: boolean;
  showFallback: boolean;
  showVideo: boolean;
  title: string;
};

type SessionCameraPreviewVideoElement = Pick<
  HTMLVideoElement,
  "addEventListener" | "play" | "removeEventListener" | "srcObject"
>;

export function getSessionCameraPreviewViewModel(
  snapshot: SessionCameraPreviewSnapshot,
): SessionCameraPreviewViewModel {
  if (snapshot.status !== "ACTIVE") {
    return {
      description: "Preview is available only while a practice session is active.",
      shouldRender: false,
      showFallback: false,
      showVideo: false,
      title: "Live Camera Preview",
    };
  }

  if (
    snapshot.hasCameraStream &&
    snapshot.hasRenderableVideoTrack &&
    !snapshot.playbackFailed
  ) {
    return {
      description:
        "This preview reuses the live camera feed that the active session and MediaPipe analysis already use.",
      shouldRender: true,
      showFallback: false,
      showVideo: true,
      title: "Live Camera Preview",
    };
  }

  return {
    description:
      snapshot.cameraPermission === "denied"
        ? "Camera access is unavailable for this active session."
        : snapshot.playbackFailed
          ? "Camera preview could not start for this active session."
          : snapshot.hasCameraStream
            ? "Camera preview is unavailable because the camera track ended."
        : "Camera preview is temporarily unavailable for this active session.",
    shouldRender: true,
    showFallback: true,
    showVideo: false,
    title: "Live Camera Preview",
  };
}

export function hasRenderableVideoTrack(stream: MediaStream | null): boolean {
  if (stream === null) {
    return false;
  }

  return stream.getVideoTracks().some((track) => track.readyState === "live");
}

export function syncSessionCameraPreviewStream(
  videoElement: SessionCameraPreviewVideoElement,
  stream: MediaStream | null,
  onPlaybackFailure: () => void,
) {
  let isActive = true;
  const videoTracks = stream?.getVideoTracks() ?? [];

  videoElement.srcObject = stream;

  const handlePlaybackFailure = () => {
    if (!isActive) {
      return;
    }

    onPlaybackFailure();
  };

  for (const track of videoTracks) {
    track.addEventListener("ended", handlePlaybackFailure, {
      once: true,
    });
  }

  videoElement.addEventListener("error", handlePlaybackFailure);

  try {
    const playResult = videoElement.play();

    if (playResult !== undefined) {
      void playResult.catch(() => {
        handlePlaybackFailure();
      });
    }
  } catch {
    handlePlaybackFailure();
  }

  return () => {
    isActive = false;

    videoElement.removeEventListener("error", handlePlaybackFailure);

    for (const track of videoTracks) {
      track.removeEventListener("ended", handlePlaybackFailure);
    }

    if (videoElement.srcObject === stream) {
      videoElement.srcObject = null;
    }
  };
}
