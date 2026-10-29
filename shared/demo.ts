import type { AppSnapshot, Task } from "./types";
import { addDays, toLocalDateKey } from "./dates";
import { createId } from "./ids";

export function withDemoData(base: AppSnapshot, now: Date): AppSnapshot {
  const today = toLocalDateKey(now);
  const later = addDays(now, 2).toISOString();
  const tomorrow = addDays(now, 1).toISOString();
  const yesterday = addDays(now, -1).toISOString();
  const tasks: Task[] = [
    {
      id: "demo_brief",
      title: "Prepare tomorrow’s briefing notes",
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
        { id: "demo_s2", title: "Draft a one-page brief", completed: false },
      ],
      dependsOn: [],
      notes: "",
      createdAt: yesterday,
      updatedAt: yesterday,
      status: "planned",
      scheduledDate: today,
      isDemo: true,
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
      isDemo: true,
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
      isDemo: true,
    },
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
        message: "Sample tasks were added so you can see how recommendations work. Remove them anytime from Settings.",
      },
      ...base.activity,
    ],
  };
}

export function stripDemo(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    demoDataPresent: false,
    tasks: snapshot.tasks.filter((t) => !t.isDemo),
    categories: snapshot.categories.filter((c) => !c.isDemo),
    focusSessions: snapshot.focusSessions.filter((s) => !s.isDemo),
    activity: snapshot.activity.filter((a) => a.type !== "demo"),
  };
}
