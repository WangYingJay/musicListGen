import type { Capabilities, ModelItem } from "../types";
import { apiClient } from "./client";

export async function fetchCapabilities(): Promise<Capabilities> {
  const { data } = await apiClient.get<Capabilities>("/capabilities");
  return data;
}

export async function fetchModels(): Promise<ModelItem[]> {
  const { data } = await apiClient.get<{ data: ModelItem[] }>("/models");
  return data.data;
}
