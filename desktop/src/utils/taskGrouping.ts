import type { CreationMode, ImageTask } from "../types";

const PLAYLIST_TASK_PREFIX = "任务：根据用户提供的固定歌曲列表生成一张歌单列表图片或分享海报";

export function isPlaylistTask(task?: ImageTask): task is ImageTask {
  return Boolean(task?.prompt.startsWith(PLAYLIST_TASK_PREFIX));
}

export function getTaskCreationMode(task: ImageTask): CreationMode {
  return isPlaylistTask(task) ? "text" : "edit";
}

export function getCreationModeLabel(mode: CreationMode): string {
  return mode === "text" ? "歌单生成" : "图生图";
}
