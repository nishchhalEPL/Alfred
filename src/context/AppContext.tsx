import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AppCommand, AppSnapshot, Task } from "@shared/types";
import { emptySnapshot } from "@shared/defaults";
import { remainingWorkMinutes } from "@shared/validation";
import { recommend } from "@shared/engine";
import {
  completeIfFinished,
  pauseTimer,
  remainingMs,
  resetTimer,
  restoreAfterClockJump,
  skipPhase,
  startTimer,
} from "@shared/timer";
import { greetingForHour } from "@shared/dates";

type Page =
  | "dashboard"
  | "tasks"
  | "plan"
  | "focus"
  | "insights"
  | "review"
  | "settings";

interface AppContextValue {
  snapshot: AppSnapshot;
  loading: boolean;
  error: string | null;
  page: Page;
  setPage: (page: Page) => void;
  apply: (command: AppCommand) => Promise<string | undefined>;
  remainingMinutes: number;
  recommendation: ReturnType<typeof recommend>;
  displayName: string;
  greeting: string;
  now: Date;
  startFocus: (task?: Task) => Promise<void>;
  pauseFocus: () => Promise<void>;
  resumeFocus: () => Promise<void>;
  resetFocus: () => Promise<void>;
  skipFocus: () => Promise<void>;
  remainingLabelMs: number;
}

const AppContext = createContext<AppContextValue | null>(null);

function applyTheme(theme: AppSnapshot["settings"]["theme"]) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(emptySnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("dashboard");
  const [now, setNow] = useState(() => new Date());
  const completingRef = useRef(false);

  const apply = useCallback(async (command: AppCommand) => {
    const result = await window.alfred.apply(command);
    if (result.error) return result.error;
    setSnapshot(result.snapshot);
    return undefined;
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.alfred
      .getSnapshot()
      .then((data) => {
        if (!cancelled) {
          setSnapshot(data);
          applyTheme(data.settings.theme);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Alfred could not read local data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(snapshot.settings.theme);
  }, [snapshot.settings.theme]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = new Date();
      setNow(current);
      setSnapshot((prev) => {
        const jumped = restoreAfterClockJump(prev.timer, current.getTime(), current.toISOString());
        if (jumped.running !== prev.timer.running) {
          void apply({ type: "timer.set", payload: jumped });
          return { ...prev, timer: jumped };
        }
        const done = completeIfFinished(jumped, prev.settings.timer, current.getTime());
        if (done.completed && prev.timer.running && !completingRef.current) {
          completingRef.current = true;
          const actual = Math.round(prev.timer.durationMs / 60000);
          if (prev.timer.phase === "focus") {
            void apply({
              type: "session.record",
              payload: {
                taskId: prev.timer.taskId,
                kind: "focus",
                startedAt: prev.timer.startedAt ?? current.toISOString(),
                endedAt: current.toISOString(),
                plannedMinutes: actual,
                actualMinutes: actual,
                completed: true,
              },
            });
            void window.alfred.notify("Focus complete", "A quiet pause would serve you well.");
          } else {
            void window.alfred.notify("Break complete", "Whenever you are ready, we may continue.");
          }
          void apply({ type: "timer.set", payload: done.state }).finally(() => {
            completingRef.current = false;
          });
          return { ...prev, timer: done.state };
        }
        return prev;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [apply]);

  const remainingMinutes = remainingWorkMinutes(now, snapshot.settings.workEndMinutes);
  const recommendation = useMemo(
    () =>
      recommend({
        now,
        remainingMinutes,
        energyPreference: snapshot.settings.defaultEnergy,
        tasks: snapshot.tasks,
      }),
    [now, remainingMinutes, snapshot.settings.defaultEnergy, snapshot.tasks],
  );

  const displayName = snapshot.settings.displayName || snapshot.profileNameFromOs || "";
  const greeting = `${greetingForHour(now.getHours())}${displayName ? `, ${displayName}` : ""}`;

  const persistTimer = useCallback(
    async (next: AppSnapshot["timer"]) => {
      await apply({ type: "timer.set", payload: next });
    },
    [apply],
  );

  const startFocus = useCallback(
    async (task?: Task) => {
      const withTask = task ? { ...snapshot.timer, taskId: task.id } : snapshot.timer;
      if (task && task.status !== "in_progress" && task.status !== "completed") {
        await apply({ type: "tasks.update", payload: { id: task.id, status: "in_progress" } });
      }
      await persistTimer(startTimer(withTask, new Date().toISOString()));
      setPage("focus");
    },
    [apply, persistTimer, snapshot.timer],
  );

  const pauseFocus = useCallback(async () => {
    await persistTimer(pauseTimer(snapshot.timer, Date.now(), new Date().toISOString()));
  }, [persistTimer, snapshot.timer]);

  const resumeFocus = useCallback(async () => {
    await persistTimer(startTimer(snapshot.timer, new Date().toISOString()));
  }, [persistTimer, snapshot.timer]);

  const resetFocus = useCallback(async () => {
    await persistTimer(
      resetTimer(snapshot.settings.timer, snapshot.timer.phase, snapshot.timer.taskId, snapshot.timer.completedFocusCount),
    );
  }, [persistTimer, snapshot.settings.timer, snapshot.timer]);

  const skipFocus = useCallback(async () => {
    await persistTimer(skipPhase(snapshot.timer, snapshot.settings.timer));
  }, [persistTimer, snapshot.settings.timer, snapshot.timer]);

  const remainingLabelMs = remainingMs(snapshot.timer, now.getTime());

  const value: AppContextValue = {
    snapshot,
    loading,
    error,
    page,
    setPage,
    apply,
    remainingMinutes,
    recommendation,
    displayName,
    greeting,
    now,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    skipFocus,
    remainingLabelMs,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
