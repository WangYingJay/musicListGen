import { create } from "zustand";

import type { GenerateInput, ImageTask, TaskResponse } from "../types";
import { appendOperationLog } from "../utils/operationLog";

interface TaskState {
  tasks: Record<string, ImageTask>;
  activeTaskIds: string[];
  selectedTaskId: string | null;
  addTaskFromResponse: (task: TaskResponse, input: GenerateInput) => void;
  updateTaskFromResponse: (task: TaskResponse) => void;
  stopLocalTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: {},
  activeTaskIds: [],
  selectedTaskId: null,
  addTaskFromResponse: (task, input) =>
    set((state) => {
      const imageTask = responseToImageTask(task, input);
      appendOperationLog({
        source: "任务",
        message: task.kind === "edits" ? "已提交图像编辑任务" : "已提交生成任务",
        detail: { taskId: task.task_id, model: input.model, size: input.size }
      });
      return {
        tasks: { ...state.tasks, [task.task_id]: imageTask },
        activeTaskIds: state.activeTaskIds.includes(task.task_id)
          ? state.activeTaskIds
          : [task.task_id, ...state.activeTaskIds],
        selectedTaskId: task.task_id
      };
    }),
  updateTaskFromResponse: (task) =>
    set((state) => {
      const current = state.tasks[task.task_id];
      if (!current) {
        return state;
      }
      const didStatusChange = current.status !== task.status;
      const didMessageChange = current.message !== task.message;
      const imageTask = {
        ...current,
        status: task.status,
        progress: task.progress,
        message: task.message,
        error: task.error,
        result: task.result,
        imageUrl: task.result?.data?.[0]?.url,
        started_at: task.started_at,
        completed_at: task.completed_at
      };
      const didProgressChange = current.progress !== task.progress;
      const didErrorChange = current.error !== task.error;
      const didImageChange = current.imageUrl !== imageTask.imageUrl;
      const didStartTimeChange = current.started_at !== task.started_at;
      const didCompleteTimeChange = current.completed_at !== task.completed_at;
      const didResultChange = current.result !== task.result;
      if (didStatusChange || didMessageChange) {
        appendOperationLog({
          source: "任务",
          level: task.status === "failed" ? "error" : task.status === "cancelled" ? "warn" : "info",
          message: `任务 ${task.task_id} 状态更新为 ${task.status}`,
          detail: task.error || task.message
        });
      }
      const isActive = task.status === "pending" || task.status === "running";
      const nextActiveTaskIds = isActive
        ? state.activeTaskIds
        : state.activeTaskIds.filter((taskId) => taskId !== task.task_id);
      if (
        !didStatusChange
        && !didMessageChange
        && !didProgressChange
        && !didErrorChange
        && !didImageChange
        && !didStartTimeChange
        && !didCompleteTimeChange
        && !didResultChange
        && nextActiveTaskIds === state.activeTaskIds
      ) {
        return state;
      }
      return {
        tasks: { ...state.tasks, [task.task_id]: imageTask },
        activeTaskIds: nextActiveTaskIds
      };
    }),
  stopLocalTask: (taskId) =>
    set((state) => {
      const currentTask = state.tasks[taskId];
      if (!currentTask) {
        return state;
      }
      appendOperationLog({
        source: "任务",
        level: "warn",
        message: `已停止任务 ${taskId} 的本地等待`
      });
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...currentTask,
            status: "cancelled",
            message: "已停止本地等待"
          }
        },
        activeTaskIds: state.activeTaskIds.filter((id) => id !== taskId)
      };
    }),
  selectTask: (taskId) => set({ selectedTaskId: taskId })
}));

function responseToImageTask(task: TaskResponse, input: GenerateInput): ImageTask {
  return {
    id: task.id,
    task_id: task.task_id,
    kind: task.kind,
    prompt: input.prompt,
    negativePrompt: input.negative_prompt,
    params: input,
    status: task.status,
    progress: task.progress,
    message: task.message,
    error: task.error,
    result: task.result,
    imageUrl: task.result?.data?.[0]?.url,
    poll_url: task.poll_url,
    created_at: task.created_at,
    started_at: task.started_at,
    completed_at: task.completed_at
  };
}
