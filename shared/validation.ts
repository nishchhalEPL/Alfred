import type {
  AppSnapshot,
  AppSettings,
  Category,
  DailyPlan,
  EnergyLevel,
  FocusSession,
  Importance,
  Recurrence,
  Task,
  TaskStatus,
  TimerState,
  Urgency,
} from "./types";
import { DATA_VERSION } from "./types";
import { emptySnapshot } from "./defaults";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const STATUSES: TaskStatus[] = ["inbox", "planned", "in_progress", "completed", "deferred"];
const ENERGIES: EnergyLevel[] = ["low", "medium", "high"];
const URGENCIES: Urgency[] = ["low", "medium", "high", "critical"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateTaskInput(input: Partial<Task> & { title?: string }): ValidationResult {
  const errors: string[] = [];
  const title = input.title?.trim() ?? "";
  if (!title) errors.push("A task needs a title.");
  if (title.length > 200) errors.push("Titles should be 200 characters or fewer.");
  if (input.importance != null && ![1, 2, 3, 4, 5].includes(Number(input.importance))) {
    errors.push("Importance must be between 1 and 5.");
  }
  if (input.estimatedMinutes != null && input.estimatedMinutes < 0) {
    errors.push("Estimated duration cannot be negative.");
  }
  if (input.actualMinutes != null && input.actualMinutes < 0) {
    errors.push("Actual time cannot be negative.");
  }
  if (input.deadline && input.startDate) {
    const start = new Date(input.startDate).getTime();
    const due = new Date(input.deadline).getTime();
    if (Number.isNaN(start) || Number.isNaN(due)) errors.push("Dates must be valid.");
    else if (start > due) errors.push("The start date cannot be after the deadline.");
  }
  if (input.deadline && Number.isNaN(new Date(input.deadline).getTime())) {
    errors.push("Deadline is not a valid date.");
  }
  return { ok: errors.length === 0, errors };
}

export function sanitizeTask(raw: unknown, fallbackNow: string): Task | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const importance = Number(raw.importance) as Importance;
  const status = STATUSES.includes(raw.status as TaskStatus) ? (raw.status as TaskStatus) : "inbox";
  const energy = ENERGIES.includes(raw.energy as EnergyLevel) ? (raw.energy as EnergyLevel) : "medium";
  const urgency = URGENCIES.includes(raw.urgency as Urgency) ? (raw.urgency as Urgency) : "medium";
  const subtasks = Array.isArray(raw.subtasks)
    ? raw.subtasks
        .filter(isRecord)
        .map((s) => ({
          id: String(s.id ?? cryptoRandom()),
          title: String(s.title ?? "").slice(0, 200),
          completed: Boolean(s.completed),
        }))
        .filter((s) => s.title)
    : [];
  const dependsOn = Array.isArray(raw.dependsOn)
    ? raw.dependsOn.filter((id): id is string => typeof id === "string")
    : [];
  return {
    id: raw.id,
    title: raw.title.trim().slice(0, 200),
    description: typeof raw.description === "string" ? raw.description : "",
    importance: [1, 2, 3, 4, 5].includes(importance) ? importance : 3,
    urgency,
    deadline: isIsoDate(raw.deadline) ? raw.deadline : undefined,
    startDate: isIsoDate(raw.startDate) ? raw.startDate : undefined,
    estimatedMinutes:
      typeof raw.estimatedMinutes === "number" && raw.estimatedMinutes >= 0
        ? Math.round(raw.estimatedMinutes)
        : undefined,
    actualMinutes:
      typeof raw.actualMinutes === "number" && raw.actualMinutes >= 0 ? raw.actualMinutes : 0,
    energy,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : undefined,
    subtasks,
    dependsOn,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    recurrence: sanitizeRecurrence(raw.recurrence),
    createdAt: isIsoDate(raw.createdAt) ? raw.createdAt : fallbackNow,
    updatedAt: isIsoDate(raw.updatedAt) ? raw.updatedAt : fallbackNow,
    completedAt: isIsoDate(raw.completedAt) ? raw.completedAt : undefined,
    status,
    scheduledDate: isDateKey(raw.scheduledDate) ? raw.scheduledDate : undefined,
    scheduledStart: typeof raw.scheduledStart === "string" ? raw.scheduledStart : undefined,
    scheduledOrder: typeof raw.scheduledOrder === "number" ? raw.scheduledOrder : undefined,
    unavailableUntil: isIsoDate(raw.unavailableUntil) ? raw.unavailableUntil : undefined,
    isDemo: Boolean(raw.isDemo),
  };
}

