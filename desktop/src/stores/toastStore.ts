import { create } from "zustand";

export type ToastTone = "success" | "info" | "warn" | "error";

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastState {
  items: ToastItem[];
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
}

const MAX_TOAST_ITEMS = 5;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  pushToast: (toast) =>
    set((state) => ({
      items: [{ id: createToastId(), ...toast }, ...state.items].slice(0, MAX_TOAST_ITEMS)
    })),
  dismissToast: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id)
    }))
}));

export function showToast(toast: Omit<ToastItem, "id">): void {
  useToastStore.getState().pushToast(toast);
}

function createToastId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
