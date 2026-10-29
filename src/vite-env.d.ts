/// <reference types="vite/client" />

import type { AppCommand, AppSnapshot } from "@shared/types";

declare global {
  interface Window {
    alfred: {
      getSnapshot: () => Promise<AppSnapshot>;
      apply: (command: AppCommand) => Promise<{ snapshot: AppSnapshot; error?: string }>;
      exportData: () => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>;
      importData: () => Promise<{
        ok: boolean;
        error?: string;
        needsConfirm?: boolean;
        previewCount?: number;
        canceled?: boolean;
      }>;
      confirmImport: () => Promise<{ ok: boolean; snapshot?: AppSnapshot; error?: string }>;
      dataPath: () => Promise<string>;
      notify: (title: string, body: string) => Promise<void>;
    };
  }
}

export {};
