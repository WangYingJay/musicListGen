import type { TaskResponse } from "../types";
import { apiClient } from "./client";

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  const { data } = await apiClient.get<TaskResponse>(`/tasks/${taskId}`);
  return data;
}
