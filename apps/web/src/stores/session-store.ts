"use client";

import { create } from "zustand";

import {
  initialSessionState,
  transitionSessionState,
} from "@/features/session/lib/session-state-machine";
import {
  initialCameraState,
  type CameraState,
  requestWebcamPermission,
  stopWebcamStream,
} from "@/features/session/lib/webcam-permission";
import type { SessionEvent, SessionMachineState } from "@/types/session";

type SessionStoreState = SessionMachineState & {
  camera: CameraState;
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
): SessionStoreState {
  return {
    ...transitionSessionState(state, event),
    camera,
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

      return nextState;
    });

  return {
    ...initialSessionState,
    camera: initialCameraState,
    completeStop: () => {
      updateState((state) =>
        applyLifecycleEvent(state, { type: "STOP_SUCCESS" }, {
          ...state.camera,
          stream: null,
        }),
      );
    },
    failActive: (error) => {
      updateState((state) =>
        applyLifecycleEvent(state, { error, type: "RUNTIME_FAILURE" }, {
          ...state.camera,
          stream: null,
        }),
      );
    },
    failStart: (error) => {
      updateState((state) =>
        applyLifecycleEvent(state, { error, type: "START_FAILURE" }, {
          ...state.camera,
          stream: null,
        }),
      );
    },
    markActive: () => {
      updateState((state) => applyLifecycleEvent(state, { type: "START_SUCCESS" }));
    },
    requestStart: async () => {
      updateState((state) =>
        applyLifecycleEvent(state, { type: "START_REQUEST" }, initialCameraState),
      );

      const result = await requestWebcamPermission();

      if (result.status === "granted") {
        updateState((state) => ({
          ...state,
          camera: {
            permission: result.permission,
            stream: result.stream,
          },
        }));

        return;
      }

      updateState((state) =>
        applyLifecycleEvent(
          state,
          { error: result.error, type: "START_FAILURE" },
          {
            permission: result.permission,
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
        applyLifecycleEvent(state, { type: "RESET" }, initialCameraState),
      );
    },
  };
});
