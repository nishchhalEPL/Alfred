import { app, BrowserWindow, Notification, ipcMain, dialog, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { AppCommand, AppSnapshot } from "../shared/types";
import { applyCommand } from "../shared/commands";
import { loadSnapshot, saveSnapshot, storePath } from "./store";
import { validateSnapshot, isRecord } from "../shared/validation";

const COMMAND_TYPES = new Set([
  "tasks.create",
  "tasks.update",
  "tasks.delete",
  "tasks.complete",
  "tasks.reopen",
  "tasks.quickCapture",
  "settings.update",
  "timer.set",
  "session.record",
  "plan.save",
  "categories.save",
  "demo.load",
  "demo.clear",
  "activity.add",
  "review.reschedule",
]);

let mainWindow: BrowserWindow | null = null;
let snapshot: AppSnapshot;
let pendingImport: AppSnapshot | null = null;

function userDataDir(): string {
  return app.getPath("userData");
}

function osName(): string {
  const info = os.userInfo();
  return info.username || "";
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Alfred",
    backgroundColor: "#f6f1e8",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function persist(): void {
  saveSnapshot(userDataDir(), snapshot);
}

app.whenReady().then(() => {
  snapshot = loadSnapshot(userDataDir(), osName());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("snapshot:get", () => snapshot);

ipcMain.handle("command:apply", (_event, command: unknown) => {
  if (!isRecord(command) || typeof command.type !== "string" || !COMMAND_TYPES.has(command.type)) {
    return { snapshot, error: "That request was not recognised." };
  }
  const result = applyCommand(snapshot, command as AppCommand, new Date());
  if (!result.error) {
    snapshot = result.snapshot;
    persist();
  }
  return result;
});

ipcMain.handle("data:path", () => storePath(userDataDir()));

ipcMain.handle("data:reveal", () => {
  shell.showItemInFolder(storePath(userDataDir()));
});

ipcMain.handle("data:export", async () => {
  const window = mainWindow;
  if (!window) return { ok: false, error: "No window available." };
  const choice = await dialog.showSaveDialog(window, {
    title: "Export Alfred data",
    defaultPath: "alfred-backup.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (choice.canceled || !choice.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(choice.filePath, JSON.stringify(snapshot, null, 2), "utf8");
    return { ok: true, path: choice.filePath };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not write the file." };
  }
});

ipcMain.handle("data:import", async () => {
  const window = mainWindow;
  if (!window) return { ok: false, error: "No window available." };
  const choice = await dialog.showOpenDialog(window, {
    title: "Import Alfred data",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (choice.canceled || !choice.filePaths[0]) return { ok: false, canceled: true };
  try {
    const raw = JSON.parse(fs.readFileSync(choice.filePaths[0], "utf8"));
    const parsed = validateSnapshot(raw);
    if (!parsed.ok) return { ok: false, error: parsed.errors.join(" ") };
    pendingImport = parsed.snapshot;
    return { ok: true, needsConfirm: true, previewCount: parsed.snapshot.tasks.length };
  } catch {
    return { ok: false, error: "The file could not be parsed as JSON." };
  }
});

ipcMain.handle("data:import-confirm", () => {
  if (!pendingImport) return { ok: false, error: "Nothing is waiting to import." };
  snapshot = pendingImport;
  pendingImport = null;
  persist();
  return { ok: true, snapshot };
});

ipcMain.handle("notify", (_event, payload: unknown) => {
  if (!isRecord(payload) || typeof payload.title !== "string" || typeof payload.body !== "string") {
    return;
  }
  if (!snapshot.settings.notificationsEnabled) return;
  if (Notification.isSupported()) {
    new Notification({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 200) }).show();
  }
});

ipcMain.on("open-path", (_event, target: unknown) => {
  if (typeof target === "string") void shell.showItemInFolder(target);
});
