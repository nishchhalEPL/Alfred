import fs from "node:fs";
import path from "node:path";
import type { AppSnapshot } from "../shared/types";
import { emptySnapshot } from "../shared/defaults";
import { validateSnapshot } from "../shared/validation";

export function storePath(userData: string): string {
  return path.join(userData, "alfred-data.json");
}

export function backupPath(userData: string): string {
  return path.join(userData, "alfred-data.backup.json");
}

export function loadSnapshot(userData: string, osName?: string): AppSnapshot {
  const file = storePath(userData);
  if (!fs.existsSync(file)) {
    const snapshot = emptySnapshot(osName);
    saveSnapshot(userData, snapshot);
    return snapshot;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    const parsed = validateSnapshot(raw);
    if (!parsed.ok) {
      const recovered = emptySnapshot(osName);
      recovered.activity = [
        {
          id: "act_recover",
          at: new Date().toISOString(),
          type: "storage.recovered",
          message: `Storage could not be read cleanly (${parsed.errors.join(" ")}). A fresh file was created; a backup of the previous file was kept.`,
        },
      ];
      try {
        fs.copyFileSync(file, backupPath(userData));
      } catch {
        /* ignore */
      }
      saveSnapshot(userData, recovered);
      return recovered;
    }
    return { ...parsed.snapshot, profileNameFromOs: osName ?? parsed.snapshot.profileNameFromOs };
  } catch {
    const recovered = emptySnapshot(osName);
    recovered.activity = [
      {
        id: "act_recover",
        at: new Date().toISOString(),
        type: "storage.recovered",
        message: "The data file was unreadable. A backup was kept if possible, and Alfred started with an empty store.",
      },
    ];
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, backupPath(userData));
    } catch {
      /* ignore */
    }
    saveSnapshot(userData, recovered);
    return recovered;
  }
}

export function saveSnapshot(userData: string, snapshot: AppSnapshot): void {
  fs.mkdirSync(userData, { recursive: true });
  const file = storePath(userData);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), "utf8");
  fs.renameSync(tmp, file);
}
