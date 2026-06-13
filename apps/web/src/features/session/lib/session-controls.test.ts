import assert from "node:assert/strict";
import test from "node:test";

import { getSessionControlsViewModel } from "@/features/session/lib/session-controls";

test("exposes valid controls for every session state", () => {
  const cases = [
    {
      expected: { canStart: true, canStop: false, statusLabel: "Idle" },
      status: "IDLE",
    },
    {
      expected: { canStart: false, canStop: false, statusLabel: "Starting" },
      status: "STARTING",
    },
    {
      expected: { canStart: false, canStop: true, statusLabel: "Active" },
      status: "ACTIVE",
    },
    {
      expected: { canStart: false, canStop: false, statusLabel: "Stopping" },
      status: "STOPPING",
    },
    {
      expected: { canStart: true, canStop: false, statusLabel: "Completed" },
      status: "COMPLETED",
    },
    {
      expected: { canStart: true, canStop: false, statusLabel: "Failed" },
      status: "FAILED",
    },
  ] as const;

  for (const testCase of cases) {
    const viewModel = getSessionControlsViewModel({
      status: testCase.status,
    });

    assert.equal(viewModel.canStart, testCase.expected.canStart);
    assert.equal(viewModel.canStop, testCase.expected.canStop);
    assert.equal(viewModel.statusLabel, testCase.expected.statusLabel);
  }
});
