import assert from "node:assert/strict";
import test from "node:test";

import {
  SessionTransitionError,
  initialSessionState,
  transitionSessionState,
} from "@/features/session/lib/session-state-machine";
import type { SessionMachineState } from "@/types/session";

function applyEvents(
  state: SessionMachineState,
  events: Parameters<typeof transitionSessionState>[1][],
) {
  return events.reduce(transitionSessionState, state);
}

test("supports the happy-path lifecycle", () => {
  const result = applyEvents(initialSessionState, [
    { type: "START_REQUEST" },
    { type: "START_SUCCESS" },
    { type: "STOP_REQUEST" },
    { type: "STOP_SUCCESS" },
  ]);

  assert.deepStrictEqual(result, {
    error: null,
    status: "COMPLETED",
  });
});

test("supports a failed start and reset back to idle", () => {
  const failedState = applyEvents(initialSessionState, [
    { type: "START_REQUEST" },
    { error: "Camera permission denied.", type: "START_FAILURE" },
  ]);

  assert.deepStrictEqual(failedState, {
    error: "Camera permission denied.",
    status: "FAILED",
  });

  const resetState = transitionSessionState(failedState, { type: "RESET" });

  assert.deepStrictEqual(resetState, initialSessionState);
});

test("supports an active-session failure", () => {
  const result = applyEvents(initialSessionState, [
    { type: "START_REQUEST" },
    { type: "START_SUCCESS" },
    { error: "Speech recognition disconnected.", type: "RUNTIME_FAILURE" },
  ]);

  assert.deepStrictEqual(result, {
    error: "Speech recognition disconnected.",
    status: "FAILED",
  });
});

test("rejects stop-phase failures", () => {
  const stoppingState = applyEvents(initialSessionState, [
    { type: "START_REQUEST" },
    { type: "START_SUCCESS" },
    { type: "STOP_REQUEST" },
  ]);

  assert.throws(
    () =>
      transitionSessionState(stoppingState, {
        error: "Session persistence failed.",
        type: "RUNTIME_FAILURE",
      }),
    (error: unknown) => {
      assert.ok(error instanceof SessionTransitionError);
      assert.equal(error.status, "STOPPING");
      assert.equal(error.eventType, "RUNTIME_FAILURE");
      return true;
    },
  );
});

test("rejects invalid transitions", () => {
  assert.throws(
    () => transitionSessionState(initialSessionState, { type: "STOP_REQUEST" }),
    (error: unknown) => {
      assert.ok(error instanceof SessionTransitionError);
      assert.equal(error.status, "IDLE");
      assert.equal(error.eventType, "STOP_REQUEST");
      return true;
    },
  );
});
