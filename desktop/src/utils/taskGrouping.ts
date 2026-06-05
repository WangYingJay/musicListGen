import type { CreationMode, ImageTask } from "../types";

const PLAYLIST_TASK_PREFIX = "任务：根据用户提供的固定歌曲列表生成一张歌单列表图片或分享海报";

export function isPlaylistTask(task?: ImageTask): task is ImageTask {
  return Boolean(task?.prompt.startsWith(PLAYLIST_TASK_PREFIX));
}

export function getTaskCreationMode(task: ImageTask): CreationMode {
  const workflow = readTaskWorkflow(task);
  if (workflow === "playlist") return "text";
  if (workflow === "text-to-image") return "textToImage";
  if (workflow === "image-edit") return "edit";

  // 旧任务没有 workflow 标签：歌单沿用提示词前缀识别，普通 generations 归入文字生图，edits 归入图生图。
  if (isPlaylistTask(task)) return "text";
  return task.kind === "generations" ? "textToImage" : "edit";
}

export function getCreationModeLabel(mode: CreationMode): string {
  if (mode === "text") return "歌单生成";
  if (mode === "textToImage") return "文字生图";
  return "图生图";
}

function readTaskWorkflow(task: ImageTask): string | undefined {
  const params = task.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }
  const workflow = (params as Record<string, unknown>).workflow;
  return typeof workflow === "string" ? workflow : undefined;
}
