import { formatMs } from "@shared/dates";
import { switchPhase } from "@shared/timer";
import { useApp } from "../context/AppContext";

export function Focus() {
  const {
    snapshot,
    remainingLabelMs,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    skipFocus,
    apply,
  } = useApp();
  const linked = snapshot.tasks.find((t) => t.id === snapshot.timer.taskId);
  const total = snapshot.timer.durationMs || 1;
  const progress = 1 - remainingLabelMs / total;

  return (
    <div>
      <h2 className="hero-title">Focus Room</h2>
      <p className="muted">Time is derived from when the session started, so minimising the window will not invent extra minutes.</p>
      <section className="card recommendation" style={{ textAlign: "center" }}>
        <p className="badge">{snapshot.timer.phase.replace("_", " ")}</p>
        <div className="timer-face">{formatMs(remainingLabelMs)}</div>
        <div className="progress" style={{ maxWidth: 360, margin: "0 auto 16px" }}>
          <span style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }} />
        </div>
        <p>{linked ? `Linked to “${linked.title}”` : "No task linked"}</p>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          {!snapshot.timer.running ? (
            <button className="btn" onClick={() => void (snapshot.timer.startedAt || snapshot.timer.remainingMsAtPause < snapshot.timer.durationMs ? resumeFocus() : startFocus(linked))}>
              {snapshot.timer.remainingMsAtPause < snapshot.timer.durationMs && !snapshot.timer.running ? "Resume" : "Start"}
            </button>
          ) : (
            <button className="btn secondary" onClick={() => void pauseFocus()}>
              Pause
            </button>
          )}
          <button className="btn ghost" onClick={() => void resetFocus()}>
            Reset
          </button>
          <button className="btn ghost" onClick={() => void skipFocus()}>
            Skip
          </button>
        </div>
        <div className="toolbar" style={{ justifyContent: "center" }}>
          {(["focus", "short_break", "long_break"] as const).map((phase) => (
            <button
              key={phase}
              className="btn ghost"
              onClick={() =>
                void apply({
                  type: "timer.set",
                  payload: switchPhase(snapshot.settings.timer, phase, snapshot.timer.taskId, snapshot.timer.completedFocusCount),
                })
              }
            >
              {phase.replace("_", " ")}
            </button>
          ))}
        </div>
        <label style={{ display: "block", maxWidth: 420, margin: "12px auto 0" }}>
          Link a task
          <select
            value={snapshot.timer.taskId ?? ""}
            onChange={(e) =>
              void apply({
                type: "timer.set",
                payload: { ...snapshot.timer, taskId: e.target.value || undefined },
              })
            }
          >
            <option value="">None</option>
            {snapshot.tasks
              .filter((t) => t.status !== "completed")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </label>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Focus history</h3>
        {snapshot.focusSessions.length === 0 ? (
          <p className="empty">Completed sessions will be listed here. Incomplete resets are never counted as done.</p>
        ) : (
          snapshot.focusSessions.slice(0, 12).map((s) => (
            <div className="task-row" key={s.id}>
              <div>
                {s.kind.replace("_", " ")} · {s.actualMinutes} min
                <div className="muted">{new Date(s.endedAt).toLocaleString()}</div>
              </div>
              <span className={s.completed ? "badge" : "badge warn"}>{s.completed ? "Completed" : "Not counted"}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
