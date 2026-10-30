import { useMemo, useState } from "react";
import { packDay, remainingCapacity, reorderBlocks } from "@shared/scheduler";
import { formatClock, toLocalDateKey } from "@shared/dates";
import { formatMinutes } from "@shared/dates";
import { useApp } from "../context/AppContext";
import type { DailyPlan } from "@shared/types";

export function Plan() {
  const { snapshot, now, apply } = useApp();
  const date = toLocalDateKey(now);
  const existing = snapshot.dailyPlans.find((p) => p.date === date);
  const [draft, setDraft] = useState<DailyPlan | null>(existing ?? null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const start = snapshot.settings.workStartMinutes;
  const end = snapshot.settings.workEndMinutes;

  const generated = useMemo(() => {
    return packDay(date, snapshot.tasks, start, end, now, true);
  }, [date, snapshot.tasks, start, end, now]);

  function useDraft(plan: DailyPlan, notes: string[]) {
    setDraft(plan);
    setWarnings(notes);
  }

  const plan = draft ?? generated.plan;
  const leftover = remainingCapacity(plan);

  return (
    <div>
      <h2 className="hero-title">Daily Plan</h2>
      <p className="muted">
        Working window {formatClock(start)} – {formatClock(end)}. A draft is a recommendation; confirming it makes it a
        commitment.
      </p>
      <div className="toolbar">
        <button
          className="btn"
          onClick={() =>
            useDraft(
              generated.plan,
              generated.warnings.map((w) => w.message),
            )
          }
        >
          Draft from engine
        </button>
        <button className="btn secondary" onClick={() => void apply({ type: "plan.save", payload: { ...plan, confirmed: false } })}>
          Save draft
        </button>
        <button className="btn" onClick={() => void apply({ type: "plan.save", payload: { ...plan, confirmed: true } })}>
          Confirm today’s plan
        </button>
      </div>
      <div className="grid two">
        <section className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3>{plan.confirmed ? "Confirmed commitment" : "Draft recommendation"}</h3>
            <span className="badge">{formatMinutes(Math.max(0, leftover))} free</span>
          </div>
          {plan.blocks.length === 0 && <p className="empty">Nothing placed yet. Draft from the engine or add tasks first.</p>}
          {plan.blocks.map((block, index) => (
            <div className="plan-item" key={block.id}>
              <span className="muted">{formatClock(block.startMinutes)}</span>
              <div>
                <strong>{block.title}</strong>
                <div className="muted">
                  {block.kind} · {block.durationMinutes} min
                </div>
              </div>
              <div className="toolbar">
                <button
                  className="btn ghost"
                  disabled={index === 0}
                  onClick={() => setDraft(reorderBlocks(plan, index, index - 1))}
                >
                  Up
                </button>
                <button
                  className="btn ghost"
                  disabled={index === plan.blocks.length - 1}
                  onClick={() => setDraft(reorderBlocks(plan, index, index + 1))}
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </section>
        <section className="card">
          <h3>What did not fit</h3>
          <div className="warn-list">
            {(warnings.length ? warnings : generated.warnings.map((w) => w.message)).length === 0 ? (
              <p className="muted">Every considered task either fits or is blocked for a stated reason.</p>
            ) : (
              (warnings.length ? warnings : generated.warnings.map((w) => w.message)).map((w) => (
                <p key={w}>{w}</p>
              ))
            )}
          </div>
          <p className="muted">
            Unfinished work is never silently dropped. Reschedule leftovers from Review at the end of the day.
          </p>
        </section>
      </div>
    </div>
  );
}
