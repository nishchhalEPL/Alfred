import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeReport, monthRange, weekTrend } from "@shared/analytics";
import { formatMinutes, monthLabel } from "@shared/dates";
import { useApp } from "../context/AppContext";

export function Insights() {
  const { snapshot, now } = useApp();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const range = monthRange(cursor.year, cursor.month, now);
  const report = useMemo(() => computeReport(snapshot, range, now), [snapshot, range, now]);
  const weekly = useMemo(() => weekTrend(snapshot, now), [snapshot, now]);
  const hasData = report.tasksCompleted > 0 || report.focusMinutes > 0 || report.tasksCreated > 0;

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  function printReport() {
    window.print();
  }

  return (
    <div>
      <h2 className="hero-title">Insights</h2>
      <p className="muted">
        Figures are calculated from your local history. Nothing here is estimated for show.
        {snapshot.demoDataPresent ? " Sample tasks are labelled in data and excluded from these charts." : ""}
      </p>
      <div className="toolbar">
        <button className="btn ghost" onClick={() => shift(-1)}>
          Previous month
        </button>
        <strong>{monthLabel(new Date(cursor.year, cursor.month, 1))}</strong>
        <button className="btn ghost" onClick={() => shift(1)}>
          Next month
        </button>
        <button className="btn secondary" onClick={printReport}>
          Print / export report
        </button>
      </div>

      {!hasData ? (
        <section className="card empty">
          <h3>No recorded history yet</h3>
          <p>
            Complete a task or finish a focus session and this page will fill with real counts. Alfred will not invent
            productivity statistics.
          </p>
        </section>
      ) : (
        <>
          <div className="grid three">
            <Stat label="Tasks completed" value={String(report.tasksCompleted)} note={delta(report.previousComparison.completedDelta)} />
            <Stat label="Focus minutes" value={formatMinutes(report.focusMinutes)} note={delta(report.previousComparison.focusDelta, " min")} />
            <Stat
              label="Completion rate"
              value={`${Math.round(report.completionRate * 100)}%`}
              note={`Of ${report.completionDenominator} tasks created in this period.`}
            />
          </div>
          <div className="grid two" style={{ marginTop: 16 }}>
            <section className="card">
              <h3>This week</h3>
              <Chart data={weekly} />
            </section>
            <section className="card">
              <h3>This month</h3>
              {report.range.incomplete && <p className="badge brass">Month in progress</p>}
              <Chart data={report.daily} />
            </section>
          </div>
          <section className="card" style={{ marginTop: 16 }}>
            <h3>Monthly report</h3>
            <ul>
              <li>Completed: {report.tasksCompleted}</li>
              <li>Created this period: {report.tasksCreated}; still pending overall: {report.tasksPending}</li>
              <li>Focus sessions completed: {report.focusSessionsCompleted}</li>
              <li>
                Planned vs actual on completed tasks: {formatMinutes(report.plannedMinutes)} planned,{" "}
                {formatMinutes(report.actualMinutes)} recorded
              </li>
              <li>
                Deadline performance: {Math.round(report.deadlineHitRate * 100)}% of completed tasks with deadlines
                finished on time. {report.overdueCount} still overdue.
              </li>
            </ul>
            <h3>Categories</h3>
            {report.byCategory.length === 0 ? (
              <p className="muted">No categorised completions in this period.</p>
            ) : (
              report.byCategory.map((c) => (
                <p key={c.name}>
                  {c.name}: {c.completed} completed · {formatMinutes(c.focusMinutes)} focused
                </p>
              ))
            )}
            <h3>Observations</h3>
            {report.observations.map((o) => (
              <p key={o}>{o}</p>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="card stat">
      <span className="muted">{label}</span>
      <b>{value}</b>
      <span className="muted">{note}</span>
    </section>
  );
}

function delta(n: number, suffix = ""): string {
  if (n === 0) return `No change versus the previous period${suffix}.`;
  return `${n > 0 ? "+" : ""}${n}${suffix} versus the previous period.`;
}

function Chart({ data }: { data: { date: string; completed: number; focusMinutes: number }[] }) {
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" name="Tasks completed" fill="#5f7f66" />
          <Bar dataKey="focusMinutes" name="Focus minutes" fill="#3f6f6d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
