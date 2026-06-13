export type SessionTimerState = {
  elapsedMs: number;
  startedAt: number | null;
};

export const initialSessionTimerState: SessionTimerState = {
  elapsedMs: 0,
  startedAt: null,
};

export function startSessionTimer(
  startedAt: number = Date.now(),
): SessionTimerState {
  return {
    elapsedMs: 0,
    startedAt,
  };
}

export function getSessionElapsedMs(
  timer: SessionTimerState,
  now: number = Date.now(),
): number {
  if (timer.startedAt === null) {
    return timer.elapsedMs;
  }

  return timer.elapsedMs + Math.max(0, now - timer.startedAt);
}

export function stopSessionTimer(
  timer: SessionTimerState,
  stoppedAt: number = Date.now(),
): SessionTimerState {
  if (timer.startedAt === null) {
    return timer;
  }

  return {
    elapsedMs: getSessionElapsedMs(timer, stoppedAt),
    startedAt: null,
  };
}

export function formatSessionElapsedDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
