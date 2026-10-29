import { contextBridge, ipcRenderer } from "electron";
import type { AppCommand, AppSnapshot } from "../shared/types";

export interface AlfredApi {
  getSnapshot: () => Promise<AppSnapshot>;
  apply: (command: AppCommand) => Promise<{ snapshot: AppSnapshot; error?: string }>;
  exportData: () => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>;
  importData: () => Promise<{ ok: boolean; error?: string; needsConfirm?: boolean; previewCount?: number }>;
  confirmImport: () => Promise<{ ok: boolean; snapshot?: AppSnapshot; error?: string }>;
  dataPath: () => Promise<string>;
  notify: (title: string, body: string) => Promise<void>;
}

const api: AlfredApi = {
  getSnapshot: () => ipcRenderer.invoke("snapshot:get"),
  apply: (command) => ipcRenderer.invoke("command:apply", command),
  exportData: () => ipcRenderer.invoke("data:export"),
  importData: () => ipcRenderer.invoke("data:import"),
  confirmImport: () => ipcRenderer.invoke("data:import-confirm"),
  dataPath: () => ipcRenderer.invoke("data:path"),
  notify: (title, body) => ipcRenderer.invoke("notify", { title, body }),
};

contextBridge.exposeInMainWorld("alfred", api);
