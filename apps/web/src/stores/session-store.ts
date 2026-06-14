"use client";

import { create } from "zustand";

import {
  initialSessionState,
  transitionSessionState,
} from "@/features/session/lib/session-state-machine";
import {
  initialSessionTimerState,
  startSessionTimer,
  stopSessionTimer,
  type SessionTimerState,
} from "@/features/session/lib/session-timer";
import {
  initialMicrophoneState,
  type MicrophoneState,
  requestMicrophonePermission,
  stopMicrophoneStream,
} from "@/features/session/lib/microphone-permission";
import {
  initialCameraState,
  type CameraState,
  requestWebcamPermission,
  stopWebcamStream,
} from "@/features/session/lib/webcam-permission";
import {
  initialTranscriptState,
  type TranscriptState,
} from "@/features/speech/lib/speech-recognition";
import {
  initialSpeechRecordingState,
  startMediaRecording,
  type MediaRecordingController,
  type SpeechRecordingState,
} from "@/features/speech/lib/media-recorder";
import type { SessionEvent, SessionMachineState } from "@/types/session";

type SpeechState = TranscriptState & SpeechRecordingState;

const initialSpeechState: SpeechState = {
  ...initialTranscriptState,
  ...initialSpeechRecordingState,
};

type SessionStoreState = SessionMachineState & {
  camera: CameraState;
  microphone: MicrophoneState;
  speech: SpeechState;
  timer: SessionTimerState;
};

type SessionStore = SessionStoreState & {
  failActive: (error: string) => void;
  requestStart: () => Promise<void>;
  requestStop: () => Promise<void>;
  reset: () => void;
};

function applyLifecycleEvent(
  state: SessionStoreState,
  event: SessionEvent,
  camera: CameraState = state.camera,
  microphone: MicrophoneState = state.microphone,
  speech: SpeechState = state.speech,
  timer: SessionTimerState = state.timer,
): SessionStoreState {
  return {
    ...transitionSessionState(state, event),
    camera,
    microphone,
    speech,
    timer,
  };
}

