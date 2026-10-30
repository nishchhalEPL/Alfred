import type { AppSettings, AppSnapshot, TimerState } from "./types";
import { DATA_VERSION } from "./types";

export const DEFAULT_TIMER: TimerState = {
  phase: "focus",
  running: false,
  remainingMsAtPause: 25 * 60 * 1000,
  durationMs: 25 * 60 * 1000,
  completedFocusCount: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  displayName: "",
  theme: "system",
  workStartMinutes: 9 * 60,
  workEndMinutes: 17 * 60,
  defaultEnergy: "medium",
  notificationsEnabled: true,
  timer: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
  },
};

export function emptySnapshot(osName?: string): AppSnapshot {
  return {
    version: DATA_VERSION,
    profileNameFromOs: osName,
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    categories: [
      { id: "cat_work", name: "Work", color: "#4a7c7a" },
      { id: "cat_personal", name: "Personal", color: "#6b8f71" },
      { id: "cat_home", name: "Home", color: "#b08d57" },
    ],
    focusSessions: [],
    dailyPlans: [],
    activity: [],
    timer: { ...DEFAULT_TIMER },
    demoDataPresent: false,
  };
}
