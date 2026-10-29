import type { EnergyLevel, EngineInput, RankedTask, Recommendation, Task } from "./types";
import { daysUntil } from "./dates";

/**
 * Transparent scoring model used by Alfred's local butler engine.
 *
 * Weights (documented so recommendations can be explained, not mystified):
 * - Importance: 18 points per level (1–5), max 90.
 * - Deadline risk: overdue 42, today 34, tomorrow 26, 3 days 18, 7 days 10.
 * - In progress: +16, because unfinished work should usually be resumed.
 * - Energy match: +8; mismatch: −6.
 * - Missing deadline: −4 (still eligible; importance can still win).
 * - Postponement risk: +12 when remaining days cannot absorb the estimate.
 *
 * Hard constraints that scores cannot override:
 * - Incomplete dependencies → ineligible.
 * - Status completed → ineligible.
 * - Unavailable until a future time → ineligible.
 * - Start date still in the future → ineligible.
 *
 * Soft constraints:
 * - Estimate larger than remaining window → still ranked, but not chosen as
 *   the next move if a smaller eligible task exists.
 *
 * Missing estimates default to one focus block (25 minutes).
 *
 * Tie-break order: earlier deadline, higher importance, in-progress, shorter
 * estimate, older createdAt.
 *
 * This is a practical heuristic, not a claim of global optimality.
 */
export const ENGINE_WEIGHTS = {
  importancePerLevel: 18,
  overdue: 42,
  dueToday: 34,
  dueTomorrow: 26,
  dueWithinThreeDays: 18,
  dueThisWeek: 10,
  inProgress: 16,
  energyMatch: 8,
  energyMismatch: -6,
  noDeadline: -4,
  postponementRisk: 12,
  defaultEstimateMinutes: 25,
} as const;

export function estimateOf(task: Task): number {
  return task.estimatedMinutes && task.estimatedMinutes > 0
    ? task.estimatedMinutes
    : ENGINE_WEIGHTS.defaultEstimateMinutes;
}

export function isBlocked(task: Task, tasks: Task[]): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.dependsOn.some((id) => {
    const dep = byId.get(id);
    return dep ? dep.status !== "completed" : false;
  });
}

export function isUnavailable(task: Task, now: Date): boolean {
  if (!task.unavailableUntil) return false;
  return new Date(task.unavailableUntil).getTime() > now.getTime();
}

export function isNotYetStarted(task: Task, now: Date): boolean {
  if (!task.startDate) return false;
  return new Date(task.startDate).getTime() > now.getTime();
}

export function deadlineRisk(task: Task, now: Date): number {
  if (!task.deadline) return 0;
  const days = daysUntil(task.deadline, now);
  if (days < 0) return ENGINE_WEIGHTS.overdue;
  if (days === 0) return ENGINE_WEIGHTS.dueToday;
  if (days === 1) return ENGINE_WEIGHTS.dueTomorrow;
  if (days <= 3) return ENGINE_WEIGHTS.dueWithinThreeDays;
  if (days <= 7) return ENGINE_WEIGHTS.dueThisWeek;
  return 0;
}

function postponementRisk(task: Task, now: Date): number {
  if (!task.deadline) return 0;
  const days = daysUntil(task.deadline, now);
  if (days < 0) return ENGINE_WEIGHTS.postponementRisk;
  const remainingWorkDays = Math.max(1, days);
  const minutesNeeded = estimateOf(task);
  if (minutesNeeded > remainingWorkDays * 120) return ENGINE_WEIGHTS.postponementRisk;
  return 0;
}

function energyScore(task: Task, preference: EnergyLevel): number {
  if (task.energy === preference) return ENGINE_WEIGHTS.energyMatch;
  const order: EnergyLevel[] = ["low", "medium", "high"];
  const gap = Math.abs(order.indexOf(task.energy) - order.indexOf(preference));
  return gap >= 2 ? ENGINE_WEIGHTS.energyMismatch : 0;
}

function urgencyBoost(task: Task): number {
  if (task.urgency === "critical") return 10;
  if (task.urgency === "high") return 6;
  if (task.urgency === "medium") return 2;
  return 0;
}

