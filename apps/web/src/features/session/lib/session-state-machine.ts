import type {
  SessionEvent,
  SessionEventType,
  SessionMachineState,
  SessionStatus,
} from "@/types/session";

const RESTARTABLE_STATUSES: readonly SessionStatus[] = [
  "IDLE",
  "COMPLETED",
  "FAILED",
];

const RESETTABLE_STATUSES: readonly SessionStatus[] = ["COMPLETED", "FAILED"];

export const initialSessionState: SessionMachineState = {
  error: null,
  status: "IDLE",
};

export class SessionTransitionError extends Error {
  readonly eventType: SessionEventType;
  readonly status: SessionStatus;

  constructor(status: SessionStatus, eventType: SessionEventType) {
    super(
      `Cannot apply session event "${eventType}" while session is "${status}".`,
    );
    this.name = "SessionTransitionError";
    this.eventType = eventType;
    this.status = status;
  }
}

function assertStatus(
  state: SessionMachineState,
  eventType: SessionEventType,
  allowedStatuses: readonly SessionStatus[],
) {
  if (!allowedStatuses.includes(state.status)) {
    throw new SessionTransitionError(state.status, eventType);
  }
}

export function transitionSessionState(
  state: SessionMachineState,
  event: SessionEvent,
): SessionMachineState {
  switch (event.type) {
    case "START_REQUEST":
      assertStatus(state, event.type, RESTARTABLE_STATUSES);
      return {
        error: null,
        status: "STARTING",
      };
    case "START_SUCCESS":
      assertStatus(state, event.type, ["STARTING"]);
      return {
        error: null,
        status: "ACTIVE",
      };
    case "START_FAILURE":
      assertStatus(state, event.type, ["STARTING"]);
      return {
        error: event.error,
        status: "FAILED",
      };
    case "STOP_REQUEST":
      assertStatus(state, event.type, ["ACTIVE"]);
      return {
        error: null,
        status: "STOPPING",
      };
    case "STOP_SUCCESS":
      assertStatus(state, event.type, ["STOPPING"]);
      return {
        error: null,
        status: "COMPLETED",
      };
    case "RUNTIME_FAILURE":
      assertStatus(state, event.type, ["ACTIVE"]);
      return {
        error: event.error,
        status: "FAILED",
      };
    case "RESET":
      assertStatus(state, event.type, RESETTABLE_STATUSES);
      return initialSessionState;
  }
}
