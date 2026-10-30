"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var import_node_path2 = __toESM(require("node:path"), 1);
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_os = __toESM(require("node:os"), 1);

// shared/ids.ts
function createId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// shared/types.ts
var DATA_VERSION = 1;

// shared/defaults.ts
var DEFAULT_TIMER = {
  phase: "focus",
  running: false,
  remainingMsAtPause: 25 * 60 * 1e3,
  durationMs: 25 * 60 * 1e3,
  completedFocusCount: 0
};
var DEFAULT_SETTINGS = {
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
    longBreakEvery: 4
  }
};
function emptySnapshot(osName2) {
  return {
    version: DATA_VERSION,
    profileNameFromOs: osName2,
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    categories: [
      { id: "cat_work", name: "Work", color: "#4a7c7a" },
      { id: "cat_personal", name: "Personal", color: "#6b8f71" },
      { id: "cat_home", name: "Home", color: "#b08d57" }
    ],
    focusSessions: [],
    dailyPlans: [],
    activity: [],
    timer: { ...DEFAULT_TIMER },
    demoDataPresent: false
  };
}

// shared/validation.ts
var STATUSES = ["inbox", "planned", "in_progress", "completed", "deferred"];
var ENERGIES = ["low", "medium", "high"];
var URGENCIES = ["low", "medium", "high", "critical"];
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}
function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function validateTaskInput(input) {
  const errors = [];
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
function sanitizeTask(raw, fallbackNow) {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.title !== "string") return null;
  const importance = Number(raw.importance);
  const status = STATUSES.includes(raw.status) ? raw.status : "inbox";
  const energy = ENERGIES.includes(raw.energy) ? raw.energy : "medium";
  const urgency = URGENCIES.includes(raw.urgency) ? raw.urgency : "medium";
  const subtasks = Array.isArray(raw.subtasks) ? raw.subtasks.filter(isRecord).map((s) => ({
    id: String(s.id ?? cryptoRandom()),
    title: String(s.title ?? "").slice(0, 200),
    completed: Boolean(s.completed)
  })).filter((s) => s.title) : [];
  const dependsOn = Array.isArray(raw.dependsOn) ? raw.dependsOn.filter((id) => typeof id === "string") : [];
  return {
    id: raw.id,
    title: raw.title.trim().slice(0, 200),
    description: typeof raw.description === "string" ? raw.description : "",
    importance: [1, 2, 3, 4, 5].includes(importance) ? importance : 3,
    urgency,
    deadline: isIsoDate(raw.deadline) ? raw.deadline : void 0,
    startDate: isIsoDate(raw.startDate) ? raw.startDate : void 0,
    estimatedMinutes: typeof raw.estimatedMinutes === "number" && raw.estimatedMinutes >= 0 ? Math.round(raw.estimatedMinutes) : void 0,
    actualMinutes: typeof raw.actualMinutes === "number" && raw.actualMinutes >= 0 ? raw.actualMinutes : 0,
    energy,
    categoryId: typeof raw.categoryId === "string" ? raw.categoryId : void 0,
    subtasks,
    dependsOn,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    recurrence: sanitizeRecurrence(raw.recurrence),
    createdAt: isIsoDate(raw.createdAt) ? raw.createdAt : fallbackNow,
    updatedAt: isIsoDate(raw.updatedAt) ? raw.updatedAt : fallbackNow,
    completedAt: isIsoDate(raw.completedAt) ? raw.completedAt : void 0,
    status,
    scheduledDate: isDateKey(raw.scheduledDate) ? raw.scheduledDate : void 0,
    scheduledStart: typeof raw.scheduledStart === "string" ? raw.scheduledStart : void 0,
    scheduledOrder: typeof raw.scheduledOrder === "number" ? raw.scheduledOrder : void 0,
    unavailableUntil: isIsoDate(raw.unavailableUntil) ? raw.unavailableUntil : void 0,
    isDemo: Boolean(raw.isDemo)
  };
}
function sanitizeRecurrence(raw) {
  if (!isRecord(raw)) return void 0;
  if (raw.frequency !== "daily" && raw.frequency !== "weekly" && raw.frequency !== "monthly") {
    return void 0;
  }
  const interval = typeof raw.interval === "number" && raw.interval >= 1 ? Math.round(raw.interval) : 1;
  const weekdays = Array.isArray(raw.weekdays) ? raw.weekdays.filter((d) => typeof d === "number" && d >= 0 && d <= 6) : void 0;
  return { frequency: raw.frequency, interval, weekdays };
}
function cryptoRandom() {
  return `sub_${Math.random().toString(36).slice(2, 10)}`;
}
function validateSnapshot(raw) {
  if (!isRecord(raw)) return { ok: false, errors: ["Imported file is not a JSON object."] };
  const errors = [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const base = emptySnapshot();
  const version = typeof raw.version === "number" ? raw.version : DATA_VERSION;
  if (version > DATA_VERSION) errors.push("This backup was created by a newer version of Alfred.");
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map((t) => sanitizeTask(t, now)).filter((t) => t !== null) : [];
  const categories = Array.isArray(raw.categories) ? raw.categories.filter(isRecord).map((c) => ({
    id: String(c.id),
    name: String(c.name ?? "Untitled"),
    color: typeof c.color === "string" ? c.color : "#6b8f71",
    isDemo: Boolean(c.isDemo)
  })) : base.categories;
  const focusSessions = Array.isArray(raw.focusSessions) ? raw.focusSessions.filter(isRecord).map(sanitizeSession).filter((s) => s !== null) : [];
  const dailyPlans = Array.isArray(raw.dailyPlans) ? raw.dailyPlans.filter(isRecord).map(sanitizePlan).filter((p) => p !== null) : [];
  if (errors.length) return { ok: false, errors };
  const snapshot2 = {
    version: DATA_VERSION,
    profileNameFromOs: typeof raw.profileNameFromOs === "string" ? raw.profileNameFromOs : void 0,
    settings: sanitizeSettings(raw.settings, base.settings),
    tasks,
    categories,
    focusSessions,
    dailyPlans,
    activity: Array.isArray(raw.activity) ? raw.activity.filter(isRecord).map((a) => ({
      id: String(a.id ?? cryptoRandom()),
      at: isIsoDate(a.at) ? a.at : now,
      type: String(a.type ?? "note"),
      message: String(a.message ?? ""),
      taskId: typeof a.taskId === "string" ? a.taskId : void 0
    })).slice(0, 400) : [],
    timer: sanitizeTimer(raw.timer, base.timer),
    demoDataPresent: Boolean(raw.demoDataPresent)
  };
  return { ok: true, snapshot: snapshot2 };
}
function sanitizeSettings(raw, fallback) {
  if (!isRecord(raw)) return fallback;
  const timer = isRecord(raw.timer) ? raw.timer : {};
  return {
    displayName: typeof raw.displayName === "string" ? raw.displayName.slice(0, 80) : fallback.displayName,
    theme: raw.theme === "light" || raw.theme === "dark" || raw.theme === "system" ? raw.theme : fallback.theme,
    workStartMinutes: typeof raw.workStartMinutes === "number" ? clamp(raw.workStartMinutes, 0, 24 * 60 - 1) : fallback.workStartMinutes,
    workEndMinutes: typeof raw.workEndMinutes === "number" ? clamp(raw.workEndMinutes, 1, 24 * 60) : fallback.workEndMinutes,
    defaultEnergy: ENERGIES.includes(raw.defaultEnergy) ? raw.defaultEnergy : fallback.defaultEnergy,
    notificationsEnabled: typeof raw.notificationsEnabled === "boolean" ? raw.notificationsEnabled : fallback.notificationsEnabled,
    timer: {
      focusMinutes: clampNum(timer.focusMinutes, fallback.timer.focusMinutes, 1, 180),
      shortBreakMinutes: clampNum(timer.shortBreakMinutes, fallback.timer.shortBreakMinutes, 1, 60),
      longBreakMinutes: clampNum(timer.longBreakMinutes, fallback.timer.longBreakMinutes, 1, 90),
      longBreakEvery: clampNum(timer.longBreakEvery, fallback.timer.longBreakEvery, 1, 12)
    }
  };
}
function sanitizeTimer(raw, fallback) {
  if (!isRecord(raw)) return fallback;
  const phase = raw.phase === "short_break" || raw.phase === "long_break" ? raw.phase : "focus";
  return {
    phase,
    running: Boolean(raw.running),
    startedAt: isIsoDate(raw.startedAt) ? raw.startedAt : void 0,
    remainingMsAtPause: typeof raw.remainingMsAtPause === "number" ? Math.max(0, raw.remainingMsAtPause) : fallback.remainingMsAtPause,
    durationMs: typeof raw.durationMs === "number" ? Math.max(0, raw.durationMs) : fallback.durationMs,
    taskId: typeof raw.taskId === "string" ? raw.taskId : void 0,
    completedFocusCount: typeof raw.completedFocusCount === "number" ? Math.max(0, raw.completedFocusCount) : 0,
    lastTickAt: isIsoDate(raw.lastTickAt) ? raw.lastTickAt : void 0
  };
}
function sanitizeSession(raw) {
  if (typeof raw.startedAt !== "string" || typeof raw.endedAt !== "string") return null;
  const kind = raw.kind === "short_break" || raw.kind === "long_break" ? raw.kind : "focus";
  return {
    id: String(raw.id ?? cryptoRandom()),
    taskId: typeof raw.taskId === "string" ? raw.taskId : void 0,
    kind,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt,
    plannedMinutes: typeof raw.plannedMinutes === "number" ? raw.plannedMinutes : 0,
    actualMinutes: typeof raw.actualMinutes === "number" ? raw.actualMinutes : 0,
    completed: Boolean(raw.completed),
    isDemo: Boolean(raw.isDemo)
  };
}
function sanitizePlan(raw) {
  if (!isDateKey(raw.date)) return null;
  return {
    date: raw.date,
    workStartMinutes: typeof raw.workStartMinutes === "number" ? raw.workStartMinutes : 9 * 60,
    workEndMinutes: typeof raw.workEndMinutes === "number" ? raw.workEndMinutes : 17 * 60,
    budgetMinutes: typeof raw.budgetMinutes === "number" ? raw.budgetMinutes : 8 * 60,
    confirmed: Boolean(raw.confirmed),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    blocks: Array.isArray(raw.blocks) ? raw.blocks.filter(isRecord).map((b) => ({
      id: String(b.id ?? cryptoRandom()),
      kind: b.kind === "break" || b.kind === "focus" ? b.kind : "task",
      taskId: typeof b.taskId === "string" ? b.taskId : void 0,
      title: String(b.title ?? "Block"),
      startMinutes: Number(b.startMinutes ?? 0),
      durationMinutes: Number(b.durationMinutes ?? 0)
    })) : []
  };
}
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function clampNum(value, fallback, min, max) {
  return typeof value === "number" && !Number.isNaN(value) ? clamp(Math.round(value), min, max) : fallback;
}

// shared/dates.ts
function pad(n) {
  return n.toString().padStart(2, "0");
}
function toLocalDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// shared/recurrence.ts
function nextOccurrence(from, recurrence) {
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
function spawnRecurrence(completed, now) {
  if (!completed.recurrence) return null;
  const nextDate = nextOccurrence(now, completed.recurrence);
  const deadline = completed.deadline ? shiftSameTime(completed.deadline, nextDate) : `${toLocalDateKey(nextDate)}T17:00:00`;
  return {
    ...completed,
    id: createId("task"),
    status: "inbox",
    completedAt: void 0,
    actualMinutes: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deadline,
    startDate: void 0,
    scheduledDate: void 0,
    scheduledOrder: void 0,
    scheduledStart: void 0,
    subtasks: completed.subtasks.map((s) => ({ ...s, id: createId("sub"), completed: false })),
    isDemo: false
  };
}
function shiftSameTime(iso, day) {
  const original = new Date(iso);
  const shifted = new Date(day);
  shifted.setHours(original.getHours(), original.getMinutes(), 0, 0);
  return shifted.toISOString();
}

// shared/demo.ts
function withDemoData(base, now) {
  const today = toLocalDateKey(now);
  const later = addDays(now, 2).toISOString();
  const tomorrow = addDays(now, 1).toISOString();
  const yesterday = addDays(now, -1).toISOString();
  const tasks = [
    {
      id: "demo_brief",
      title: "Prepare tomorrow\u2019s briefing notes",
      description: "Gather the three open questions and a recommended order of attack.",
      importance: 5,
      urgency: "high",
      deadline: tomorrow,
      estimatedMinutes: 40,
      actualMinutes: 0,
      energy: "medium",
      categoryId: "cat_work",
      subtasks: [
        { id: "demo_s1", title: "List unresolved questions", completed: true },
        { id: "demo_s2", title: "Draft a one-page brief", completed: false }
      ],
      dependsOn: [],
      notes: "",
      createdAt: yesterday,
      updatedAt: yesterday,
      status: "planned",
      scheduledDate: today,
      isDemo: true
    },
    {
      id: "demo_inbox",
      title: "Reply to the landlord about the boiler visit",
      description: "",
      importance: 3,
      urgency: "medium",
      deadline: later,
      estimatedMinutes: 15,
      actualMinutes: 0,
      energy: "low",
      categoryId: "cat_home",
      subtasks: [],
      dependsOn: [],
      notes: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: "inbox",
      isDemo: true
    },
    {
      id: "demo_blocked",
      title: "Send the revised proposal",
      description: "Depends on the briefing notes.",
      importance: 4,
      urgency: "high",
      deadline: later,
      estimatedMinutes: 30,
      actualMinutes: 0,
      energy: "medium",
      categoryId: "cat_work",
      subtasks: [],
      dependsOn: ["demo_brief"],
      notes: "",
      createdAt: yesterday,
      updatedAt: yesterday,
      status: "inbox",
      isDemo: true
    }
  ];
  return {
    ...base,
    demoDataPresent: true,
    tasks: [...base.tasks.filter((t) => !t.isDemo), ...tasks],
    activity: [
      {
        id: createId("act"),
        at: now.toISOString(),
        type: "demo",
        message: "Sample tasks were added so you can see how recommendations work. Remove them anytime from Settings."
      },
      ...base.activity
    ]
  };
}
function stripDemo(snapshot2) {
  return {
    ...snapshot2,
    demoDataPresent: false,
    tasks: snapshot2.tasks.filter((t) => !t.isDemo),
    categories: snapshot2.categories.filter((c) => !c.isDemo),
    focusSessions: snapshot2.focusSessions.filter((s) => !s.isDemo),
    activity: snapshot2.activity.filter((a) => a.type !== "demo")
  };
}

// shared/commands.ts
function applyCommand(snapshot2, command, now = /* @__PURE__ */ new Date()) {
  switch (command.type) {
    case "tasks.quickCapture":
    case "tasks.create": {
      const payload = command.payload;
      const title = payload.title;
      const check = validateTaskInput(payload);
      if (!check.ok) return { snapshot: snapshot2, error: check.errors.join(" ") };
      const iso = now.toISOString();
      const task = {
        id: createId("task"),
        title: title.trim(),
        description: command.type === "tasks.create" ? payload.description ?? "" : "",
        importance: command.type === "tasks.create" ? payload.importance ?? 3 : 3,
        urgency: command.type === "tasks.create" ? payload.urgency ?? "medium" : "medium",
        deadline: payload.deadline,
        startDate: payload.startDate,
        estimatedMinutes: payload.estimatedMinutes,
        actualMinutes: 0,
        energy: command.type === "tasks.create" ? payload.energy ?? snapshot2.settings.defaultEnergy : snapshot2.settings.defaultEnergy,
        categoryId: payload.categoryId,
        subtasks: payload.subtasks ?? [],
        dependsOn: payload.dependsOn ?? [],
        notes: payload.notes ?? "",
        recurrence: payload.recurrence,
        createdAt: iso,
        updatedAt: iso,
        status: payload.status ?? "inbox"
      };
      return {
        snapshot: {
          ...snapshot2,
          tasks: [task, ...snapshot2.tasks],
          activity: prependActivity(snapshot2, iso, "task.created", `Captured \u201C${task.title}\u201D.`, task.id)
        }
      };
    }
    case "tasks.update": {
      const check = validateTaskInput({ ...command.payload, title: command.payload.title ?? "ok" });
      if (command.payload.title !== void 0 && !command.payload.title.trim()) {
        return { snapshot: snapshot2, error: "A task needs a title." };
      }
      if (command.payload.estimatedMinutes !== void 0 && command.payload.estimatedMinutes < 0) {
        return { snapshot: snapshot2, error: check.errors.join(" ") };
      }
      return {
        snapshot: {
          ...snapshot2,
          tasks: snapshot2.tasks.map(
            (t) => t.id === command.payload.id ? { ...t, ...command.payload, id: t.id, updatedAt: now.toISOString() } : t
          )
        }
      };
    }
    case "tasks.delete":
      return {
        snapshot: {
          ...snapshot2,
          tasks: snapshot2.tasks.filter((t) => t.id !== command.payload.id).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((id) => id !== command.payload.id) })),
          activity: prependActivity(snapshot2, now.toISOString(), "task.deleted", "A task was deleted.")
        }
      };
    case "tasks.complete": {
      const current = snapshot2.tasks.find((t) => t.id === command.payload.id);
      if (!current) return { snapshot: snapshot2, error: "That task is no longer available." };
      const completed = {
        ...current,
        status: "completed",
        completedAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      const next = spawnRecurrence(completed, now);
      const tasks = snapshot2.tasks.map((t) => t.id === completed.id ? completed : t);
      return {
        snapshot: {
          ...snapshot2,
          tasks: next ? [next, ...tasks] : tasks,
          activity: prependActivity(
            snapshot2,
            now.toISOString(),
            "task.completed",
            `Completed \u201C${completed.title}\u201D.`,
            completed.id
          )
        }
      };
    }
    case "tasks.reopen":
      return {
        snapshot: {
          ...snapshot2,
          tasks: snapshot2.tasks.map(
            (t) => t.id === command.payload.id ? { ...t, status: "inbox", completedAt: void 0, updatedAt: now.toISOString() } : t
          )
        }
      };
    case "settings.update":
      return {
        snapshot: {
          ...snapshot2,
          settings: {
            ...snapshot2.settings,
            ...command.payload,
            timer: { ...snapshot2.settings.timer, ...command.payload.timer ?? {} }
          }
        }
      };
    case "timer.set":
      return { snapshot: { ...snapshot2, timer: command.payload } };
    case "session.record": {
      const session = { ...command.payload, id: createId("ses") };
      let tasks = snapshot2.tasks;
      if (session.completed && session.kind === "focus" && session.taskId) {
        tasks = tasks.map(
          (t) => t.id === session.taskId ? {
            ...t,
            actualMinutes: t.actualMinutes + session.actualMinutes,
            status: t.status === "completed" ? t.status : "in_progress",
            updatedAt: now.toISOString()
          } : t
        );
      }
      return {
        snapshot: {
          ...snapshot2,
          focusSessions: [session, ...snapshot2.focusSessions],
          tasks,
          activity: prependActivity(
            snapshot2,
            now.toISOString(),
            session.completed ? "focus.completed" : "focus.abandoned",
            session.completed ? `Finished a ${session.actualMinutes}-minute focus session.` : "A focus session was reset before it finished and was not counted as complete.",
            session.taskId
          )
        }
      };
    }
    case "plan.save": {
      const others = snapshot2.dailyPlans.filter((p) => p.date !== command.payload.date);
      const taskIds = command.payload.blocks.map((b) => b.taskId).filter(Boolean);
      const tasks = snapshot2.tasks.map((t) => {
        if (!taskIds.includes(t.id)) return t;
        return {
          ...t,
          status: t.status === "completed" ? t.status : command.payload.confirmed ? "planned" : t.status,
          scheduledDate: command.payload.date,
          scheduledOrder: taskIds.indexOf(t.id),
          updatedAt: now.toISOString()
        };
      });
      return {
        snapshot: {
          ...snapshot2,
          dailyPlans: [command.payload, ...others],
          tasks,
          activity: prependActivity(
            snapshot2,
            now.toISOString(),
            command.payload.confirmed ? "plan.confirmed" : "plan.drafted",
            command.payload.confirmed ? "Today\u2019s plan was confirmed as a commitment." : "A draft plan was saved. It is a recommendation until you confirm it."
          )
        }
      };
    }
    case "categories.save":
      return { snapshot: { ...snapshot2, categories: command.payload } };
    case "demo.load":
      return { snapshot: withDemoData(snapshot2, now) };
    case "demo.clear":
      return { snapshot: stripDemo(snapshot2) };
    case "activity.add":
      return {
        snapshot: {
          ...snapshot2,
          activity: prependActivity(snapshot2, now.toISOString(), command.payload.type, command.payload.message, command.payload.taskId)
        }
      };
    case "review.reschedule": {
      const tasks = snapshot2.tasks.map(
        (t) => command.payload.taskIds.includes(t.id) ? {
          ...t,
          scheduledDate: command.payload.date,
          status: t.status === "completed" ? t.status : "planned",
          updatedAt: now.toISOString()
        } : t
      );
      return { snapshot: { ...snapshot2, tasks } };
    }
    default:
      return { snapshot: snapshot2 };
  }
}
function prependActivity(snapshot2, at, type, message, taskId) {
  return [{ id: createId("act"), at, type, message, taskId }, ...snapshot2.activity].slice(0, 400);
}

