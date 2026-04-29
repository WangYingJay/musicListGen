/// <reference types="vite/client" />

import type { BackendState } from "./types";
import type { SaveImageResult } from "./types";

declare global {
  interface Window {
    desktopApi?: {
      getBackendState: () => Promise<BackendState>;
      restartBackend: () => Promise<BackendState>;
      saveImage: (input: { url: string; defaultName?: string }) => Promise<SaveImageResult>;
      onBackendStateChanged: (callback: (state: BackendState) => void) => () => void;
    };
  }
}
