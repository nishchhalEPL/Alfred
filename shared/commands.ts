
import type { AppCommand, AppSnapshot, Task } from "./types";
import { createId } from "./ids";
import { validateTaskInput } from "./validation";
import { spawnRecurrence } from "./recurrence";
import { stripDemo, withDemoData } from "./demo";
import { estimateOf } from "./engine";

export interface CommandResult {
  snapshot: AppSnapshot;
  error?: string;
}

export function applyCommand(snapshot: AppSnapshot, command: AppCommand, now = new Date()): CommandResult {
  switch (command.type) {
   
    case "tasks.quickCapture":
    case "tasks.create": {
      const payload = command.payload as Partial<Task> & { title: string };
      const title = payload.title;
      const check = validateTaskInput(payload);
      if (!check.ok) return { snapshot, error: check.errors.join(" ") };
      const iso = now.toISOString();
      const task: Task = {
        id: createId("task"),
        title: title.trim(),
        description: command.type === "tasks.create" ? (payload.description ?? "") : "",
        importance: command.type === "tasks.create" ? (payload.importance ?? 3) : 3,
        urgency: command.type === "tasks.create" ? (payload.urgency ?? "medium") : "medium",
        deadline: payload.deadline,
        startDate: payload.startDate,
        estimatedMinutes: payload.estimatedMinutes,
        actualMinutes: 0,
        energy: command.type === "tasks.create" ? (payload.energy ?? snapshot.settings.defaultEnergy) : snapshot.settings.defaultEnergy,
        categoryId: payload.categoryId,
        subtasks: payload.subtasks ?? [],
        dependsOn: payload.dependsOn ?? [],
        notes: payload.notes ?? "",
        recurrence: payload.recurrence,
        createdAt: iso,
        updatedAt: iso,
        status: payload.status ?? "inbox",
      };
      return {
        snapshot: {
          ...snapshot,
          tasks: [task, ...snapshot.tasks],
          activity: prependActivity(snapshot, iso, "task.created", `Captured “${task.title}”.`, task.id),
        },
      };
    }

    case "tasks.update": {
      const check = validateTaskInput({ ...command.payload, title: command.payload.title ?? "ok" });
      if (command.payload.title !== undefined && !command.payload.title.trim()) {
        return { snapshot, error: "A task needs a title." };
      }
      if (command.payload.estimatedMinutes !== undefined && command.payload.estimatedMinutes < 0) {
        return { snapshot, error: check.errors.join(" ") };
      }
      return {
        snapshot: {
          ...snapshot,
          tasks: snapshot.tasks.map((t) =>
            t.id === command.payload.id
              ? { ...t, ...command.payload, id: t.id, updatedAt: now.toISOString() }
              : t,
          ),
        },
      };
    }
    case "tasks.delete":
      return {
        snapshot: {
          ...snapshot,
          tasks: snapshot.tasks
            .filter((t) => t.id !== command.payload.id)
            .map((t) => ({ ...t, dependsOn: t.dependsOn.filter((id) => id !== command.payload.id) })),
          activity: prependActivity(snapshot, now.toISOString(), "task.deleted", "A task was deleted."),
        },
      };
    case "tasks.complete": {
      const current = snapshot.tasks.find((t) => t.id === command.payload.id);
      if (!current) return { snapshot, error: "That task is no longer available." };
      const completed: Task = {
        ...current,
        status: "completed",
        completedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      console.log("TASK RECURRENCE:", completed.title, completed.recurrence);
      const next = spawnRecurrence(completed, now);
      const tasks = snapshot.tasks.map((t) => (t.id === completed.id ? completed : t));
      return {
        snapshot: {
          ...snapshot,
          tasks: next ? [next, ...tasks] : tasks,
          activity: prependActivity(
            snapshot,
            now.toISOString(),
            "task.completed",
            `Completed “${completed.title}”.`,
            completed.id,
          ),
        },
      };
    }
    case "tasks.reopen":
      return {
        snapshot: {
          ...snapshot,
          tasks: snapshot.tasks.map((t) =>
            t.id === command.payload.id
              ? { ...t, status: "inbox", completedAt: undefined, updatedAt: now.toISOString() }
              : t,
          ),
        },
      };
    case "settings.update":
      return {
        snapshot: {
          ...snapshot,
          settings: {
            ...snapshot.settings,
            ...command.payload,
            timer: { ...snapshot.settings.timer, ...(command.payload.timer ?? {}) },
          },
        },
      };
    case "timer.set":
      return { snapshot: { ...snapshot, timer: command.payload } };
    case "session.record": {
      const session = { ...command.payload, id: createId("ses") };
      let tasks = snapshot.tasks;
      if (session.completed && session.kind === "focus" && session.taskId) {
        tasks = tasks.map((t) =>
          t.id === session.taskId
            ? {
                ...t,
                actualMinutes: t.actualMinutes + session.actualMinutes,
                status: t.status === "completed" ? t.status : "in_progress",
                updatedAt: now.toISOString(),
              }
            : t,
        );
      }
      return {
        snapshot: {
          ...snapshot,
          focusSessions: [session, ...snapshot.focusSessions],
          tasks,
          activity: prependActivity(
            snapshot,
            now.toISOString(),
            session.completed ? "focus.completed" : "focus.abandoned",
            session.completed
              ? `Finished a ${session.actualMinutes}-minute focus session.`
              : "A focus session was reset before it finished and was not counted as complete.",
            session.taskId,
          ),
        },
      };
    }
    case "plan.save": {
      const others = snapshot.dailyPlans.filter((p) => p.date !== command.payload.date);
      const taskIds = command.payload.blocks.map((b) => b.taskId).filter(Boolean) as string[];
      const tasks = snapshot.tasks.map((t): Task => {
        if (!taskIds.includes(t.id)) return t;
        return {
          ...t,
          status: t.status === "completed" ? t.status : command.payload.confirmed ? "planned" : t.status,
          scheduledDate: command.payload.date,
          scheduledOrder: taskIds.indexOf(t.id),
          updatedAt: now.toISOString(),
        };
      });
      return {
        snapshot: {
          ...snapshot,
          dailyPlans: [command.payload, ...others],
          tasks,
          activity: prependActivity(
            snapshot,
            now.toISOString(),
            command.payload.confirmed ? "plan.confirmed" : "plan.drafted",
            command.payload.confirmed
              ? "Today’s plan was confirmed as a commitment."
              : "A draft plan was saved. It is a recommendation until you confirm it.",
          ),
        },
      };
    }
    case "categories.save":
      return { snapshot: { ...snapshot, categories: command.payload } };
    case "demo.load":
      return { snapshot: withDemoData(snapshot, now) };
    case "demo.clear":
      return { snapshot: stripDemo(snapshot) };
    case "activity.add":
      return {
        snapshot: {
          ...snapshot,
          activity: prependActivity(snapshot, now.toISOString(), command.payload.type, command.payload.message, command.payload.taskId),
        },
      };
    case "review.reschedule": {
      const tasks = snapshot.tasks.map((t): Task =>
        command.payload.taskIds.includes(t.id)
          ? {
              ...t,
              scheduledDate: command.payload.date,
              status: t.status === "completed" ? t.status : "planned",
              updatedAt: now.toISOString(),
            }
          : t,
      );
      return { snapshot: { ...snapshot, tasks } };
    }
    default:
      return { snapshot };
  }
}

function prependActivity(
  snapshot: AppSnapshot,
  at: string,
  type: string,
  message: string,
  taskId?: string,
) {
  return [{ id: createId("act"), at, type, message, taskId }, ...snapshot.activity].slice(0, 400);
}

export function addActualFromEstimate(task: Task): number {
  return task.actualMinutes || estimateOf(task);
}
