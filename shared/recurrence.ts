import type { Recurrence, Task } from "./types";
import { addDays, toLocalDateKey } from "./dates";
import { createId } from "./ids";

export function nextOccurrence(from: Date, recurrence: Recurrence): Date {
  const interval = Math.max(1, recurrence.interval);
  if (recurrence.frequency === "daily") return addDays(from, interval);
  if (recurrence.frequency === "weekly") {
    if (recurrence.weekdays && recurrence.weekdays.length > 0) {
      for (let i = 1; i <= 14 * interval; i += 1) {
        const candidate = addDays(from, i);
        if (recurrence.weekdays.includes(candidate.getDay()) && i >= 7 * (interval - 1) + 1) {
          return candidate;
        }
      }
    }
    return addDays(from, 7 * interval);
  }
  const next = new Date(from);
  next.setMonth(next.getMonth() + interval);
  return next;
}

export function spawnRecurrence(completed: Task, now: Date): Task | null {
  if (!completed.recurrence) return null;
  const nextDate = nextOccurrence(now, completed.recurrence);
  const deadline = completed.deadline
    ? shiftSameTime(completed.deadline, nextDate)
    : `${toLocalDateKey(nextDate)}T17:00:00`;
  return {
    ...completed,
    id: createId("task"),
    status: "inbox",
    completedAt: undefined,
    actualMinutes: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deadline,
    startDate: undefined,
    scheduledDate: undefined,
    scheduledOrder: undefined,
    scheduledStart: undefined,
    subtasks: completed.subtasks.map((s) => ({ ...s, id: createId("sub"), completed: false })),
    isDemo: false,
  };
}

function shiftSameTime(iso: string, day: Date): string {
  const original = new Date(iso);
  const shifted = new Date(day);
  shifted.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return shifted.toISOString();
}
