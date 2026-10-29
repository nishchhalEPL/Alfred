import { useMemo, useState } from "react";
import type { EnergyLevel, Importance, RecurrenceFrequency, Task, Urgency } from "@shared/types";
import { validateTaskInput } from "@shared/validation";
import { localBreakdown, suggestEstimate } from "@shared/engine";
import { createId } from "@shared/ids";
import { useApp } from "../context/AppContext";

const empty: Partial<Task> & { title: string } = {
  title: "",
  description: "",
  importance: 3,
  urgency: "medium",
  energy: "medium",
  notes: "",
  subtasks: [],
  dependsOn: [],
};

export function TaskForm({
  initial,
  onDone,
}: {
  initial?: Task;
  onDone: () => void;
}) {
  const { snapshot, apply } = useApp();
  const [form, setForm] = useState<Partial<Task> & { title: string }>(initial ?? empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [localHelp, setLocalHelp] = useState<string[]>([]);

  const others = useMemo(
    () => snapshot.tasks.filter((t) => t.id !== initial?.id && t.status !== "completed"),
    [snapshot.tasks, initial?.id],
  );

  function set<K extends keyof Task>(key: K, value: Task[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const check = validateTaskInput(form);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    const error = initial
      ? await apply({ type: "tasks.update", payload: { ...form, id: initial.id } })
      : await apply({ type: "tasks.create", payload: form });
    setBusy(false);
    if (error) setErrors([error]);
    else onDone();
  }

  return (
    <div className="form-grid">
      <label className="span-2">
        Title
        <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} />
      </label>
      <label className="span-2">
        Description
        <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label>
        Importance
        <select
          value={form.importance ?? 3}
          onChange={(e) => set("importance", Number(e.target.value) as Importance)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label>
        Urgency
        <select value={form.urgency ?? "medium"} onChange={(e) => set("urgency", e.target.value as Urgency)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </label>
      <label>
        Deadline
        <input
          className="input"
          type="datetime-local"
          value={toLocalInput(form.deadline)}
          onChange={(e) => set("deadline", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        />
      </label>
      <label>
        Start date
        <input
          className="input"
          type="datetime-local"
          value={toLocalInput(form.startDate)}
          onChange={(e) => set("startDate", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
        />
      </label>
      <label>
        Estimated minutes
        <input
          className="input"
          type="number"
          min={0}
          value={form.estimatedMinutes ?? ""}
          onChange={(e) =>
            set("estimatedMinutes", e.target.value === "" ? undefined : Number(e.target.value))
          }
        />
      </label>
      <label>
        Energy
        <select value={form.energy ?? "medium"} onChange={(e) => set("energy", e.target.value as EnergyLevel)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Category
        <select
          value={form.categoryId ?? ""}
          onChange={(e) => set("categoryId", e.target.value || undefined)}
        >
          <option value="">None</option>
          {snapshot.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status ?? "inbox"} onChange={(e) => set("status", e.target.value as Task["status"])}>
          <option value="inbox">Inbox</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="deferred">Deferred</option>
          <option value="completed">Completed</option>
        </select>
      </label>
      <label className="span-2">
        Depends on
        <select
          value={form.dependsOn?.[0] ?? ""}
          onChange={(e) => set("dependsOn", e.target.value ? [e.target.value] : [])}
        >
          <option value="">No prerequisite</option>
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Repeats
        <select
          value={form.recurrence?.frequency ?? ""}
          onChange={(e) =>
            set(
              "recurrence",
              e.target.value
                ? { frequency: e.target.value as RecurrenceFrequency, interval: 1 }
                : undefined,
            )
          }
        >
          <option value="">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      <label className="span-2">
        Notes
        <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <div className="span-2">
        <p className="muted">Subtasks</p>
        {(form.subtasks ?? []).map((sub, i) => (
          <div className="task-row" key={sub.id}>
            <input
              type="checkbox"
              checked={sub.completed}
              onChange={(e) => {
                const subtasks = [...(form.subtasks ?? [])];
                subtasks[i] = { ...sub, completed: e.target.checked };
                set("subtasks", subtasks);
              }}
            />
            <input
              className="input"
              value={sub.title}
              onChange={(e) => {
                const subtasks = [...(form.subtasks ?? [])];
                subtasks[i] = { ...sub, title: e.target.value };
                set("subtasks", subtasks);
              }}
            />
          </div>
        ))}
        <button
          className="btn ghost"
          type="button"
          onClick={() => set("subtasks", [...(form.subtasks ?? []), { id: createId("sub"), title: "", completed: false }])}
        >
          Add subtask
        </button>
      </div>
      {errors.length > 0 && (
        <div className="span-2" style={{ color: "var(--danger)" }}>
          {errors.join(" ")}
        </div>
      )}
      {localHelp.length > 0 && (
        <div className="span-2 card">
          <strong>Local suggestion</strong>
          <p className="muted">This comes from Alfred’s local rules, not an external AI service.</p>
          <ul>
            {localHelp.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="span-2 toolbar">
        <button className="btn" disabled={busy} onClick={() => void save()}>
          {initial ? "Save changes" : "Create task"}
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() =>
            setLocalHelp(localBreakdown(form.title, form.description ?? ""))
          }
        >
          Suggest steps
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() =>
            set("estimatedMinutes", suggestEstimate({
              title: form.title,
              description: form.description ?? "",
              subtasks: form.subtasks ?? [],
              energy: form.energy ?? "medium",
            }))
          }
        >
          Suggest estimate
        </button>
        <button className="btn ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
