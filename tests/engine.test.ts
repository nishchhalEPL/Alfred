import { describe, expect, it } from "vitest";
import { recommend, scoreTask } from "../shared/engine";
import type { Task } from "../shared/types";

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
    description: "",
    importance: 3,
    urgency: "medium",
    actualMinutes: 0,
    energy: "medium",
    subtasks: [],
    dependsOn: [],
    notes: "",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    status: "inbox",
    ...partial,
  };
}

const noon = new Date(2026, 9, 29, 12, 0, 0);

describe("decision engine", () => {
  it("never recommends a blocked task while its prerequisite is open", () => {
    const tasks = [
      task({ id: "a", title: "Write brief", importance: 2, estimatedMinutes: 20 }),
      task({
        id: "b",
        title: "Send proposal",
        importance: 5,
        urgency: "critical",
        deadline: new Date(2026, 9, 29, 15).toISOString(),
        estimatedMinutes: 20,
        dependsOn: ["a"],
      }),
    ];
    const result = recommend({ now: noon, remainingMinutes: 120, energyPreference: "medium", tasks });
    expect(result.task?.id).toBe("a");
    const blocked = result.ranked.find((r) => r.task.id === "b");
    expect(blocked?.eligible).toBe(false);
    expect(blocked?.ineligibleReason).toMatch(/Waiting/);
  });

  it("prefers an overdue important task over a distant one", () => {
    const tasks = [
      task({
        id: "later",
        title: "Someday filing",
        importance: 5,
        deadline: new Date(2026, 11, 1).toISOString(),
        estimatedMinutes: 20,
      }),
      task({
        id: "overdue",
        title: "Overdue invoice",
        importance: 4,
        deadline: new Date(2026, 9, 20).toISOString(),
        estimatedMinutes: 20,
      }),
    ];
    const result = recommend({ now: noon, remainingMinutes: 120, energyPreference: "medium", tasks });
    expect(result.task?.id).toBe("overdue");
  });

  it("does not pick a task that cannot fit when a smaller one can", () => {
    const tasks = [
      task({ id: "long", title: "Deep rewrite", importance: 5, estimatedMinutes: 180, urgency: "high" }),
      task({ id: "short", title: "Send a note", importance: 3, estimatedMinutes: 10 }),
    ];
    const result = recommend({ now: noon, remainingMinutes: 15, energyPreference: "medium", tasks });
    expect(result.task?.id).toBe("short");
    expect(result.fitsWindow).toBe(true);
  });

  it("suggests planning when nothing fits a short window", () => {
    const tasks = [task({ id: "long", title: "Deep rewrite", importance: 5, estimatedMinutes: 180 })];
    const result = recommend({ now: noon, remainingMinutes: 8, energyPreference: "medium", tasks });
    expect(result.task).toBeNull();
    expect(result.constraintNote ?? result.reasons.join(" ")).toMatch(/planning|fit/i);
  });

  it("defaults missing estimates to 25 minutes", () => {
    const tasks = [task({ id: "x", title: "Unknown size", importance: 4 })];
    const ranked = scoreTask(tasks[0], {
      now: noon,
      remainingMinutes: 25,
      energyPreference: "medium",
      tasks,
    });
    expect(ranked.fitsWindow).toBe(true);
    expect(ranked.reasons.join(" ")).toMatch(/missing estimate/i);
  });

  it("breaks score ties with earlier deadline then importance", () => {
    const tasks = [
      task({
        id: "b",
        title: "B",
        importance: 4,
        deadline: new Date(2026, 9, 31).toISOString(),
        estimatedMinutes: 20,
        createdAt: "2026-10-02T10:00:00.000Z",
      }),
      task({
        id: "a",
        title: "A",
        importance: 4,
        deadline: new Date(2026, 9, 30).toISOString(),
        estimatedMinutes: 20,
        createdAt: "2026-10-03T10:00:00.000Z",
      }),
    ];
    const result = recommend({ now: noon, remainingMinutes: 120, energyPreference: "medium", tasks });
    expect(result.task?.id).toBe("a");
  });

  it("resumes in-progress work when scores are close", () => {
    const tasks = [
      task({ id: "new", title: "New equally important", importance: 4, estimatedMinutes: 25 }),
      task({
        id: "mid",
        title: "Already started",
        importance: 4,
        estimatedMinutes: 25,
        status: "in_progress",
      }),
    ];
    const result = recommend({ now: noon, remainingMinutes: 120, energyPreference: "medium", tasks });
    expect(result.task?.id).toBe("mid");
  });

  it("explains empty and no-deadline cases", () => {
    const empty = recommend({ now: noon, remainingMinutes: 60, energyPreference: "medium", tasks: [] });
    expect(empty.task).toBeNull();
    const noDeadline = recommend({
      now: noon,
      remainingMinutes: 60,
      energyPreference: "medium",
      tasks: [task({ id: "n", title: "Important research", importance: 5 })],
    });
    expect(noDeadline.task?.id).toBe("n");
    expect(noDeadline.reasons.join(" ")).toMatch(/No deadline/i);
  });

  it("offers a subtask as the actionable step", () => {
    const result = recommend({
      now: noon,
      remainingMinutes: 60,
      energyPreference: "medium",
      tasks: [
        task({
          id: "split",
          title: "Write report",
          importance: 5,
          estimatedMinutes: 50,
          subtasks: [
            { id: "s1", title: "Outline sections", completed: false },
            { id: "s2", title: "Draft intro", completed: false },
          ],
        }),
      ],
    });
    expect(result.actionableStep).toBe("Outline sections");
  });
});
