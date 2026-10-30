import { useEffect, useState } from "react";
import type { EnergyLevel, ThemeMode } from "@shared/types";
import { createId } from "@shared/ids";
import { useApp } from "../context/AppContext";
import { Modal } from "../components/Modal";

export function SettingsPage() {
  const { snapshot, apply } = useApp();
  const [path, setPath] = useState("");
  const [message, setMessage] = useState("");
  const [importPreview, setImportPreview] = useState<number | null>(null);

  useEffect(() => {
    void window.alfred.dataPath().then(setPath);
  }, []);

  async function doImport() {
    const result = await window.alfred.importData();
    if (result.error) setMessage(result.error);
    else if (result.needsConfirm) setImportPreview(result.previewCount ?? 0);
    else if (result.ok === false) setMessage("Import cancelled.");
  }

  return (
    <div>
      <h2 className="hero-title">Settings</h2>
      <section className="card">
        <h3>You</h3>
        <div className="form-grid">
          <label>
            Preferred name
            <input
              className="input"
              value={snapshot.settings.displayName}
              onChange={(e) => void apply({ type: "settings.update", payload: { displayName: e.target.value } })}
            />
          </label>
          <label>
            Theme
            <select
              value={snapshot.settings.theme}
              onChange={(e) => void apply({ type: "settings.update", payload: { theme: e.target.value as ThemeMode } })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label>
            Work starts
            <input
              className="input"
              type="time"
              value={minutesToTime(snapshot.settings.workStartMinutes)}
              onChange={(e) =>
                void apply({ type: "settings.update", payload: { workStartMinutes: timeToMinutes(e.target.value) } })
              }
            />
          </label>
          <label>
            Work ends
            <input
              className="input"
              type="time"
              value={minutesToTime(snapshot.settings.workEndMinutes)}
              onChange={(e) =>
                void apply({ type: "settings.update", payload: { workEndMinutes: timeToMinutes(e.target.value) } })
              }
            />
          </label>
          <label>
            Energy preference
            <select
              value={snapshot.settings.defaultEnergy}
              onChange={(e) =>
                void apply({ type: "settings.update", payload: { defaultEnergy: e.target.value as EnergyLevel } })
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Desktop notifications
            <select
              value={snapshot.settings.notificationsEnabled ? "on" : "off"}
              onChange={(e) =>
                void apply({ type: "settings.update", payload: { notificationsEnabled: e.target.value === "on" } })
              }
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </label>
        </div>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Focus timer</h3>
        <div className="form-grid">
          {(
            [
              ["focusMinutes", "Focus minutes"],
              ["shortBreakMinutes", "Short break"],
              ["longBreakMinutes", "Long break"],
              ["longBreakEvery", "Long break every N sessions"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className="input"
                type="number"
                min={1}
                value={snapshot.settings.timer[key]}
                onChange={(e) =>
                  void apply({
                    type: "settings.update",
                    payload: { timer: { ...snapshot.settings.timer, [key]: Number(e.target.value) } },
                  })
                }
              />
            </label>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Categories</h3>
        {snapshot.categories.map((c, i) => (
          <div className="task-row" key={c.id}>
            <input
              className="input"
              value={c.name}
              onChange={(e) => {
                const next = snapshot.categories.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x));
                void apply({ type: "categories.save", payload: next });
              }}
            />
          </div>
        ))}
        <button
          className="btn ghost"
          onClick={() =>
            void apply({
              type: "categories.save",
              payload: [...snapshot.categories, { id: createId("cat"), name: "New category", color: "#6b8f71" }],
            })
          }
        >
          Add category
        </button>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <h3>Data and backup</h3>
        <p>
          Alfred stores everything locally in:
          <br />
          <code>{path || "Loading…"}</code>
        </p>
        <p className="muted">
          Copy that JSON file for a manual backup. Export creates a snapshot you can keep elsewhere. Import replaces
          the current data after confirmation. There is no cloud sync.
        </p>
        <div className="toolbar">
          <button
            className="btn"
            onClick={async () => {
              const result = await window.alfred.exportData();
              setMessage(result.ok ? `Exported to ${result.path}` : result.error || "Export cancelled.");
            }}
          >
            Export JSON
          </button>
          <button className="btn secondary" onClick={() => void doImport()}>
            Import JSON
          </button>
          {snapshot.demoDataPresent && (
            <button className="btn ghost" onClick={() => void apply({ type: "demo.clear" })}>
              Remove sample data
            </button>
          )}
          <button className="btn ghost" onClick={() => void apply({ type: "demo.load" })}>
            Load sample tasks
          </button>
        </div>
        {message && <p>{message}</p>}
        <p className="muted">
          Keyboard: ⌘1 Dashboard, ⌘2 Tasks, ⌘3 Plan, ⌘4 Focus, ⌘5 Insights, ⌘K capture, space on Focus to start or
          pause.
        </p>
      </section>
      {importPreview !== null && (
        <Modal title="Replace all local data?" onClose={() => setImportPreview(null)}>
          <p>
            The file looks valid and contains {importPreview} task{importPreview === 1 ? "" : "s"}. Importing will
            replace your current Alfred data.
          </p>
          <div className="toolbar">
            <button
              className="btn danger"
              onClick={async () => {
                const result = await window.alfred.confirmImport();
                setImportPreview(null);
                setMessage(result.ok ? "Import complete. Reloading." : result.error || "Import failed.");
                if (result.ok) window.location.reload();
              }}
            >
              Replace data
            </button>
            <button className="btn ghost" onClick={() => setImportPreview(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