export function scoreTask(task: Task, input: EngineInput): RankedTask {
  const reasons: string[] = [];
  if (task.status === "completed") {
    return { task, score: -Infinity, eligible: false, ineligibleReason: "Already completed.", fitsWindow: false, deadlineRisk: 0, reasons };
  }
  if (isBlocked(task, input.tasks)) {
    const blockers = task.dependsOn
      .map((id) => input.tasks.find((t) => t.id === id))
      .filter((t): t is Task => !!t && t.status !== "completed")
      .map((t) => t.title);
    return {
      task,
      score: -Infinity,
      eligible: false,
      ineligibleReason: `Waiting on ${blockers.join(", ") || "a prerequisite"}.`,
      fitsWindow: false,
      deadlineRisk: 0,
      reasons,
    };
  }
  if (isUnavailable(task, input.now)) {
    return { task, score: -Infinity, eligible: false, ineligibleReason: "Marked unavailable for now.", fitsWindow: false, deadlineRisk: 0, reasons };
  }
  if (isNotYetStarted(task, input.now)) {
    return { task, score: -Infinity, eligible: false, ineligibleReason: "Its start date is still in the future.", fitsWindow: false, deadlineRisk: 0, reasons };
  }
  if (task.status === "deferred") {
    return { task, score: -Infinity, eligible: false, ineligibleReason: "Deferred until you bring it back.", fitsWindow: false, deadlineRisk: 0, reasons };
  }

  const est = estimateOf(task);
  const fitsWindow = est <= input.remainingMinutes || input.remainingMinutes <= 0;
  const importance = task.importance * ENGINE_WEIGHTS.importancePerLevel;
  const risk = deadlineRisk(task, input.now);
  const postpone = postponementRisk(task, input.now);
  const energy = energyScore(task, input.energyPreference);
  const progress = task.status === "in_progress" ? ENGINE_WEIGHTS.inProgress : 0;
  const noDeadline = task.deadline ? 0 : ENGINE_WEIGHTS.noDeadline;
  const score = importance + risk + postpone + energy + progress + noDeadline + urgencyBoost(task);

  reasons.push(`Importance ${task.importance}/5.`);
  if (!task.deadline) reasons.push("No deadline is set, so importance carries more of the decision.");
  else {
    const days = daysUntil(task.deadline, input.now);
    if (days < 0) reasons.push(`Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}.`);
    else if (days === 0) reasons.push("Due today.");
    else reasons.push(`Due in ${days} day${days === 1 ? "" : "s"}.`);
  }
  reasons.push(`Expected duration about ${est} minutes${task.estimatedMinutes ? "" : " (defaulted from a missing estimate)"}.`);
  if (task.status === "in_progress") reasons.push("Already in progress, so it is better to resume than to switch.");
  if (energy > 0) reasons.push("Energy requirement matches your current preference.");
  if (energy < 0) reasons.push("Energy requirement is a poor match for your current preference.");
  if (postpone > 0) reasons.push("Postponing it leaves little room before the deadline.");
  if (input.remainingMinutes > 0 && !fitsWindow) {
    reasons.push(`It does not fit the remaining ${Math.round(input.remainingMinutes)} minutes.`);
  } else if (input.remainingMinutes > 0) {
    reasons.push("It can reasonably fit the remaining time today.");
  }

  return { task, score, eligible: true, fitsWindow: input.remainingMinutes <= 0 ? false : fitsWindow, deadlineRisk: risk, reasons };
}

function compareRanked(a: RankedTask, b: RankedTask): number {
  if (b.score !== a.score) return b.score - a.score;
  const aDue = a.task.deadline ? new Date(a.task.deadline).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.task.deadline ? new Date(b.task.deadline).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;
  if (b.task.importance !== a.task.importance) return b.task.importance - a.task.importance;
  if (a.task.status === "in_progress" && b.task.status !== "in_progress") return -1;
  if (b.task.status === "in_progress" && a.task.status !== "in_progress") return 1;
  const aEst = estimateOf(a.task);
  const bEst = estimateOf(b.task);
  if (aEst !== bEst) return aEst - bEst;
  return new Date(a.task.createdAt).getTime() - new Date(b.task.createdAt).getTime();
}

export function firstIncompleteSubtask(task: Task): string | undefined {
  return task.subtasks.find((s) => !s.completed)?.title;
}

