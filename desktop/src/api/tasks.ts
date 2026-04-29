import type { TaskResponse } from "../types";
import { apiClient } from "./client";

interface TaskListResponse {
  data: TaskResponse[];
}

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const { data } = await apiClient.get<TaskResponse>(`/tasks/${taskId}`);
  return data;
}

export async function fetchTasks(limit = 200): Promise<TaskResponse[]> {
  const { data } = await apiClient.get<TaskListResponse>("/tasks", {
    params: { limit }
  });
  return data.data;
}

export async function updateTaskGalleryVisibility(taskId: string, hidden: boolean): Promise<TaskResponse> {
  const { data } = await apiClient.patch<TaskResponse>(`/tasks/${taskId}/gallery`, {
    hidden
  });
  return data;
}