// electron/store.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
function storePath(userData) {
  return import_node_path.default.join(userData, "alfred-data.json");
}
function backupPath(userData) {
  return import_node_path.default.join(userData, "alfred-data.backup.json");
}
function loadSnapshot(userData, osName2) {
  const file = storePath(userData);
  if (!import_node_fs.default.existsSync(file)) {
    const snapshot2 = emptySnapshot(osName2);
    saveSnapshot(userData, snapshot2);
    return snapshot2;
  }
  try {
    const raw = JSON.parse(import_node_fs.default.readFileSync(file, "utf8"));
    const parsed = validateSnapshot(raw);
    if (!parsed.ok) {
      const recovered = emptySnapshot(osName2);
      recovered.activity = [
        {
          id: "act_recover",
          at: (/* @__PURE__ */ new Date()).toISOString(),
          type: "storage.recovered",
          message: `Storage could not be read cleanly (${parsed.errors.join(" ")}). A fresh file was created; a backup of the previous file was kept.`
        }
      ];
      try {
        import_node_fs.default.copyFileSync(file, backupPath(userData));
      } catch {
      }
      saveSnapshot(userData, recovered);
      return recovered;
    }
    return { ...parsed.snapshot, profileNameFromOs: osName2 ?? parsed.snapshot.profileNameFromOs };
  } catch {
    const recovered = emptySnapshot(osName2);
    recovered.activity = [
      {
        id: "act_recover",
        at: (/* @__PURE__ */ new Date()).toISOString(),
        type: "storage.recovered",
        message: "The data file was unreadable. A backup was kept if possible, and Alfred started with an empty store."
      }
    ];
    try {
      if (import_node_fs.default.existsSync(file)) import_node_fs.default.copyFileSync(file, backupPath(userData));
    } catch {
    }
    saveSnapshot(userData, recovered);
    return recovered;
  }
}
function saveSnapshot(userData, snapshot2) {
  import_node_fs.default.mkdirSync(userData, { recursive: true });
  const file = storePath(userData);
  const tmp = `${file}.tmp`;
  import_node_fs.default.writeFileSync(tmp, JSON.stringify(snapshot2, null, 2), "utf8");
  import_node_fs.default.renameSync(tmp, file);
}

