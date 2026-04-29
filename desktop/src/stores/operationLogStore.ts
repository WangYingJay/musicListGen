import { create } from "zustand";

import type { OperationLogEntry, OperationLogLevel } from "../types";

const LOG_STORAGE_KEY = "music-list-gen-operation-logs-v1";
const MAX_LOG_ENTRIES = 400;

interface OperationLogState {
  entries: OperationLogEntry[];
  appendLog: (entry: { level?: OperationLogLevel; source: string; message: string; detail?: string; createdAt?: string; externalId?: string }) => void;
  clearLogs: () => void;
}

export const useOperationLogStore = create<OperationLogState>((set) => ({
  entries: loadStoredLogs(),
  appendLog: ({ level = "info", source, message, detail, createdAt, externalId }) =>
    set((state) => {
      if (externalId && state.entries.some((entry) => entry.externalId === externalId)) {
        return state;
      }
      const nextEntry: OperationLogEntry = {
        id: externalId || createId(),
        externalId,
        createdAt: createdAt || new Date().toISOString(),
        level,
        source,
        message,
        detail
      };
      const entries = [nextEntry, ...state.entries].slice(0, MAX_LOG_ENTRIES);
      persistLogs(entries);
      return { entries };
    }),
  clearLogs: () => {
    persistLogs([]);
    set({ entries: [] });
  }
}));

function loadStoredLogs(): OperationLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLogs(entries: OperationLogEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 日志写入失败不应阻塞业务动作。
  }
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
