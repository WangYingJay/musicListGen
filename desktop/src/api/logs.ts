import type { BackendLogItem } from "../types";
import { apiClient } from "./client";

export async function fetchBackendLogs(afterId = 0, limit = 100): Promise<BackendLogItem[]> {
  const { data } = await apiClient.get<{ data: BackendLogItem[] }>("/logs", {
    params: { after_id: afterId, limit }
  });
  return data.data;
}