// electron/main.ts
var COMMAND_TYPES = /* @__PURE__ */ new Set([
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.complete",
  "tasks.reopen",
  "tasks.quickCapture",
  "settings.update",
  "timer.set",
  "session.record",
  "plan.save",
  "categories.save",
  "demo.load",
  "demo.clear",
  "activity.add",
  "review.reschedule"
]);
var mainWindow = null;
var snapshot;
var pendingImport = null;
function userDataDir() {
  return import_electron.app.getPath("userData");
}
function osName() {
  const info = import_node_os.default.userInfo();
  return info.username || "";
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Alfred",
    backgroundColor: "#f6f1e8",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: import_node_path2.default.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(import_node_path2.default.join(__dirname, "..", "dist", "index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function persist() {
  saveSnapshot(userDataDir(), snapshot);
}
import_electron.app.whenReady().then(() => {
  snapshot = loadSnapshot(userDataDir(), osName());
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
import_electron.ipcMain.handle("snapshot:get", () => snapshot);
import_electron.ipcMain.handle("command:apply", (_event, command) => {
  if (!isRecord(command) || typeof command.type !== "string" || !COMMAND_TYPES.has(command.type)) {
    return { snapshot, error: "That request was not recognised." };
  }
  const result = applyCommand(snapshot, command, /* @__PURE__ */ new Date());
  if (!result.error) {
    snapshot = result.snapshot;
    persist();
  }
  return result;
});
import_electron.ipcMain.handle("data:path", () => storePath(userDataDir()));
import_electron.ipcMain.handle("data:reveal", () => {
  import_electron.shell.showItemInFolder(storePath(userDataDir()));
});
import_electron.ipcMain.handle("data:export", async () => {
  const window = mainWindow;
  if (!window) return { ok: false, error: "No window available." };
  const choice = await import_electron.dialog.showSaveDialog(window, {
    title: "Export Alfred data",
    defaultPath: "alfred-backup.json",
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (choice.canceled || !choice.filePath) return { ok: false, canceled: true };
  try {
    import_node_fs2.default.writeFileSync(choice.filePath, JSON.stringify(snapshot, null, 2), "utf8");
    return { ok: true, path: choice.filePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not write the file." };
  }
});
import_electron.ipcMain.handle("data:import", async () => {
  const window = mainWindow;
  if (!window) return { ok: false, error: "No window available." };
  const choice = await import_electron.dialog.showOpenDialog(window, {
    title: "Import Alfred data",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (choice.canceled || !choice.filePaths[0]) return { ok: false, canceled: true };
  try {
    const raw = JSON.parse(import_node_fs2.default.readFileSync(choice.filePaths[0], "utf8"));
    const parsed = validateSnapshot(raw);
    if (!parsed.ok) return { ok: false, error: parsed.errors.join(" ") };
    pendingImport = parsed.snapshot;
    return { ok: true, needsConfirm: true, previewCount: parsed.snapshot.tasks.length };
  } catch {
    return { ok: false, error: "The file could not be parsed as JSON." };
  }
});
import_electron.ipcMain.handle("data:import-confirm", () => {
  if (!pendingImport) return { ok: false, error: "Nothing is waiting to import." };
  snapshot = pendingImport;
  pendingImport = null;
  persist();
  return { ok: true, snapshot };
});
import_electron.ipcMain.handle("notify", (_event, payload) => {
  if (!isRecord(payload) || typeof payload.title !== "string" || typeof payload.body !== "string") {
    return;
  }
  if (!snapshot.settings.notificationsEnabled) return;
  if (import_electron.Notification.isSupported()) {
    new import_electron.Notification({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 200) }).show();
  }
});
import_electron.ipcMain.on("open-path", (_event, target) => {
  if (typeof target === "string") void import_electron.shell.showItemInFolder(target);
});