export function recommend(input: EngineInput): Recommendation {
  const ranked = input.tasks.map((task) => scoreTask(task, input)).sort(compareRanked);
  const eligible = ranked.filter((r) => r.eligible);
  const fitting = eligible.filter((r) => r.fitsWindow && input.remainingMinutes > 0);
  const shortWindow = input.remainingMinutes > 0 && input.remainingMinutes < 15;

  if (eligible.length === 0) {
    return {
      task: null,
      score: 0,
      reasons: ["There is nothing actionable just now. Capture a task, or reopen something deferred."],
      fitsWindow: false,
      ranked,
    };
  }

  let chosen: RankedTask | undefined;
  let constraintNote: string | undefined;

  if (input.remainingMinutes <= 0) {
    chosen = eligible[0];
    constraintNote =
      "The working day window has no remaining minutes. This is still the most important item, but you may prefer planning or a short wrap-up instead.";
  } else if (fitting.length > 0) {
    chosen = fitting[0];
    const blockedBetter = ranked.find((r) => !r.eligible && r.ineligibleReason?.startsWith("Waiting"));
    if (blockedBetter && (blockedBetter.task.importance >= (chosen.task.importance ?? 0))) {
      constraintNote = `“${blockedBetter.task.title}” would otherwise rank highly, but it is blocked until its prerequisite is finished.`;
    }
  } else {
    const smaller = eligible.filter((r) => estimateOf(r.task) <= input.remainingMinutes);
    if (smaller.length > 0) {
      chosen = smaller[0];
    } else {
      chosen = undefined;
      constraintNote = shortWindow
        ? `Only ${Math.round(input.remainingMinutes)} minutes remain. No open task reasonably fits. Use the window for planning, a single subtask, or a short tidy-up.`
        : `Nothing currently fits the remaining ${Math.round(input.remainingMinutes)} minutes. Consider splitting a larger task, or use the time to plan.`;
    }
  }

  if (!chosen) {
    return {
      task: null,
      score: 0,
      reasons: [constraintNote ?? "No suitable next move in the remaining time."],
      constraintNote,
      fitsWindow: false,
      ranked,
      alternative: eligible[0]?.task,
      alternativeNote: eligible[0]
        ? `The leading item, “${eligible[0].task.title}”, needs about ${estimateOf(eligible[0].task)} minutes.`
        : undefined,
    };
  }

  const alternative = eligible.find((r) => r.task.id !== chosen.task.id);
  const step = firstIncompleteSubtask(chosen.task);
  const reasons = [
    ...chosen.reasons,
    "This is the best recommendation under the current rules and information — not a claim of a unique mathematical optimum.",
  ];

  if (chosen.task.estimatedMinutes && chosen.task.estimatedMinutes > input.remainingMinutes && input.remainingMinutes > 0) {
    reasons.push("The listed duration is longer than the remaining window; treat this as a start, not a promise to finish.");
  }
  if (step) {
    reasons.push(`A smaller actionable step is ready: ${step}.`);
  }

  return {
    task: chosen.task,
    score: chosen.score,
    reasons,
    alternative: alternative?.task,
    alternativeNote: alternative
      ? `Also considered: “${alternative.task.title}” (${alternative.reasons[0] ?? "close in priority"}).`
      : undefined,
    constraintNote,
    fitsWindow: chosen.fitsWindow,
    actionableStep: step,
    ranked,
  };
}

export function localBreakdown(title: string, description: string): string[] {
  const fromDescription = description
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3)
    .slice(0, 6);
  if (fromDescription.length >= 2) return fromDescription;
  const words = title.trim();
  return [
    `Clarify the outcome for “${words}”.`,
    "Gather anything you need before starting.",
    "Complete the first 25-minute slice.",
    "Review what remains and capture the next step.",
  ];
}

export function suggestEstimate(task: Pick<Task, "title" | "description" | "subtasks" | "energy">): number {
  const base = task.energy === "high" ? 50 : task.energy === "low" ? 15 : 25;
  const extra = Math.min(90, task.subtasks.length * 20);
  const longText = (task.description?.length ?? 0) > 180 ? 20 : 0;
  return base + extra + longText;
}
