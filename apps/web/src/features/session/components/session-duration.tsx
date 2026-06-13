"use client";

import { useEffect, useState } from "react";

import {
  formatSessionElapsedDuration,
  getSessionElapsedMs,
} from "@/features/session/lib/session-timer";
import { useSessionStore } from "@/stores/session-store";

export function SessionDuration() {
  const elapsedMs = useSessionStore((state) => state.timer.elapsedMs);
  const startedAt = useSessionStore((state) => state.timer.startedAt);
  const status = useSessionStore((state) => state.status);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "ACTIVE" || startedAt === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNow(Date.now());
    }, 0);

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1_000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [startedAt, status]);

  const durationLabel = formatSessionElapsedDuration(
    getSessionElapsedMs(
      {
        elapsedMs,
        startedAt,
      },
      now,
    ),
  );

  return (
    <div className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">
          Elapsed Duration
        </p>
        <p className="font-mono text-3xl font-semibold tracking-tight text-stone-950">
          {durationLabel}
        </p>
      </div>
      <p className="mt-3 text-sm leading-7 text-stone-700">
        The timer starts when the session becomes active and stops immediately
        when it leaves the active state.
      </p>
    </div>
  );
}
