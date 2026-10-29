import type { AppSnapshot, Category, FocusSession, Task } from "./types";
import { addDays, endOfMonth, isSameLocalDay, startOfMonth, toLocalDateKey } from "./dates";

export interface AnalyticsRange {
  from: Date;
  to: Date;
  label: string;
  incomplete: boolean;
}

export interface DailyPoint {
  date: string;
  completed: number;
  focusMinutes: number;
}

export interface CategoryPoint {
  name: string;
  completed: number;
  focusMinutes: number;
}

export interface AnalyticsReport {
  range: AnalyticsRange;
  previous: AnalyticsRange;
  tasksCompleted: number;
  tasksCreated: number;
  tasksPending: number;
  completionRate: number;
  completionDenominator: number;
  focusMinutes: number;
  focusSessionsCompleted: number;
  plannedMinutes: number;
  actualMinutes: number;
  overdueCount: number;
  deadlineHitRate: number;
  daily: DailyPoint[];
  byCategory: CategoryPoint[];
  streak: number;
  observations: string[];
  previousComparison: {
    completedDelta: number;
    focusDelta: number;
  };
}

function inRange(iso: string | undefined, from: Date, to: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function completedOnTime(task: Task): boolean {
  if (!task.completedAt || !task.deadline) return false;
  return new Date(task.completedAt).getTime() <= new Date(task.deadline).getTime();
}

export function monthRange(year: number, monthIndex: number, now: Date): AnalyticsRange {
  const from = startOfMonth(new Date(year, monthIndex, 1));
  const monthEnd = endOfMonth(from);
  const isCurrent = now.getFullYear() === year && now.getMonth() === monthIndex;
  const to = isCurrent && now < monthEnd ? now : monthEnd;
  return {
    from,
    to,
    incomplete: isCurrent,
    label: from.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

export function previousMonthRange(range: AnalyticsRange): AnalyticsRange {
  const prev = startOfMonth(new Date(range.from.getFullYear(), range.from.getMonth() - 1, 1));
  const to = endOfMonth(prev);
  return {
    from: prev,
    to,
    incomplete: false,
    label: prev.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  };
}

export function computeReport(
  snapshot: AppSnapshot,
  range: AnalyticsRange,
  now: Date,
): AnalyticsReport {
  const previous = previousMonthRange(range);
  const tasks = snapshot.tasks.filter((t) => !t.isDemo);
  const sessions = snapshot.focusSessions.filter((s) => !s.isDemo);
  return buildForRange(tasks, sessions, snapshot.categories, range, previous, now);
}

function buildForRange(
  tasks: Task[],
  sessions: FocusSession[],
  categories: Category[],
  range: AnalyticsRange,
  previous: AnalyticsRange,
  now: Date,
): AnalyticsReport {
  const completed = tasks.filter((t) => t.status === "completed" && inRange(t.completedAt, range.from, range.to));
  const created = tasks.filter((t) => inRange(t.createdAt, range.from, range.to));
  const pending = tasks.filter((t) => t.status !== "completed");
  const focusDone = sessions.filter((s) => s.kind === "focus" && s.completed && inRange(s.endedAt, range.from, range.to));
  const plannedMinutes = completed.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0);
  const actualMinutes = completed.reduce((sum, t) => sum + t.actualMinutes, 0);
  const withDeadlines = completed.filter((t) => t.deadline);
  const onTime = withDeadlines.filter(completedOnTime);
  const overdue = pending.filter((t) => t.deadline && new Date(t.deadline).getTime() < now.getTime());

  const denominator = created.length;
  const completionRate = denominator === 0 ? 0 : completed.filter((t) => inRange(t.createdAt, range.from, range.to)).length / denominator;

  const daily: DailyPoint[] = [];
  for (let d = new Date(range.from); d.getTime() <= range.to.getTime(); d = addDays(d, 1)) {
    const key = toLocalDateKey(d);
    daily.push({
      date: key,
      completed: completed.filter((t) => t.completedAt && isSameLocalDay(new Date(t.completedAt), d)).length,
      focusMinutes: focusDone
        .filter((s) => isSameLocalDay(new Date(s.endedAt), d))
        .reduce((sum, s) => sum + s.actualMinutes, 0),
    });
  }

  const byCategoryMap = new Map<string, CategoryPoint>();
  for (const task of completed) {
    const cat = categories.find((c) => c.id === task.categoryId);
    const name = cat?.name ?? "Uncategorised";
    const current = byCategoryMap.get(name) ?? { name, completed: 0, focusMinutes: 0 };
    current.completed += 1;
    byCategoryMap.set(name, current);
  }
  for (const session of focusDone) {
    const task = tasks.find((t) => t.id === session.taskId);
    const cat = categories.find((c) => c.id === task?.categoryId);
    const name = cat?.name ?? "Uncategorised";
    const current = byCategoryMap.get(name) ?? { name, completed: 0, focusMinutes: 0 };
    current.focusMinutes += session.actualMinutes;
    byCategoryMap.set(name, current);
  }

  const prevCompleted = tasks.filter((t) => t.status === "completed" && inRange(t.completedAt, previous.from, previous.to)).length;
  const prevFocus = sessions
    .filter((s) => s.kind === "focus" && s.completed && inRange(s.endedAt, previous.from, previous.to))
    .reduce((sum, s) => sum + s.actualMinutes, 0);
  const focusMinutes = focusDone.reduce((sum, s) => sum + s.actualMinutes, 0);

  const streak = computeStreak(tasks, sessions, now);
  const observations = buildObservations({
    completed: completed.length,
    created: created.length,
    pending: pending.length,
    focusMinutes,
    overdue: overdue.length,
    onTime: onTime.length,
    withDeadlines: withDeadlines.length,
    actualMinutes,
    plannedMinutes,
    range,
    streak,
  });

  return {
    range,
    previous,
    tasksCompleted: completed.length,
    tasksCreated: created.length,
    tasksPending: pending.length,
    completionRate,
    completionDenominator: denominator,
    focusMinutes,
    focusSessionsCompleted: focusDone.length,
    plannedMinutes,
    actualMinutes,
    overdueCount: overdue.length,
    deadlineHitRate: withDeadlines.length === 0 ? 0 : onTime.length / withDeadlines.length,
    daily,
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.completed - a.completed),
    streak,
    observations,
    previousComparison: {
      completedDelta: completed.length - prevCompleted,
      focusDelta: focusMinutes - prevFocus,
    },
  };
}

function computeStreak(tasks: Task[], sessions: FocusSession[], now: Date): number {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const day = addDays(now, -i);
    const has =
      tasks.some((t) => t.completedAt && isSameLocalDay(new Date(t.completedAt), day)) ||
      sessions.some((s) => s.completed && s.kind === "focus" && isSameLocalDay(new Date(s.endedAt), day));
    if (has) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

function buildObservations(input: {
  completed: number;
  created: number;
  pending: number;
  focusMinutes: number;
  overdue: number;
  onTime: number;
  withDeadlines: number;
  actualMinutes: number;
  plannedMinutes: number;
  range: AnalyticsRange;
  streak: number;
}): string[] {
  const notes: string[] = [];
  if (input.completed === 0 && input.focusMinutes === 0) {
    notes.push("No recorded work in this period yet. Figures will appear as you complete tasks and focus sessions.");
    return notes;
  }
  if (input.range.incomplete) {
    notes.push(`${input.range.label} is still in progress, so totals are partial.`);
  }
  if (input.streak >= 3) {
    notes.push(`You have recorded work on ${input.streak} consecutive days.`);
  }
  if (input.plannedMinutes > 0 && input.actualMinutes > input.plannedMinutes * 1.25) {
    notes.push("Actual time is running ahead of estimates. Consider slightly longer estimates.");
  } else if (input.plannedMinutes > 0 && input.actualMinutes > 0 && input.actualMinutes < input.plannedMinutes * 0.75) {
    notes.push("Tasks are finishing faster than estimated. You may be able to plan a little more ambitiously.");
  }
  if (input.overdue > 0) {
    notes.push(`${input.overdue} open task${input.overdue === 1 ? "" : "s"} ${input.overdue === 1 ? "is" : "are"} past ${input.overdue === 1 ? "its" : "their"} deadline.`);
  }
  if (input.withDeadlines >= 3) {
    notes.push(`Of completed tasks with deadlines, ${input.onTime} of ${input.withDeadlines} finished on time.`);
  }
  return notes;
}

export function weekTrend(snapshot: AppSnapshot, now: Date): DailyPoint[] {
  const tasks = snapshot.tasks.filter((t) => !t.isDemo);
  const sessions = snapshot.focusSessions.filter((s) => !s.isDemo);
  const points: DailyPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = addDays(now, -i);
    points.push({
      date: toLocalDateKey(d),
      completed: tasks.filter((t) => t.completedAt && isSameLocalDay(new Date(t.completedAt), d)).length,
      focusMinutes: sessions
        .filter((s) => s.completed && s.kind === "focus" && isSameLocalDay(new Date(s.endedAt), d))
        .reduce((sum, s) => sum + s.actualMinutes, 0),
    });
  }
  return points;
}
