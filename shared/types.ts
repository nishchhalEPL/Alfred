export type TaskStatus = "inbox" | "planned" | "in_progress" | "completed" | "deferred";
export type EnergyLevel = "low" | "medium" | "high";
export type Urgency = "low" | "medium" | "high" | "critical";
export type Importance = 1 | 2 | 3 | 4 | 5;
export type ThemeMode = "light" | "dark" | "system";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays?: number[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  importance: Importance;
  urgency: Urgency;
  deadline?: string;
  startDate?: string;
  estimatedMinutes?: number;
  actualMinutes: number;
  energy: EnergyLevel;
  categoryId?: string;
  subtasks: Subtask[];
  dependsOn: string[];
  notes: string;
  recurrence?: Recurrence;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status: TaskStatus;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledOrder?: number;
  unavailableUntil?: string;
  isDemo?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isDemo?: boolean;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  kind: "focus" | "short_break" | "long_break";
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
  completed: boolean;
  isDemo?: boolean;
}

export interface ActivityEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  taskId?: string;
}

export interface PlannedBlock {
  id: string;
  kind: "task" | "break" | "focus";
  taskId?: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface DailyPlan {
  date: string;
  workStartMinutes: number;
  workEndMinutes: number;
  budgetMinutes: number;
  blocks: PlannedBlock[];
  confirmed: boolean;
  notes: string;
}

export interface TimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
}

export interface AppSettings {
  displayName: string;
  theme: ThemeMode;
  workStartMinutes: number;
  workEndMinutes: number;
  defaultEnergy: EnergyLevel;
  timer: TimerSettings;
  notificationsEnabled: boolean;
}

export type TimerPhase = "focus" | "short_break" | "long_break";

export interface TimerState {
  phase: TimerPhase;
  running: boolean;
  startedAt?: string;
  remainingMsAtPause: number;
  durationMs: number;
  taskId?: string;
  completedFocusCount: number;
  lastTickAt?: string;
}

export interface AppSnapshot {
  version: number;
  profileNameFromOs?: string;
  settings: AppSettings;
  tasks: Task[];
  categories: Category[];
  focusSessions: FocusSession[];
  dailyPlans: DailyPlan[];
  activity: ActivityEvent[];
  timer: TimerState;
  demoDataPresent: boolean;
}

export type AppCommand =
  | { type: "tasks.create"; payload: Partial<Task> & { title: string } }
  | { type: "tasks.update"; payload: { id: string } & Partial<Task> }
  | { type: "tasks.delete"; payload: { id: string } }
  | { type: "tasks.complete"; payload: { id: string } }
  | { type: "tasks.reopen"; payload: { id: string } }
  | { type: "tasks.quickCapture"; payload: { title: string } }
  | { type: "settings.update"; payload: Partial<AppSettings> }
  | { type: "timer.set"; payload: TimerState }
  | { type: "session.record"; payload: Omit<FocusSession, "id"> }
  | { type: "plan.save"; payload: DailyPlan }
  | { type: "categories.save"; payload: Category[] }
  | { type: "demo.load" }
  | { type: "demo.clear" }
  | { type: "activity.add"; payload: { type: string; message: string; taskId?: string } }
  | { type: "review.reschedule"; payload: { taskIds: string[]; date: string } };

export interface Recommendation {
  task: Task | null;
  score: number;
  reasons: string[];
  alternative?: Task;
  alternativeNote?: string;
  constraintNote?: string;
  fitsWindow: boolean;
  actionableStep?: string;
  ranked: RankedTask[];
}

export interface RankedTask {
  task: Task;
  score: number;
  eligible: boolean;
  ineligibleReason?: string;
  fitsWindow: boolean;
  deadlineRisk: number;
  reasons: string[];
}

export interface EngineInput {
  now: Date;
  remainingMinutes: number;
  energyPreference: EnergyLevel;
  tasks: Task[];
  unavailableOverride?: boolean;
}

export const DATA_VERSION = 1;
