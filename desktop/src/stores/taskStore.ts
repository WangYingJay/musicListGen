import { create } from "zustand";

import type { GenerateInput, ImageTask, TaskResponse } from "../types";
import { appendOperationLog } from "../utils/operationLog";

interface TaskState {
  tasks: Record<string, ImageTask>;
  activeTaskIds: string[];
  selectedTaskId: string | null;
  hydrateTasks: (tasks: TaskResponse[]) => void;
  addTaskFromResponse: (task: TaskResponse, input: GenerateInput) => void;
  updateTaskFromResponse: (task: TaskResponse) => void;
  stopLocalTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: {},
  activeTaskIds: [],
  selectedTaskId: null,
  hydrateTasks: (tasks) =>
    set((state) => {
      const nextTasks = tasks.reduce<Record<string, ImageTask>>((accumulator, task) => {
        accumulator[task.task_id] = responseToImageTask(task);
        return accumulator;
      }, {});

      return {
        tasks: nextTasks,
        activeTaskIds: Object.values(nextTasks)
          .filter((task) => task.status === "pending" || task.status === "running")
          .map((task) => task.task_id),
        selectedTaskId: state.selectedTaskId && nextTasks[state.selectedTaskId] ? state.selectedTaskId : null
      };
    }),
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
        const imageTask = responseToImageTask(task);
        return {
          tasks: { ...state.tasks, [task.task_id]: imageTask },
          activeTaskIds: syncActiveTaskIds(state.activeTaskIds, task.task_id, task.status)
        };
      }
      const didStatusChange = current.status !== task.status;
      const didMessageChange = current.message !== task.message;
      const imageTask = {
        ...current,
        galleryHidden: Boolean(task.gallery_hidden),
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
      const nextActiveTaskIds = syncActiveTaskIds(state.activeTaskIds, task.task_id, task.status);
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

function responseToImageTask(task: TaskResponse, input?: GenerateInput): ImageTask {
  const fallbackInput: GenerateInput = input || {
    model: "gpt-image-2",
    prompt: "",
    size: "1024x1024",
    n: 1,
    quality: "auto"
  };
  return buildImageTask(task, fallbackInput);
}

function buildImageTask(task: TaskResponse, input: GenerateInput): ImageTask {
  const request = toRecord(task.request);
  const prompt = readString(request?.prompt) || input.prompt;
  const negativePrompt = readString(request?.negative_prompt) || input.negative_prompt;
  const model = readString(request?.model) || input.model;
  const size = readString(request?.size) || input.size;
  const n = readNumber(request?.n) ?? input.n;
  const quality = readQuality(request?.quality) || input.quality;
  const steps = readNumber(request?.steps) ?? input.steps;
  const cfgScale = readNumber(request?.cfg_scale) ?? input.cfg_scale;
  const seed = readNumber(request?.seed) ?? input.seed;

  return {
    id: task.id,
    task_id: task.task_id,
    kind: task.kind,
    prompt,
    negativePrompt,
    galleryHidden: Boolean(task.gallery_hidden),
    params: {
      ...(request || {}),
      model,
      prompt,
      negative_prompt: negativePrompt,
      size,
      n,
      quality,
      ...(typeof steps === "number" ? { steps } : {}),
      ...(typeof cfgScale === "number" ? { cfg_scale: cfgScale } : {}),
      ...(typeof seed === "number" ? { seed } : {})
    },
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

function syncActiveTaskIds(activeTaskIds: string[], taskId: string, status: TaskResponse["status"]): string[] {
  const isActive = status === "pending" || status === "running";
  if (isActive) {
    return activeTaskIds.includes(taskId) ? activeTaskIds : [taskId, ...activeTaskIds];
  }
  return activeTaskIds.filter((currentTaskId) => currentTaskId !== taskId);
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readQuality(value: unknown): GenerateInput["quality"] | undefined {
  return value === "auto" || value === "standard" || value === "high" ? value : undefined;
}
