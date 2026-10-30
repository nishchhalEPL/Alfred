"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var api = {
  getSnapshot: () => import_electron.ipcRenderer.invoke("snapshot:get"),
  apply: (command) => import_electron.ipcRenderer.invoke("command:apply", command),
  exportData: () => import_electron.ipcRenderer.invoke("data:export"),
  importData: () => import_electron.ipcRenderer.invoke("data:import"),
  confirmImport: () => import_electron.ipcRenderer.invoke("data:import-confirm"),
  dataPath: () => import_electron.ipcRenderer.invoke("data:path"),
  notify: (title, body) => import_electron.ipcRenderer.invoke("notify", { title, body })
};
import_electron.contextBridge.exposeInMainWorld("alfred", api);
