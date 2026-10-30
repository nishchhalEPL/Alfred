import { addDays, toLocalDateKey } from "@shared/dates";
import { useApp } from "../context/AppContext";

export function Review() {
  const { snapshot, now, apply } = useApp();
  const today = toLocalDateKey(now);
  const tomorrow = toLocalDateKey(addDays(now, 1));
  const completed = snapshot.tasks.filter(
    (t) => t.completedAt && toLocalDateKey(new Date(t.completedAt)) === today,
  );
  const leftover = snapshot.tasks.filter(
    (t) => t.status !== "completed" && (t.scheduledDate === today || t.status === "in_progress" || t.status === "planned"),
  );

  return (
    <div>
      <h2 className="hero-title">End of day</h2>
      <p className="muted">A short account of what moved, and what should be placed tomorrow.</p>
      <div className="grid two">
        <section className="card">
          <h3>Completed today</h3>
          {completed.length === 0 ? (
            <p className="empty">Nothing completed yet today.</p>
          ) : (
            completed.map((t) => (
              <p key={t.id}>{t.title}</p>
            ))
          )}
        </section>
        <section className="card">
          <h3>Still open</h3>
          {leftover.length === 0 ? (
            <p className="empty">No planned leftovers. A quiet close to the day.</p>
          ) : (
            leftover.map((t) => <p key={t.id}>{t.title}</p>)
          )}
          <button
            className="btn"
            disabled={leftover.length === 0}
            onClick={() =>
              void apply({
                type: "review.reschedule",
                payload: { taskIds: leftover.map((t) => t.id), date: tomorrow },
              })
            }
          >
            Move leftovers to tomorrow
          </button>
        </section>
      </div>
    </div>
  );
}
