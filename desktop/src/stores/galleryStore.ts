import { create } from "zustand";

import type { GalleryItem, ImageTask } from "../types";
import { appendOperationLog } from "../utils/operationLog";

interface GalleryState {
  items: GalleryItem[];
  query: string;
  columns: 2 | 3 | 4;
  hydrateFromTasks: (tasks: ImageTask[]) => void;
  addFromTask: (task: ImageTask) => void;
  removeItem: (id: string) => void;
  setQuery: (query: string) => void;
  setColumns: (columns: 2 | 3 | 4) => void;
}

export const useGalleryStore = create<GalleryState>((set) => ({
  items: [],
  query: "",
  columns: 2,
  hydrateFromTasks: (tasks) =>
    set(() => ({
      items: tasks
        .map(createGalleryItem)
        .filter((item): item is GalleryItem => Boolean(item))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    })),
  addFromTask: (task) =>
    set((state) => {
      const item = createGalleryItem(task);
      if (!item || state.items.some((existingItem) => existingItem.taskId === task.task_id)) {
        return state;
      }
      appendOperationLog({
        source: "画廊",
        message: "新的结果已加入画廊",
        detail: { taskId: task.task_id, model: item.model, size: item.size }
      });
      return { items: [item, ...state.items] };
    }),
  removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  setQuery: (query) => set({ query }),
  setColumns: (columns) => set({ columns })
}));

function createGalleryItem(task: ImageTask): GalleryItem | null {
  if (task.galleryHidden || task.status !== "succeeded" || !task.imageUrl) {
    return null;
  }

  const params = task.params as Record<string, unknown>;
  return {
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
}
