import { useMemo, useState } from "react";
import type { Task, TaskStatus } from "@shared/types";
import { formatShortDate } from "@shared/dates";
import { estimateOf, isBlocked } from "@shared/engine";
import { useApp } from "../context/AppContext";
import { Modal } from "../components/Modal";
import { TaskForm } from "../components/TaskForm";

type SortKey = "deadline" | "importance" | "created";

export function Tasks() {
  const { snapshot, apply, startFocus, now } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all" | "overdue">("all");
  const [sort, setSort] = useState<SortKey>("deadline");
  const [editing, setEditing] = useState<Task | undefined>();
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const tasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.tasks
      .filter((t) => {
        if (q && !`${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q)) return false;
        if (status === "overdue") return t.status !== "completed" && t.deadline && new Date(t.deadline) < now;
        if (status !== "all") return t.status === status;
        return true;
      })
      .sort((a, b) => {
        if (sort === "importance") return b.importance - a.importance;
        if (sort === "created") return +new Date(b.createdAt) - +new Date(a.createdAt);
        const ad = a.deadline ? +new Date(a.deadline) : Number.POSITIVE_INFINITY;
        const bd = b.deadline ? +new Date(b.deadline) : Number.POSITIVE_INFINITY;
        return ad - bd;
      });
  }, [snapshot.tasks, query, status, sort, now]);

  return (
    <div>
      <h2 className="hero-title">Tasks</h2>
      <p className="muted">Capture quickly, refine later. Completed work stays available for insights until you delete it.</p>
      <div className="toolbar">
        <input className="search" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All</option>
          <option value="inbox">Inbox</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="deferred">Deferred</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="deadline">Deadline</option>
          <option value="importance">Importance</option>
          <option value="created">Newest</option>
        </select>
        <button className="btn" onClick={() => setCreating(true)}>
          New task
        </button>
      </div>
      {tasks.length === 0 ? (
        <div className="card empty">
          <h3>No tasks match this view</h3>
          <p>Try clearing the filter, or capture something with ⌘K.</p>
        </div>
      ) : (
        <section className="card">
          {tasks.map((task) => {
            const overdue = task.status !== "completed" && task.deadline && new Date(task.deadline) < now;
            const blocked = isBlocked(task, snapshot.tasks);
            return (
              <div className="task-row" key={task.id}>
                <div style={{ flex: 1 }}>
                  <strong>{task.title}</strong>
                  <div className="muted">
                    {formatShortDate(task.deadline)} · {estimateOf(task)} min · importance {task.importance}
                  </div>
                </div>
                {overdue && <span className="badge warn">Overdue</span>}
                {blocked && <span className="badge">Blocked</span>}
                <span className="badge brass">{task.status.replace("_", " ")}</span>
                {task.status !== "completed" ? (
                  <button className="btn secondary" onClick={() => void apply({ type: "tasks.complete", payload: { id: task.id } })}>
                    Complete
                  </button>
                ) : (
                  <button className="btn ghost" onClick={() => void apply({ type: "tasks.reopen", payload: { id: task.id } })}>
                    Reopen
                  </button>
                )}
                <button className="btn ghost" onClick={() => void startFocus(task)}>
                  Focus
                </button>
                <button className="btn ghost" onClick={() => setEditing(task)}>
                  Edit
                </button>
                <button className="btn danger" onClick={() => setPendingDelete(task)}>
                  Delete
                </button>
              </div>
            );
          })}
        </section>
      )}
      {(creating || editing) && (
        <Modal title={editing ? "Edit task" : "New task"} onClose={() => { setCreating(false); setEditing(undefined); }}>
          <TaskForm
            initial={editing}
            onDone={() => {
              setCreating(false);
              setEditing(undefined);
            }}
          />
        </Modal>
      )}
      {pendingDelete && (
        <Modal title="Delete this task?" onClose={() => setPendingDelete(null)}>
          <p>
            “{pendingDelete.title}” will be removed from history and analytics. This cannot be undone from inside
            Alfred.
          </p>
          <div className="toolbar">
            <button
              className="btn danger"
              onClick={() => {
                void apply({ type: "tasks.delete", payload: { id: pendingDelete.id } });
                setPendingDelete(null);
              }}
            >
              Delete permanently
            </button>
            <button className="btn ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
