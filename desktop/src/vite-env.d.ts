/// <reference types="vite/client" />

import type { BackendState } from "./types";

declare global {
  interface Window {
    desktopApi?: {
      getBackendState: () => Promise<BackendState>;
      restartBackend: () => Promise<BackendState>;
      saveImage: (input: { url: string; defaultName?: string }) => Promise<{ saved: boolean; path?: string }>;
      onBackendStateChanged: (callback: (state: BackendState) => void) => () => void;
    };
  }
}
