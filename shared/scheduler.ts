import type { DailyPlan, PlannedBlock, Task } from "./types";
import { estimateOf, isBlocked } from "./engine";
import { createId } from "./ids";
import { daysUntil } from "./dates";

export interface ScheduleWarning {
  kind: "overflow" | "deadline" | "dependency" | "conflict" | "unscheduled";
  message: string;
  taskId?: string;
}

export function packDay(
  date: string,
  tasks: Task[],
  workStartMinutes: number,
  workEndMinutes: number,
  now: Date,
  includeBreaks = true,
): { plan: DailyPlan; warnings: ScheduleWarning[] } {
  const budget = Math.max(0, workEndMinutes - workStartMinutes);
  const open = tasks.filter((t) => t.status !== "completed" && t.status !== "deferred");
  const ordered = [...open].sort((a, b) => {
    const ao = a.scheduledOrder ?? 9999;
    const bo = b.scheduledOrder ?? 9999;
    if (ao !== bo) return ao - bo;
    const ad = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
    const bd = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
    return ad - bd;
  });

  const blocks: PlannedBlock[] = [];
  const warnings: ScheduleWarning[] = [];
  let cursor = workStartMinutes;
  let focusCount = 0;
  const placed = new Set<string>();

  const canPlace = (task: Task): boolean => {
    if (isBlocked(task, tasks)) return false;
    return task.dependsOn.every((id) => {
      const dep = tasks.find((t) => t.id === id);
      return !dep || dep.status === "completed" || placed.has(id);
    });
  };

  const remaining = [...ordered];
  let guard = 0;
  while (remaining.length && guard < 200) {
    guard += 1;
    const idx = remaining.findIndex(canPlace);
    if (idx === -1) {
      remaining.forEach((task) => {
        warnings.push({
          kind: "dependency",
          taskId: task.id,
          message: `“${task.title}” cannot be scheduled until its prerequisite is placed or finished.`,
        });
      });
      break;
    }
    const task = remaining.splice(idx, 1)[0];
    const duration = estimateOf(task);
    if (cursor + duration > workEndMinutes) {
      warnings.push({
        kind: "overflow",
        taskId: task.id,
        message: `“${task.title}” (${duration} min) does not fit before ${formatHm(workEndMinutes)}. It was kept on the list rather than discarded.`,
      });
      continue;
    }
    if (task.deadline) {
      const days = daysUntil(task.deadline, now);
      if (days < 0) {
        warnings.push({
          kind: "deadline",
          taskId: task.id,
          message: `“${task.title}” is already overdue. It is placed today so it is visible, not because the original deadline can still be met.`,
        });
      }
    }
    blocks.push({
      id: createId("block"),
      kind: "task",
      taskId: task.id,
      title: task.title,
      startMinutes: cursor,
      durationMinutes: duration,
    });
    placed.add(task.id);
    cursor += duration;
    focusCount += 1;
    if (includeBreaks && remaining.length && cursor + 5 <= workEndMinutes) {
      const isLong = focusCount > 0 && focusCount % 4 === 0;
      const br = isLong ? 15 : 5;
      if (cursor + br <= workEndMinutes) {
        blocks.push({
          id: createId("block"),
          kind: "break",
          title: isLong ? "Long break" : "Short break",
          startMinutes: cursor,
          durationMinutes: br,
        });
        cursor += br;
      }
    }
  }

  const used = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  for (let i = 1; i < blocks.length; i += 1) {
    const prev = blocks[i - 1];
    const cur = blocks[i];
    if (cur.startMinutes < prev.startMinutes + prev.durationMinutes) {
      warnings.push({
        kind: "conflict",
        message: `“${cur.title}” overlaps “${prev.title}”.`,
      });
    }
  }

  return {
    plan: {
      date,
      workStartMinutes,
      workEndMinutes,
      budgetMinutes: budget,
      blocks,
      confirmed: false,
      notes: used > budget ? "The draft exceeds the day’s budget; unfinished items were left unscheduled." : "",
    },
    warnings,
  };
}

export function remainingCapacity(plan: DailyPlan): number {
  const used = plan.blocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  return plan.budgetMinutes - used;
}

export function reorderBlocks(plan: DailyPlan, from: number, to: number): DailyPlan {
  const blocks = [...plan.blocks];
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  let cursor = plan.workStartMinutes;
  const normalized = blocks.map((b) => {
    const next = { ...b, startMinutes: cursor };
    cursor += b.durationMinutes;
    return next;
  });
  return { ...plan, blocks: normalized, confirmed: false };
}

function formatHm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
