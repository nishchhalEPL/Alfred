import { describe, expect, it } from "vitest";
import { daysUntil, endOfMonth, startOfMonth, toLocalDateKey } from "../shared/dates";
import { computeReport, monthRange } from "../shared/analytics";
import { emptySnapshot } from "../shared/defaults";
import type { Task } from "../shared/types";

describe("date boundaries", () => {
  it("treats local midnight as the day boundary", () => {
    const late = new Date(2026, 0, 31, 23, 59, 0);
    const next = new Date(2026, 1, 1, 0, 1, 0);
    expect(toLocalDateKey(late)).toBe("2026-01-31");
    expect(toLocalDateKey(next)).toBe("2026-02-01");
    expect(daysUntil(next.toISOString(), late)).toBe(1);
  });

  it("handles month lengths including February", () => {
    const feb = startOfMonth(new Date(2026, 1, 10));
    expect(toLocalDateKey(feb)).toBe("2026-02-01");
    expect(toLocalDateKey(endOfMonth(feb))).toBe("2026-02-28");
  });
});

describe("analytics", () => {
  it("does not fabricate data for an empty store", () => {
    const now = new Date(2026, 9, 29, 12);
    const report = computeReport(emptySnapshot(), monthRange(2026, 9, now), now);
    expect(report.tasksCompleted).toBe(0);
    expect(report.focusMinutes).toBe(0);
    expect(report.observations[0]).toMatch(/No recorded work/);
  });

  it("counts completion rate against tasks created in the period", () => {
    const now = new Date(2026, 9, 29, 12);
    const snapshot = emptySnapshot();
    const created: Task = {
      id: "t1",
      title: "Done",
      description: "",
      importance: 3,
      urgency: "medium",
      actualMinutes: 30,
      estimatedMinutes: 25,
      energy: "medium",
      subtasks: [],
      dependsOn: [],
      notes: "",
      createdAt: new Date(2026, 9, 2).toISOString(),
      updatedAt: new Date(2026, 9, 3).toISOString(),
      completedAt: new Date(2026, 9, 3).toISOString(),
      status: "completed",
    };
    snapshot.tasks = [
      created,
      { ...created, id: "t2", title: "Open", status: "inbox", completedAt: undefined, createdAt: new Date(2026, 9, 4).toISOString() },
    ];
    const report = computeReport(snapshot, monthRange(2026, 9, now), now);
    expect(report.completionDenominator).toBe(2);
    expect(report.completionRate).toBe(0.5);
    expect(report.range.incomplete).toBe(true);
  });
});
