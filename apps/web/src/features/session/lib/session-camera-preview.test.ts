import assert from "node:assert/strict";
import test from "node:test";

import {
  getSessionCameraPreviewViewModel,
  hasRenderableVideoTrack,
  syncSessionCameraPreviewStream,
} from "@/features/session/lib/session-camera-preview";

function createMockVideoTrack(
  readyState: MediaStreamTrackState = "live",
): MediaStreamTrack {
  const listeners = new Map<string, Set<EventListener>>();

  return {
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener !== "function") {
        return;
      }

      const existingListeners = listeners.get(type) ?? new Set<EventListener>();
      existingListeners.add(listener);
      listeners.set(type, existingListeners);
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (typeof listener !== "function") {
        return;
      }

      listeners.get(type)?.delete(listener);
    },
    readyState,
  } as unknown as MediaStreamTrack;
}

function createMockMediaStream(
  tracks: MediaStreamTrack[],
): MediaStream {
  return {
    getVideoTracks: () => tracks,
  } as unknown as MediaStream;
}

test("renders the preview only while the session is active", () => {
  const inactiveViewModel = getSessionCameraPreviewViewModel({
    cameraPermission: "idle",
    hasCameraStream: false,
    hasRenderableVideoTrack: false,
    playbackFailed: false,
    status: "IDLE",
  });
  const activeViewModel = getSessionCameraPreviewViewModel({
    cameraPermission: "granted",
    hasCameraStream: true,
    hasRenderableVideoTrack: true,
    playbackFailed: false,
    status: "ACTIVE",
  });

  assert.equal(inactiveViewModel.shouldRender, false);
  assert.equal(activeViewModel.shouldRender, true);
  assert.equal(activeViewModel.showVideo, true);
  assert.equal(activeViewModel.showFallback, false);
});

test("shows a graceful fallback when the active session has no camera stream", () => {
  const viewModel = getSessionCameraPreviewViewModel({
    cameraPermission: "idle",
    hasCameraStream: false,
    hasRenderableVideoTrack: false,
    playbackFailed: false,
    status: "ACTIVE",
  });

  assert.equal(viewModel.shouldRender, true);
  assert.equal(viewModel.showVideo, false);
  assert.equal(viewModel.showFallback, true);
  assert.equal(
    viewModel.description,
    "Camera preview is temporarily unavailable for this active session.",
  );
});

test("shows a graceful fallback when the active session stream has only ended tracks", () => {
  const stream = createMockMediaStream([createMockVideoTrack("ended")]);
  const viewModel = getSessionCameraPreviewViewModel({
    cameraPermission: "granted",
    hasCameraStream: true,
    hasRenderableVideoTrack: hasRenderableVideoTrack(stream),
    playbackFailed: false,
    status: "ACTIVE",
  });

  assert.equal(viewModel.shouldRender, true);
  assert.equal(viewModel.showVideo, false);
  assert.equal(viewModel.showFallback, true);
  assert.equal(
    viewModel.description,
    "Camera preview is unavailable because the camera track ended.",
  );
});

test("attaches the existing session stream and clears it during cleanup", () => {
  const stream = createMockMediaStream([createMockVideoTrack("live")]);
  const videoElement = {
    addEventListener: () => {},
    play: () => Promise.resolve(),
    removeEventListener: () => {},
    srcObject: null as MediaStream | null,
  };

  const cleanup = syncSessionCameraPreviewStream(videoElement, stream, () => {});

  assert.equal(videoElement.srcObject, stream);

  cleanup();

  assert.equal(videoElement.srcObject, null);
});

test("does not clear a newer stream during stale cleanup", () => {
  const firstStream = createMockMediaStream([createMockVideoTrack("live")]);
  const secondStream = createMockMediaStream([createMockVideoTrack("live")]);
  const videoElement = {
    addEventListener: () => {},
    play: () => Promise.resolve(),
    removeEventListener: () => {},
    srcObject: null as MediaStream | null,
  };

  const cleanup = syncSessionCameraPreviewStream(
    videoElement,
    firstStream,
    () => {},
  );
  videoElement.srcObject = secondStream;

  cleanup();

  assert.equal(videoElement.srcObject, secondStream);
});