export const useSessionStore = create<SessionStore>((set) => {
  let mediaRecordingController: MediaRecordingController | null = null;
  let activeMediaRecordingToken = 0;

  const createMediaRecordingToken = () => {
    activeMediaRecordingToken += 1;

    return activeMediaRecordingToken;
  };

  const invalidateMediaRecordingToken = () => {
    activeMediaRecordingToken += 1;
  };

  const stopMediaRecording = async (
    options: {
      invalidate?: boolean;
    } = {},
  ) => {
    const { invalidate = false } = options;

    if (mediaRecordingController === null) {
      if (invalidate) {
        invalidateMediaRecordingToken();
      }

      return;
    }

    const controller = mediaRecordingController;
    mediaRecordingController = null;

    if (invalidate) {
      invalidateMediaRecordingToken();
    }

    await controller.stop();

    if (!invalidate) {
      invalidateMediaRecordingToken();
    }
  };

  const updateState = (updater: (state: SessionStoreState) => SessionStoreState) =>
    set((state) => {
      const nextState = updater(state);

      if (
        state.camera.stream !== null &&
        state.camera.stream !== nextState.camera.stream
      ) {
        stopWebcamStream(state.camera.stream);
      }

      if (
        state.microphone.stream !== null &&
        state.microphone.stream !== nextState.microphone.stream
      ) {
        stopMicrophoneStream(state.microphone.stream);
      }

      return nextState;
    });

  const completeStart = (microphone: MicrophoneState) => {
    updateState((state) =>
      applyLifecycleEvent(
        state,
        { type: "START_SUCCESS" },
        state.camera,
        microphone,
        initialSpeechState,
        startSessionTimer(),
      ),
    );
  };

  const completeStop = () => {
    updateState((state) =>
      applyLifecycleEvent(
        state,
        { type: "STOP_SUCCESS" },
        {
          ...state.camera,
          stream: null,
        },
        {
          ...state.microphone,
          stream: null,
        },
        state.speech,
        state.timer,
      ),
    );
  };

  const failStart = (
    error: string,
    camera?: CameraState,
    microphone: MicrophoneState = initialMicrophoneState,
  ) => {
    updateState((state) =>
      applyLifecycleEvent(
        state,
        { error, type: "START_FAILURE" },
        camera ?? {
          ...state.camera,
          stream: null,
        },
        microphone,
        initialSpeechState,
        initialSessionTimerState,
      ),
    );
  };

  const failActiveSession = (error: string) => {
    void stopMediaRecording({
      invalidate: true,
    });

    updateState((state) =>
      applyLifecycleEvent(
        state,
        { error, type: "RUNTIME_FAILURE" },
        {
          ...state.camera,
          stream: null,
        },
        {
          ...state.microphone,
          stream: null,
        },
        {
          ...state.speech,
          recordingError:
            state.speech.recordingStatus === "recording"
              ? "Audio recording stopped before completion."
              : state.speech.recordingError,
          recordingStatus:
            state.speech.recordingStatus === "recording"
              ? "failed"
              : state.speech.recordingStatus,
        },
        stopSessionTimer(state.timer),
      ),
    );
  };

  const startActiveMediaRecording = (stream: MediaStream) => {
    const mediaRecordingToken = createMediaRecordingToken();
    const isCurrentMediaRecording = () =>
      activeMediaRecordingToken === mediaRecordingToken;

    const mediaRecordingResult = startMediaRecording({
      onError: (error) => {
        if (!isCurrentMediaRecording()) {
          return;
        }

        updateState((state) => ({
          ...state,
          speech: {
            ...state.speech,
            recordingError: error,
            recordingStatus: "failed",
          },
        }));
      },
      onRecordingComplete: ({ audioBlob, mimeType }) => {
        if (!isCurrentMediaRecording()) {
          return;
        }

        updateState((state) => ({
          ...state,
          speech: {
            ...state.speech,
            audioBlob,
            recordingError: null,
            recordingMimeType: mimeType,
            recordingStatus: "recorded",
          },
        }));
      },
      onRecordingStart: ({ mimeType }) => {
        if (!isCurrentMediaRecording()) {
          return;
        }

        updateState((state) => ({
          ...state,
          speech: {
            ...state.speech,
            audioBlob: null,
            recordingError: null,
            recordingMimeType: mimeType,
            recordingStatus: "recording",
          },
        }));
      },
      stream,
    });

    if (mediaRecordingResult.status === "failed") {
      updateState((state) => ({
        ...state,
        speech: {
          ...state.speech,
          audioBlob: null,
          recordingError: mediaRecordingResult.error,
          recordingMimeType: null,
          recordingStatus: "failed",
        },
      }));

      return;
    }

    mediaRecordingController = mediaRecordingResult.controller;
  };

  return {
    ...initialSessionState,
    camera: initialCameraState,
    microphone: initialMicrophoneState,
    speech: initialSpeechState,
    timer: initialSessionTimerState,
    failActive: failActiveSession,
    requestStart: async () => {
      await stopMediaRecording({
        invalidate: true,
      });

      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "START_REQUEST" },
          initialCameraState,
          initialMicrophoneState,
          initialSpeechState,
          initialSessionTimerState,
        ),
      );

      const cameraResult = await requestWebcamPermission();

      if (cameraResult.status === "granted") {
        updateState((state) => ({
          ...state,
          camera: {
            permission: cameraResult.permission,
            stream: cameraResult.stream,
          },
        }));
      } else {
        failStart(
          cameraResult.error,
          {
            permission: cameraResult.permission,
            stream: null,
          },
          initialMicrophoneState,
        );

        return;
      }

      const microphoneResult = await requestMicrophonePermission();

      if (microphoneResult.status === "granted") {
        completeStart({
          permission: microphoneResult.permission,
          stream: microphoneResult.stream,
        });
        startActiveMediaRecording(microphoneResult.stream);

        return;
      }

      failStart(
        microphoneResult.error,
        undefined,
        {
          permission: microphoneResult.permission,
          stream: null,
        },
      );
    },
    requestStop: async () => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "STOP_REQUEST" },
          state.camera,
          state.microphone,
          state.speech,
          stopSessionTimer(state.timer),
        ),
      );

      await stopMediaRecording();

      completeStop();
    },
    reset: () => {
      void stopMediaRecording({
        invalidate: true,
      });

      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "RESET" },
          initialCameraState,
          initialMicrophoneState,
          initialSpeechState,
          initialSessionTimerState,
        ),
      );
    },
  };
});
