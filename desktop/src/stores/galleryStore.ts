import { create } from "zustand";

import type { GalleryItem, ImageTask } from "../types";
import { appendOperationLog } from "../utils/operationLog";

interface GalleryState {
  items: GalleryItem[];
  query: string;
  columns: 2 | 3 | 4;
  addFromTask: (task: ImageTask) => void;
  removeItem: (id: string) => void;
  setQuery: (query: string) => void;
  setColumns: (columns: 2 | 3 | 4) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  items: [],
  query: "",
  columns: 2,
  addFromTask: (task) =>
    set((state) => {
      if (!task.imageUrl || state.items.some((item) => item.taskId === task.task_id)) {
        return state;
      }
      const params = task.params as Record<string, unknown>;
      const item: GalleryItem = {
        id: task.task_id,
        taskId: task.task_id,
        imageUrl: task.imageUrl,
        prompt: task.prompt,
        negativePrompt: task.negativePrompt,
        model: String(params.model || "gpt-image-2"),
        size: String(params.size || "1024x1024"),
        seed: typeof params.seed === "number" ? params.seed : undefined,
        createdAt: task.completed_at || task.created_at,
        metadata: params
      };
      appendOperationLog({
        source: "画廊",
        message: "新的结果已加入画廊",
        detail: { taskId: task.task_id, model: item.model, size: item.size }
      });
      return { items: [item, ...state.items] };
    }),
  removeItem: (id) =>
    set((state) => {
      appendOperationLog({
        source: "画廊",
        level: "warn",
        message: `已从画廊移除结果 ${id}`
      });
      return { items: state.items.filter((item) => item.id !== id) };
    }),
  setQuery: (query) => set({ query }),
  setColumns: (columns) => set({ columns })
}));
