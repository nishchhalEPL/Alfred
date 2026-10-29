import { describe, expect, it } from "vitest";
import {
  completeIfFinished,
  pauseTimer,
  remainingMs,
  resetTimer,
  skipPhase,
  startTimer,
} from "../shared/timer";
import { DEFAULT_SETTINGS } from "../shared/defaults";

const settings = DEFAULT_SETTINGS.timer;

describe("timer", () => {
  it("derives remaining time from timestamps rather than a counter", () => {
    const base = resetTimer(settings, "focus");
    const started = startTimer(base, "2026-10-29T12:00:00.000Z");
    const now = Date.parse("2026-10-29T12:05:00.000Z");
    expect(remainingMs(started, now)).toBe(20 * 60 * 1000);
  });

  it("does not mark skip as a completed focus session", () => {
    const started = startTimer(resetTimer(settings, "focus"), "2026-10-29T12:00:00.000Z");
    const skipped = skipPhase(started, settings);
    expect(skipped.phase).toBe("short_break");
    expect(skipped.completedFocusCount).toBe(0);
    expect(skipped.running).toBe(false);
  });

  it("completes only when remaining time is zero", () => {
    const started = startTimer(resetTimer(settings, "focus"), "2026-10-29T12:00:00.000Z");
    const early = completeIfFinished(started, settings, Date.parse("2026-10-29T12:10:00.000Z"));
    expect(early.completed).toBe(false);
    const done = completeIfFinished(started, settings, Date.parse("2026-10-29T12:25:00.000Z"));
    expect(done.completed).toBe(true);
    expect(done.state.completedFocusCount).toBe(1);
    expect(done.state.phase).toBe("short_break");
  });

  it("takes a long break after four focus sessions", () => {
    const state = resetTimer(settings, "focus", undefined, 3);
    const started = startTimer(state, "2026-10-29T12:00:00.000Z");
    const done = completeIfFinished(started, settings, Date.parse("2026-10-29T12:25:00.000Z"));
    expect(done.state.phase).toBe("long_break");
  });

  it("pause freezes remaining time", () => {
    const started = startTimer(resetTimer(settings, "focus"), "2026-10-29T12:00:00.000Z");
    const paused = pauseTimer(started, Date.parse("2026-10-29T12:10:00.000Z"), "2026-10-29T12:10:00.000Z");
    expect(paused.running).toBe(false);
    expect(paused.remainingMsAtPause).toBe(15 * 60 * 1000);
  });
});