function sanitizeRecurrence(raw: unknown): Recurrence | undefined {
  if (!isRecord(raw)) return undefined;
  if (raw.frequency !== "daily" && raw.frequency !== "weekly" && raw.frequency !== "monthly") {
    return undefined;
  }
  const interval = typeof raw.interval === "number" && raw.interval >= 1 ? Math.round(raw.interval) : 1;
  const weekdays = Array.isArray(raw.weekdays)
    ? raw.weekdays.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
    : undefined;
  return { frequency: raw.frequency, interval, weekdays };
}

function cryptoRandom(): string {
  return `sub_${Math.random().toString(36).slice(2, 10)}`;
}

export function validateSnapshot(raw: unknown): { ok: true; snapshot: AppSnapshot } | { ok: false; errors: string[] } {
  if (!isRecord(raw)) return { ok: false, errors: ["Imported file is not a JSON object."] };
  const errors: string[] = [];
  const now = new Date().toISOString();
  const base = emptySnapshot();
  const version = typeof raw.version === "number" ? raw.version : DATA_VERSION;
  if (version > DATA_VERSION) errors.push("This backup was created by a newer version of Alfred.");
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((t) => sanitizeTask(t, now)).filter((t): t is Task => t !== null)
    : [];
  const categories = Array.isArray(raw.categories)
    ? raw.categories.filter(isRecord).map((c) => ({
        id: String(c.id),
        name: String(c.name ?? "Untitled"),
        color: typeof c.color === "string" ? c.color : "#6b8f71",
        isDemo: Boolean(c.isDemo),
      }))
    : base.categories;
  const focusSessions = Array.isArray(raw.focusSessions)
    ? raw.focusSessions.filter(isRecord).map(sanitizeSession).filter((s): s is FocusSession => s !== null)
    : [];
  const dailyPlans = Array.isArray(raw.dailyPlans)
    ? raw.dailyPlans.filter(isRecord).map(sanitizePlan).filter((p): p is DailyPlan => p !== null)
    : [];
  if (errors.length) return { ok: false, errors };
  const snapshot: AppSnapshot = {
    version: DATA_VERSION,
    profileNameFromOs: typeof raw.profileNameFromOs === "string" ? raw.profileNameFromOs : undefined,
    settings: sanitizeSettings(raw.settings, base.settings),
    tasks,
    categories,
    focusSessions,
    dailyPlans,
    activity: Array.isArray(raw.activity)
      ? raw.activity
          .filter(isRecord)
          .map((a) => ({
            id: String(a.id ?? cryptoRandom()),
            at: isIsoDate(a.at) ? a.at : now,
            type: String(a.type ?? "note"),
            message: String(a.message ?? ""),
            taskId: typeof a.taskId === "string" ? a.taskId : undefined,
          }))
          .slice(0, 400)
      : [],
    timer: sanitizeTimer(raw.timer, base.timer),
    demoDataPresent: Boolean(raw.demoDataPresent),
  };
  return { ok: true, snapshot };
}

