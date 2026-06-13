"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getSessionControlsViewModel } from "@/features/session/lib/session-controls";
import { useSessionStore } from "@/stores/session-store";
import type { SessionStatus } from "@/types/session";

function getStatusClasses(status: SessionStatus): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "STARTING":
    case "STOPPING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "COMPLETED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "IDLE":
      return "border-stone-200 bg-stone-100 text-stone-700";
  }
}

export function SessionControls() {
  const error = useSessionStore((state) => state.error);
  const requestStart = useSessionStore((state) => state.requestStart);
  const requestStop = useSessionStore((state) => state.requestStop);
  const status = useSessionStore((state) => state.status);
  const [actionError, setActionError] = useState<string | null>(null);

  const viewModel = getSessionControlsViewModel({
    status,
  });
  const statusError = actionError ?? error;

  const handleStart = async () => {
    setActionError(null);

    try {
      await requestStart();
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to start the session.",
      );
    }
  };

  const handleStop = async () => {
    setActionError(null);

    try {
      await requestStop();
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to stop the session.",
      );
    }
  };

  return (
    <article className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm shadow-stone-200/60">
      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Session Controls
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
            Practice session lifecycle
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-stone-700">
            Start and stop a browser-first practice session using the existing
            session lifecycle store.
          </p>
        </div>

        <div
          aria-live="polite"
          className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
                Current Status
              </p>
              <p className="text-lg font-semibold text-stone-950">
                {viewModel.statusLabel}
              </p>
            </div>
            <span
              className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusClasses(
                status,
              )}`}
            >
              {status}
            </span>
          </div>

          <p className="mt-4 text-sm leading-7 text-stone-700">
            {viewModel.description}
          </p>

          {statusError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700"
            >
              {statusError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="h-10 px-4"
            disabled={!viewModel.canStart}
            onClick={() => {
              void handleStart();
            }}
            size="lg"
          >
            {viewModel.startLabel}
          </Button>
          <Button
            className="h-10 px-4"
            disabled={!viewModel.canStop}
            onClick={() => {
              void handleStop();
            }}
            size="lg"
            variant="outline"
          >
            {viewModel.stopLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}
