import { useState, type FormEvent } from "react";
import { formatMinutes, formatMs, formatShortDate, toLocalDateKey } from "@shared/dates";
import { estimateOf } from "@shared/engine";
import { useApp } from "../context/AppContext";
import { TaskForm } from "../components/TaskForm";
import { Modal } from "../components/Modal";

export function Dashboard() {
  const {
    snapshot,
    greeting,
    remainingMinutes,
    recommendation,
    startFocus,
    apply,
    remainingLabelMs,
    now,
    setPage,
  } = useApp();
  const [quick, setQuick] = useState("");
  const [showNew, setShowNew] = useState(false);

  const today = toLocalDateKey(now);
  const open = snapshot.tasks.filter((t) => t.status !== "completed");
  const completedToday = snapshot.tasks.filter(
    (t) => t.completedAt && toLocalDateKey(new Date(t.completedAt)) === today,
  );
  const overdue = open.filter((t) => t.deadline && new Date(t.deadline) < now);
  const plannedToday = snapshot.dailyPlans.find((p) => p.date === today);
  const dailyGoal = Math.max(1, plannedToday?.blocks.filter((b) => b.kind === "task").length || open.length || 1);
  const progress = Math.min(1, completedToday.length / dailyGoal);
  const recent = snapshot.activity.slice(0, 5);
  const recentFocus = snapshot.focusSessions.filter((s) => s.kind === "focus").slice(0, 3);

  async function capture(e: FormEvent) {
    e.preventDefault();
    if (!quick.trim()) return;
    const title = quick;
    setQuick("");
    await apply({ type: "tasks.quickCapture", payload: { title } });
  }

  return (
    <div>
      <p className="muted">Alfred, at your service.</p>
      <h2 className="hero-title">{greeting}.</h2>
      <p className="muted">Here is a calm reading of what deserves your attention next.</p>

      <form className="toolbar" onSubmit={(e) => void capture(e)}>
        <input
          className="search"
          placeholder="Quick capture a task — press ⌘K anytime"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          aria-label="Quick capture"
        />
        <button className="btn" type="submit">
          Add
        </button>
        <button className="btn ghost" type="button" onClick={() => setShowNew(true)}>
          Full details
        </button>
      </form>

      <div className="grid two">
        <section className="card recommendation">
          <p className="badge brass">Your best next move</p>
          {recommendation.task ? (
            <>
              <h2>{recommendation.task.title}</h2>
              <p className="muted">
                {formatShortDate(recommendation.task.deadline)} · about {estimateOf(recommendation.task)} min ·{" "}
                {recommendation.task.urgency} urgency
              </p>
              {recommendation.actionableStep && (
                <p>Start with: {recommendation.actionableStep}</p>
              )}
              <ul className="why">
                {recommendation.reasons.slice(0, 5).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {recommendation.alternativeNote && <p className="muted">{recommendation.alternativeNote}</p>}
              {recommendation.constraintNote && <p className="muted">{recommendation.constraintNote}</p>}
              <div className="toolbar">
                <button className="btn" onClick={() => void startFocus(recommendation.task ?? undefined)}>
                  Start focus
                </button>
                <button
                  className="btn secondary"
                  onClick={() =>
                    recommendation.task &&
                    void apply({
                      type: "tasks.update",
                      payload: {
                        id: recommendation.task.id,
                        unavailableUntil: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
                      },
                    })
                  }
                >
                  Not now
                </button>
                <button className="btn ghost" onClick={() => setPage("tasks")}>
                  Choose another
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <h2>Nothing needs you immediately</h2>
              <p>{recommendation.reasons[0]}</p>
              {recommendation.alternativeNote && <p>{recommendation.alternativeNote}</p>}
              {recommendation.constraintNote && <p>{recommendation.constraintNote}</p>}
            </div>
          )}
        </section>

        <div className="grid">
          <section className="card">
            <h3>Today</h3>
            <div className="grid three">
              <div className="stat">
                <span className="muted">Remaining</span>
                <b>{formatMinutes(remainingMinutes)}</b>
              </div>
              <div className="stat">
                <span className="muted">Pending</span>
                <b>{open.length}</b>
              </div>
              <div className="stat">
                <span className="muted">Done today</span>
                <b>{completedToday.length}</b>
              </div>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              {overdue.length} overdue · {snapshot.tasks.filter((t) => t.status === "completed").length} completed in
              history
            </p>
            <div className="progress" style={{ marginTop: 12 }}>
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="muted">Daily progress against today’s planned or open work.</p>
          </section>
          <section className="card">
            <h3>Compact timer</h3>
            <div className="timer-face">{formatMs(remainingLabelMs)}</div>
            <p className="muted">
              {snapshot.timer.phase.replace("_", " ")}
              {snapshot.timer.taskId
                ? ` · ${snapshot.tasks.find((t) => t.id === snapshot.timer.taskId)?.title ?? "Linked task"}`
                : ""}
            </p>
            <button className="btn secondary" onClick={() => setPage("focus")}>
              Open Focus Room
            </button>
          </section>
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <section className="card">
          <h3>Schedule</h3>
          {plannedToday?.confirmed ? (
            plannedToday.blocks.map((b) => (
              <div className="plan-item" key={b.id}>
                <span className="muted">{formatClock(b.startMinutes)}</span>
                <span>
                  {b.title} {b.kind !== "task" && <em className="muted">({b.kind})</em>}
                </span>
                <span className="badge">{b.durationMinutes}m</span>
              </div>
            ))
          ) : (
            <div className="empty">
              No confirmed plan for today. Recommendations are suggestions until you confirm a Daily Plan.
              <div>
                <button className="btn ghost" onClick={() => setPage("plan")}>
                  Open Daily Plan
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="card">
          <h3>Recent activity</h3>
          {recent.length === 0 && recentFocus.length === 0 ? (
            <p className="empty">Activity will appear as you capture, complete, and focus.</p>
          ) : (
            <>
              {recent.map((a) => (
                <p key={a.id}>
                  {a.message} <span className="muted">{new Date(a.at).toLocaleTimeString()}</span>
                </p>
              ))}
              {recentFocus.map((s) => (
                <p key={s.id} className="muted">
                  {s.completed ? "Completed" : "Unfinished"} focus · {s.actualMinutes} min
                </p>
              ))}
            </>
          )}
        </section>
      </div>

      {showNew && (
        <Modal title="New task" onClose={() => setShowNew(false)}>
          <TaskForm onDone={() => setShowNew(false)} />
        </Modal>
      )}
    </div>
  );
}

function formatClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}
