"use client";

import { create } from "zustand";

import {
  initialSessionState,
  transitionSessionState,
} from "@/features/session/lib/session-state-machine";
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
import type { SessionEvent, SessionMachineState } from "@/types/session";

type SessionStoreState = SessionMachineState & {
  camera: CameraState;
  microphone: MicrophoneState;
};

type SessionStore = SessionStoreState & {
  completeStop: () => void;
  failActive: (error: string) => void;
  failStart: (error: string) => void;
  markActive: () => void;
  requestStart: () => Promise<void>;
  requestStop: () => void;
  reset: () => void;
};

function applyLifecycleEvent(
  state: SessionStoreState,
  event: SessionEvent,
  camera: CameraState = state.camera,
  microphone: MicrophoneState = state.microphone,
): SessionStoreState {
  return {
    ...transitionSessionState(state, event),
    camera,
    microphone,
  };
}

export const useSessionStore = create<SessionStore>((set) => {
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

  return {
    ...initialSessionState,
    camera: initialCameraState,
    microphone: initialMicrophoneState,
    completeStop: () => {
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
        ),
      );
    },
    failActive: (error) => {
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
        ),
      );
    },
    failStart: (error) => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { error, type: "START_FAILURE" },
          {
            ...state.camera,
            stream: null,
          },
          {
            ...state.microphone,
            stream: null,
          },
        ),
      );
    },
    markActive: () => {
      updateState((state) => applyLifecycleEvent(state, { type: "START_SUCCESS" }));
    },
    requestStart: async () => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "START_REQUEST" },
          initialCameraState,
          initialMicrophoneState,
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
        updateState((state) =>
          applyLifecycleEvent(
            state,
            { error: cameraResult.error, type: "START_FAILURE" },
            {
              permission: cameraResult.permission,
              stream: null,
            },
            initialMicrophoneState,
          ),
        );

        return;
      }

      const microphoneResult = await requestMicrophonePermission();

      if (microphoneResult.status === "granted") {
        updateState((state) => ({
          ...state,
          microphone: {
            permission: microphoneResult.permission,
            stream: microphoneResult.stream,
          },
        }));

        return;
      }

      updateState((state) =>
        applyLifecycleEvent(
          state,
          { error: microphoneResult.error, type: "START_FAILURE" },
          {
            ...state.camera,
            stream: null,
          },
          {
            permission: microphoneResult.permission,
            stream: null,
          },
        ),
      );
    },
    requestStop: () => {
      updateState((state) => applyLifecycleEvent(state, { type: "STOP_REQUEST" }));
    },
    reset: () => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "RESET" },
          initialCameraState,
          initialMicrophoneState,
        ),
      );
    },
  };
});
