import assert from "node:assert/strict";
import test from "node:test";

import { getSessionControlsViewModel } from "@/features/session/lib/session-controls";

test("exposes valid controls for every session state", () => {
  const cases = [
    {
      expected: { canStart: true, canStop: false, statusLabel: "Idle" },
      processingStatus: "idle",
      status: "IDLE",
    },
    {
      expected: { canStart: false, canStop: false, statusLabel: "Starting" },
      processingStatus: "idle",
      status: "STARTING",
    },
    {
      expected: { canStart: false, canStop: true, statusLabel: "Active" },
      processingStatus: "idle",
      status: "ACTIVE",
    },
    {
      expected: { canStart: false, canStop: false, statusLabel: "Stopping" },
      processingStatus: "idle",
      status: "STOPPING",
    },
    {
      expected: { canStart: true, canStop: false, statusLabel: "Completed" },
      processingStatus: "idle",
      status: "COMPLETED",
    },
    {
      expected: { canStart: true, canStop: false, statusLabel: "Failed" },
      processingStatus: "idle",
      status: "FAILED",
    },
  ] as const;

  for (const testCase of cases) {
    const viewModel = getSessionControlsViewModel({
      processingStatus: testCase.processingStatus,
      status: testCase.status,
    });

    assert.equal(viewModel.canStart, testCase.expected.canStart);
    assert.equal(viewModel.canStop, testCase.expected.canStop);
    assert.equal(viewModel.statusLabel, testCase.expected.statusLabel);
  }
});

test("blocks restart while the previous session transcription is still in flight", () => {
  const viewModel = getSessionControlsViewModel({
    processingStatus: "transcribing",
    status: "COMPLETED",
  });

  assert.equal(viewModel.canStart, false);
  assert.equal(viewModel.canStop, false);
  assert.equal(viewModel.startLabel, "Finishing transcription...");
  assert.equal(
    viewModel.description,
    "Session ended cleanly. Finishing the previous transcription before another practice run can begin.",
  );
});

test("allows restart again after completed-session transcription finishes", () => {
  const viewModel = getSessionControlsViewModel({
    processingStatus: "transcript_ready",
    status: "COMPLETED",
  });

  assert.equal(viewModel.canStart, true);
  assert.equal(viewModel.startLabel, "Start Session");
  assert.equal(
    viewModel.description,
    "Session ended cleanly. You can start another practice run.",
  );
});
