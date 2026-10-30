import { useEffect, useState } from "react";
import { useApp } from "./context/AppContext";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { Plan } from "./pages/Plan";
import { Focus } from "./pages/Focus";
import { Insights } from "./pages/Insights";
import { Review } from "./pages/Review";
import { SettingsPage } from "./pages/Settings";
import { Modal } from "./components/Modal";

const NAV = [
  { id: "dashboard", label: "Dashboard", key: "1" },
  { id: "tasks", label: "Tasks", key: "2" },
  { id: "plan", label: "Daily Plan", key: "3" },
  { id: "focus", label: "Focus Room", key: "4" },
  { id: "insights", label: "Insights", key: "5" },
  { id: "review", label: "Review", key: "6" },
  { id: "settings", label: "Settings", key: "7" },
] as const;

export function App() {
  const { page, setPage, loading, error, apply, pauseFocus, resumeFocus, snapshot } = useApp();
  const [capture, setCapture] = useState(false);
  const [title, setTitle] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCapture(true);
      }
      if ((e.metaKey || e.ctrlKey) && NAV.some((n) => n.key === e.key)) {
        e.preventDefault();
        const item = NAV.find((n) => n.key === e.key);
        if (item) setPage(item.id);
      }
      if (page === "focus" && e.code === "Space" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (snapshot.timer.running) void pauseFocus();
        else void resumeFocus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pauseFocus, resumeFocus, setPage, snapshot.timer.running]);

  if (loading) {
    return (
      <div className="main">
        <p className="muted">Alfred is preparing your study…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="main">
        <h2>Something went wrong</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            A
          </div>
          <h1>Alfred</h1>
          <p>Personal butler</p>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">Local only · No account required</div>
      </aside>
      <main className="main">
        {page === "dashboard" && <Dashboard />}
        {page === "tasks" && <Tasks />}
        {page === "plan" && <Plan />}
        {page === "focus" && <Focus />}
        {page === "insights" && <Insights />}
        {page === "review" && <Review />}
        {page === "settings" && <SettingsPage />}
      </main>
      {capture && (
        <Modal title="Quick capture" onClose={() => setCapture(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              void apply({ type: "tasks.quickCapture", payload: { title } });
              setTitle("");
              setCapture(false);
            }}
          >
            <input
              className="input"
              autoFocus
              placeholder="What should be remembered?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="toolbar">
              <button className="btn" type="submit">
                Capture
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