function sanitizeSettings(raw: unknown, fallback: AppSettings): AppSettings {
  if (!isRecord(raw)) return fallback;
  const timer = isRecord(raw.timer) ? raw.timer : {};
  return {
    displayName: typeof raw.displayName === "string" ? raw.displayName.slice(0, 80) : fallback.displayName,
    theme:
      raw.theme === "light" || raw.theme === "dark" || raw.theme === "system" ? raw.theme : fallback.theme,
    workStartMinutes:
      typeof raw.workStartMinutes === "number" ? clamp(raw.workStartMinutes, 0, 24 * 60 - 1) : fallback.workStartMinutes,
    workEndMinutes:
      typeof raw.workEndMinutes === "number" ? clamp(raw.workEndMinutes, 1, 24 * 60) : fallback.workEndMinutes,
    defaultEnergy: ENERGIES.includes(raw.defaultEnergy as EnergyLevel)
      ? (raw.defaultEnergy as EnergyLevel)
      : fallback.defaultEnergy,
    notificationsEnabled:
      typeof raw.notificationsEnabled === "boolean" ? raw.notificationsEnabled : fallback.notificationsEnabled,
    timer: {
      focusMinutes: clampNum(timer.focusMinutes, fallback.timer.focusMinutes, 1, 180),
      shortBreakMinutes: clampNum(timer.shortBreakMinutes, fallback.timer.shortBreakMinutes, 1, 60),
      longBreakMinutes: clampNum(timer.longBreakMinutes, fallback.timer.longBreakMinutes, 1, 90),
      longBreakEvery: clampNum(timer.longBreakEvery, fallback.timer.longBreakEvery, 1, 12),
    },
  };
}

function sanitizeTimer(raw: unknown, fallback: TimerState): TimerState {
  if (!isRecord(raw)) return fallback;
  const phase = raw.phase === "short_break" || raw.phase === "long_break" ? raw.phase : "focus";
  return {
    phase,
    running: Boolean(raw.running),
    startedAt: isIsoDate(raw.startedAt) ? raw.startedAt : undefined,
    remainingMsAtPause:
      typeof raw.remainingMsAtPause === "number" ? Math.max(0, raw.remainingMsAtPause) : fallback.remainingMsAtPause,
    durationMs: typeof raw.durationMs === "number" ? Math.max(0, raw.durationMs) : fallback.durationMs,
    taskId: typeof raw.taskId === "string" ? raw.taskId : undefined,
    completedFocusCount:
      typeof raw.completedFocusCount === "number" ? Math.max(0, raw.completedFocusCount) : 0,
    lastTickAt: isIsoDate(raw.lastTickAt) ? raw.lastTickAt : undefined,
  };
}

function sanitizeSession(raw: Record<string, unknown>): FocusSession | null {
  if (typeof raw.startedAt !== "string" || typeof raw.endedAt !== "string") return null;
  const kind = raw.kind === "short_break" || raw.kind === "long_break" ? raw.kind : "focus";
  return {
    id: String(raw.id ?? cryptoRandom()),
    taskId: typeof raw.taskId === "string" ? raw.taskId : undefined,
    kind,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    plannedMinutes: typeof raw.plannedMinutes === "number" ? raw.plannedMinutes : 0,
    actualMinutes: typeof raw.actualMinutes === "number" ? raw.actualMinutes : 0,
    completed: Boolean(raw.completed),
    isDemo: Boolean(raw.isDemo),
  };
}

function sanitizePlan(raw: Record<string, unknown>): DailyPlan | null {
  if (!isDateKey(raw.date)) return null;
  return {
    date: raw.date,
    workStartMinutes: typeof raw.workStartMinutes === "number" ? raw.workStartMinutes : 9 * 60,
    workEndMinutes: typeof raw.workEndMinutes === "number" ? raw.workEndMinutes : 17 * 60,
    budgetMinutes: typeof raw.budgetMinutes === "number" ? raw.budgetMinutes : 8 * 60,
    confirmed: Boolean(raw.confirmed),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    blocks: Array.isArray(raw.blocks)
      ? raw.blocks.filter(isRecord).map((b) => ({
          id: String(b.id ?? cryptoRandom()),
          kind: b.kind === "break" || b.kind === "focus" ? b.kind : "task",
          taskId: typeof b.taskId === "string" ? b.taskId : undefined,
          title: String(b.title ?? "Block"),
          startMinutes: Number(b.startMinutes ?? 0),
          durationMinutes: Number(b.durationMinutes ?? 0),
        }))
      : [],
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampNum(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && !Number.isNaN(value) ? clamp(Math.round(value), min, max) : fallback;
}

export function remainingWorkMinutes(now: Date, workEndMinutes: number): number {
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, workEndMinutes - current);
}

export type { Category };
