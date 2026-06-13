import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSessionElapsedDuration,
  getSessionElapsedMs,
  initialSessionTimerState,
  startSessionTimer,
  stopSessionTimer,
} from "@/features/session/lib/session-timer";

test("starts timing from the active-session timestamp", () => {
  assert.deepStrictEqual(startSessionTimer(5_000), {
    elapsedMs: 0,
    startedAt: 5_000,
  });
});

test("returns the live elapsed duration while the session is active", () => {
  assert.equal(
    getSessionElapsedMs(
      {
        elapsedMs: 0,
        startedAt: 2_000,
      },
      8_250,
    ),
    6_250,
  );
});

test("stops timing when the session leaves active", () => {
  assert.deepStrictEqual(
    stopSessionTimer(
      {
        elapsedMs: 0,
        startedAt: 3_500,
      },
      9_000,
    ),
    {
      elapsedMs: 5_500,
      startedAt: null,
    },
  );
});

test("keeps the stored elapsed duration once the timer is stopped", () => {
  const stoppedTimer = {
    elapsedMs: 12_000,
    startedAt: null,
  };

  assert.equal(getSessionElapsedMs(stoppedTimer, 99_000), 12_000);
  assert.deepStrictEqual(stopSessionTimer(stoppedTimer, 99_000), stoppedTimer);
});

test("formats durations for display", () => {
  assert.equal(formatSessionElapsedDuration(initialSessionTimerState.elapsedMs), "00:00");
  assert.equal(formatSessionElapsedDuration(65_900), "01:05");
  assert.equal(formatSessionElapsedDuration(3_726_000), "1:02:06");
});
