"use client";

import { create } from "zustand";

import {
  initialSessionState,
  transitionSessionState,
} from "@/features/session/lib/session-state-machine";
import type { SessionEvent, SessionMachineState } from "@/types/session";

type SessionStore = SessionMachineState & {
  completeStop: () => void;
  failActive: (error: string) => void;
  failStart: (error: string) => void;
  markActive: () => void;
  requestStart: () => void;
  requestStop: () => void;
  reset: () => void;
  send: (event: SessionEvent) => void;
};

function applyEvent(
  state: SessionMachineState,
  event: SessionEvent,
): SessionMachineState {
  return transitionSessionState(state, event);
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialSessionState,
  completeStop: () => {
    set((state) => applyEvent(state, { type: "STOP_SUCCESS" }));
  },
  failActive: (error) => {
    set((state) => applyEvent(state, { error, type: "RUNTIME_FAILURE" }));
  },
  failStart: (error) => {
    set((state) => applyEvent(state, { error, type: "START_FAILURE" }));
  },
  markActive: () => {
    set((state) => applyEvent(state, { type: "START_SUCCESS" }));
  },
  requestStart: () => {
    set((state) => applyEvent(state, { type: "START_REQUEST" }));
  },
  requestStop: () => {
    set((state) => applyEvent(state, { type: "STOP_REQUEST" }));
  },
  reset: () => {
    set((state) => applyEvent(state, { type: "RESET" }));
  },
  send: (event) => {
    set((state) => applyEvent(state, event));
  },
}));
