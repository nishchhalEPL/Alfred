import type { TimerPhase, TimerSettings, TimerState } from "./types";

export function phaseDurationMs(phase: TimerPhase, settings: TimerSettings): number {
  if (phase === "focus") return settings.focusMinutes * 60 * 1000;
  if (phase === "short_break") return settings.shortBreakMinutes * 60 * 1000;
  return settings.longBreakMinutes * 60 * 1000;
}

export function remainingMs(state: TimerState, nowMs: number): number {
  if (!state.running || !state.startedAt) return Math.max(0, state.remainingMsAtPause);
  const started = Date.parse(state.startedAt);
  if (Number.isNaN(started)) return Math.max(0, state.remainingMsAtPause);
  const elapsed = nowMs - started;
  if (elapsed < -5 * 60 * 1000) {
    return Math.max(0, state.remainingMsAtPause);
  }
  return Math.max(0, state.remainingMsAtPause - elapsed);
}

export function startTimer(state: TimerState, nowIso: string): TimerState {
  if (state.running) return state;
  return {
    ...state,
    running: true,
    startedAt: nowIso,
    lastTickAt: nowIso,
  };
}

export function pauseTimer(state: TimerState, nowMs: number, nowIso: string): TimerState {
  if (!state.running) return state;
  return {
    ...state,
    running: false,
    remainingMsAtPause: remainingMs(state, nowMs),
    startedAt: undefined,
    lastTickAt: nowIso,
  };
}

export function resetTimer(settings: TimerSettings, phase: TimerPhase, taskId?: string, focusCount = 0): TimerState {
  const durationMs = phaseDurationMs(phase, settings);
  return {
    phase,
    running: false,
    remainingMsAtPause: durationMs,
    durationMs,
    taskId,
    completedFocusCount: focusCount,
  };
}

export function nextPhase(state: TimerState, settings: TimerSettings): TimerPhase {
  if (state.phase === "focus") {
    const count = state.completedFocusCount + 1;
    return count % settings.longBreakEvery === 0 ? "long_break" : "short_break";
  }
  return "focus";
}

export interface CompletionResult {
  completed: boolean;
  state: TimerState;
}

/**
 * Completes a phase only when remaining time has actually reached zero.
 * Skip/reset must not use this path for incomplete work.
 */
export function completeIfFinished(
  state: TimerState,
  settings: TimerSettings,
  nowMs: number,
): CompletionResult {
  if (remainingMs(state, nowMs) > 0) {
    return { completed: false, state };
  }
  const finishedFocus = state.phase === "focus";
  const count = finishedFocus ? state.completedFocusCount + 1 : state.completedFocusCount;
  const phase = nextPhase(
    { ...state, completedFocusCount: finishedFocus ? state.completedFocusCount : count },
    settings,
  );
  const durationMs = phaseDurationMs(phase, settings);
  return {
    completed: true,
    state: {
      phase,
      running: false,
      remainingMsAtPause: durationMs,
      durationMs,
      taskId: state.taskId,
      completedFocusCount: count,
    },
  };
}

export function skipPhase(state: TimerState, settings: TimerSettings): TimerState {
  const phase = nextPhase(state, settings);
  const durationMs = phaseDurationMs(phase, settings);
  const count = state.completedFocusCount;
  return {
    phase,
    running: false,
    remainingMsAtPause: durationMs,
    durationMs,
    taskId: state.taskId,
    completedFocusCount: count,
  };
}

export function switchPhase(settings: TimerSettings, phase: TimerPhase, taskId?: string, count = 0): TimerState {
  return resetTimer(settings, phase, taskId, count);
}

export function restoreAfterClockJump(state: TimerState, nowMs: number, nowIso: string): TimerState {
  if (!state.running || !state.lastTickAt) return state;
  const last = Date.parse(state.lastTickAt);
  if (Number.isNaN(last)) return state;
  const delta = nowMs - last;
  if (Math.abs(delta) > 2 * 60 * 60 * 1000) {
    return {
      ...state,
      running: false,
      remainingMsAtPause: remainingMs({ ...state, running: false }, nowMs),
      startedAt: undefined,
      lastTickAt: nowIso,
    };
  }
  return { ...state, lastTickAt: nowIso };
}
