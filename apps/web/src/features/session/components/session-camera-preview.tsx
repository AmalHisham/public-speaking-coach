"use client";

import { useEffect, useRef, useState } from "react";

import { useSessionStore } from "@/stores/session-store";

import {
  getSessionCameraPreviewViewModel,
  hasRenderableVideoTrack,
  syncSessionCameraPreviewStream,
} from "../lib/session-camera-preview";

export function SessionCameraPreview() {
  const camera = useSessionStore((state) => state.camera);
  const status = useSessionStore((state) => state.status);
  const [failedStream, setFailedStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const hasRenderableTrack = hasRenderableVideoTrack(camera.stream);
  const playbackFailed =
    camera.stream !== null && failedStream === camera.stream;

  const viewModel = getSessionCameraPreviewViewModel({
    cameraPermission: camera.permission,
    hasCameraStream: camera.stream !== null,
    hasRenderableVideoTrack: hasRenderableTrack,
    playbackFailed,
    status,
  });

  useEffect(() => {
    if (!viewModel.showVideo || videoRef.current === null) {
      return;
    }

    return syncSessionCameraPreviewStream(
      videoRef.current,
      camera.stream,
      () => {
        setFailedStream(camera.stream);
      },
    );
  }, [camera.stream, viewModel.showVideo]);

  if (!viewModel.shouldRender) {
    return null;
  }

  return (
    <article className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm shadow-stone-200/60">
      <div className="border-b border-stone-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
          Active Session
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          {viewModel.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-700">
          {viewModel.description}
        </p>
      </div>

      <div className="p-6">
        {viewModel.showVideo ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-stone-950">
            <video
              ref={videoRef}
              aria-label="Live webcam preview"
              autoPlay
              className="aspect-video w-full object-cover"
              muted
              playsInline
            />
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-100 px-6 text-center text-sm leading-7 text-stone-600">
            {viewModel.description}
          </div>
        )}
      </div>
    </article>
  );
}
