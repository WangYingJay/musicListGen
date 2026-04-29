import { getBackendOrigin } from "../api/client";
import type { SaveImageResult } from "../types";

export async function saveImageWithSystemDialog(imageUrl: string, defaultName: string): Promise<SaveImageResult> {
  if (window.desktopApi) {
    return window.desktopApi.saveImage({ url: imageUrl, defaultName });
  }

  const response = await fetch(new URL(imageUrl, getBackendOrigin()).toString());
  if (!response.ok) {
    throw new Error(`下载图片失败：${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = defaultName;
  link.click();
  URL.revokeObjectURL(objectUrl);
  return { saved: true };
}
