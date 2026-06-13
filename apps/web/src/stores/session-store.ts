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
import type { SessionEvent, SessionMachineState } from "@/types/session";

type SessionStoreState = SessionMachineState & {
  camera: CameraState;
  microphone: MicrophoneState;
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
  timer: SessionTimerState = state.timer,
): SessionStoreState {
  return {
    ...transitionSessionState(state, event),
    camera,
    microphone,
    timer,
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

  const completeStart = (microphone: MicrophoneState) => {
    updateState((state) =>
      applyLifecycleEvent(
        state,
        { type: "START_SUCCESS" },
        state.camera,
        microphone,
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
        initialSessionTimerState,
      ),
    );
  };

  return {
    ...initialSessionState,
    camera: initialCameraState,
    microphone: initialMicrophoneState,
    timer: initialSessionTimerState,
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
          stopSessionTimer(state.timer),
        ),
      );
    },
    requestStart: async () => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "START_REQUEST" },
          initialCameraState,
          initialMicrophoneState,
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
          stopSessionTimer(state.timer),
        ),
      );

      await Promise.resolve();

      completeStop();
    },
    reset: () => {
      updateState((state) =>
        applyLifecycleEvent(
          state,
          { type: "RESET" },
          initialCameraState,
          initialMicrophoneState,
          initialSessionTimerState,
        ),
      );
    },
  };
});
