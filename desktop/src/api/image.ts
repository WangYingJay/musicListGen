import type { GenerateInput, TaskResponse } from "../types";
import { apiClient } from "./client";

function buildRequestHeaders(apiKey?: string, upstreamApiBase?: string) {
  const headers: Record<string, string> = {};
  const trimmed = apiKey?.trim();
  if (trimmed) {
    headers.Authorization = `Bearer ${trimmed}`;
  }
  const trimmedUpstreamApiBase = upstreamApiBase?.trim();
  if (trimmedUpstreamApiBase) {
    headers["X-Upstream-Api-Base"] = trimmedUpstreamApiBase;
  }
  return Object.keys(headers).length ? headers : undefined;
}

export async function createGeneration(input: GenerateInput, apiKey?: string, upstreamApiBase?: string): Promise<TaskResponse> {
  const payload = input.quality === "auto" ? { ...input, quality: undefined } : input;
  const { data } = await apiClient.post<TaskResponse>("/images/generations", payload, {
    headers: buildRequestHeaders(apiKey, upstreamApiBase)
  });
  return data;
}

export async function createEdit(input: GenerateInput, images: File | File[], apiKey?: string, upstreamApiBase?: string): Promise<TaskResponse> {
  const form = new FormData();
  form.set("model", input.model);
  form.set("prompt", input.prompt);
  form.set("size", input.size);
  form.set("n", String(input.n));
  if (input.quality !== "auto") {
    form.set("quality", input.quality);
  }
  if (input.negative_prompt) {
    form.set("negative_prompt", input.negative_prompt);
  }
  if (input.workflow) {
    form.set("workflow", input.workflow);
  }
  if (typeof input.steps === "number") {
    form.set("steps", String(input.steps));
  }
  if (typeof input.cfg_scale === "number") {
    form.set("cfg_scale", String(input.cfg_scale));
  }
  if (typeof input.seed === "number") {
    form.set("seed", String(input.seed));
  }
  const imageList = Array.isArray(images) ? images : [images];
  imageList.forEach((image) => form.append("image", image, image.name));
  const { data } = await apiClient.post<TaskResponse>("/images/edits", form, {
    headers: buildRequestHeaders(apiKey, upstreamApiBase)
  });
  return data;
}
