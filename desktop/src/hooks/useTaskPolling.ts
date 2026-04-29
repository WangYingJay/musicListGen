import { useEffect } from "react";

import { fetchTask } from "../api/tasks";
import { useGalleryStore } from "../stores/galleryStore";
import { useTaskStore } from "../stores/taskStore";

export function useTaskPolling(): void {
  const activeTaskIds = useTaskStore((state) => state.activeTaskIds);
  const tasks = useTaskStore((state) => state.tasks);
  const updateTaskFromResponse = useTaskStore((state) => state.updateTaskFromResponse);
  const addFromTask = useGalleryStore((state) => state.addFromTask);

  useEffect(() => {
    if (activeTaskIds.length === 0) {
      return undefined;
    }

    let cancelled = false;

    async function tick() {
      await Promise.all(
        activeTaskIds.map(async (taskId) => {
          try {
            const response = await fetchTask(taskId);
            if (cancelled) {
              return;
            }
            updateTaskFromResponse(response);
          } catch {
            // 轮询失败不立刻判定任务失败，避免后端重启或网络抖动导致任务被误关停。
          }
        })
      );

      Object.values(tasks).forEach((task) => {
        if (task.status === "succeeded" && task.imageUrl) {
          addFromTask(task);
        }
      });
    }

    void tick();
    const interval = window.setInterval(tick, document.hidden ? 5_000 : 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeTaskIds, addFromTask, tasks, updateTaskFromResponse]);
}
