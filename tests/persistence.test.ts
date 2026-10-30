import { describe, expect, it } from "vitest";
import { validateSnapshot } from "../shared/validation";
import { applyCommand } from "../shared/commands";
import { emptySnapshot } from "../shared/defaults";
import { packDay } from "../shared/scheduler";
import type { Task } from "../shared/types";

describe("import validation", () => {
  it("rejects non-objects", () => {
    const result = validateSnapshot([]);
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed snapshot and drops invalid tasks", () => {
    const result = validateSnapshot({
      version: 1,
      tasks: [{ id: "1", title: "Keep me", importance: 3, status: "inbox" }, { title: "no id" }],
      settings: { displayName: "N", theme: "light" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshot.tasks).toHaveLength(1);
  });
});

describe("commands", () => {
  it("creates, completes, and keeps history until delete", () => {
    let snap = emptySnapshot();
    const created = applyCommand(snap, { type: "tasks.quickCapture", payload: { title: "Call the office" } });
    snap = created.snapshot;
    expect(snap.tasks[0].title).toBe("Call the office");
    const done = applyCommand(snap, { type: "tasks.complete", payload: { id: snap.tasks[0].id } });
    expect(done.snapshot.tasks[0].status).toBe("completed");
    const deleted = applyCommand(done.snapshot, { type: "tasks.delete", payload: { id: done.snapshot.tasks[0].id } });
    expect(deleted.snapshot.tasks).toHaveLength(0);
  });

  it("rejects empty titles", () => {
    const result = applyCommand(emptySnapshot(), { type: "tasks.create", payload: { title: "  " } });
    expect(result.error).toMatch(/title/i);
  });
});

describe("scheduler", () => {
  it("does not drop overflow tasks silently", () => {
    const tasks: Task[] = [
      {
        id: "big",
        title: "Huge",
        description: "",
        importance: 5,
        urgency: "high",
        estimatedMinutes: 400,
        actualMinutes: 0,
        energy: "high",
        subtasks: [],
        dependsOn: [],
        notes: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "inbox",
      },
    ];
    const { plan, warnings } = packDay("2026-10-29", tasks, 9 * 60, 11 * 60, new Date(2026, 9, 29, 9), false);
    expect(plan.blocks.some((b) => b.taskId === "big")).toBe(false);
    expect(warnings.some((w) => w.kind === "overflow")).toBe(true);
  });
});
