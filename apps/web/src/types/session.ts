export const SESSION_STATUSES = [
  "IDLE",
  "STARTING",
  "ACTIVE",
  "STOPPING",
  "COMPLETED",
  "FAILED",
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export type SessionMachineState = {
  error: string | null;
  status: SessionStatus;
};

export type SessionEvent =
  | { type: "START_REQUEST" }
  | { type: "START_SUCCESS" }
  | { error: string; type: "START_FAILURE" }
  | { type: "STOP_REQUEST" }
  | { type: "STOP_SUCCESS" }
  | { error: string; type: "RUNTIME_FAILURE" }
  | { type: "RESET" };

export type SessionEventType = SessionEvent["type"];
