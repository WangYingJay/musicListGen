import { create } from "zustand";

import { DEFAULT_BACKEND_API_BASE_URL, normalizeBackendApiBaseUrl } from "../api/client";
import type { BackendState, Capabilities, ModelItem } from "../types";

const API_CONFIG_KEY = "music-list-gen-api-config-v1";

type ProxyMode = "none" | "system" | "http" | "socks5";

interface ConfigState {
  backend: BackendState;
  capabilities: Capabilities | null;
  models: ModelItem[];
  apiBaseUrl: string;
  upstreamApiBase: string;
  apiKey: string;
  temporaryApiKey: string;
  useServerKey: boolean;
  proxyMode: ProxyMode;
  connectionMessage: string;
  setBackend: (backend: BackendState) => void;
  setCapabilities: (capabilities: Capabilities) => void;
  setModels: (models: ModelItem[]) => void;
  setApiBaseUrl: (apiBaseUrl: string) => void;
  setUpstreamApiBase: (upstreamApiBase: string) => void;
  setApiKey: (apiKey: string) => void;
  setTemporaryApiKey: (temporaryApiKey: string) => void;
  setUseServerKey: (useServerKey: boolean) => void;
  setProxyMode: (proxyMode: ProxyMode) => void;
  setConnectionMessage: (connectionMessage: string) => void;
}

interface StoredApiConfig {
  apiBaseUrl?: string;
  upstreamApiBase?: string;
  apiKey?: string;
  temporaryApiKey?: string;
  useServerKey?: boolean;
  proxyMode?: ProxyMode;
}

const storedConfig = loadStoredConfig();
const initialApiBaseUrl = resolveStoredApiBaseUrl(storedConfig.apiBaseUrl);

export const useConfigStore = create<ConfigState>((set) => ({
  backend: { status: "offline", baseUrl: "", port: null, message: "后端未连接" },
  capabilities: null,
  models: [],
  apiBaseUrl: initialApiBaseUrl,
  upstreamApiBase: storedConfig.upstreamApiBase || "https://api.openai.com/v1",
  apiKey: storedConfig.apiKey || "",
  temporaryApiKey: storedConfig.temporaryApiKey || "",
  useServerKey: storedConfig.useServerKey ?? true,
  proxyMode: storedConfig.proxyMode || "none",
  connectionMessage: "等待后端状态",
  setBackend: (backend) =>
    set((state) => {
      const shouldSyncLocalBackend = shouldSyncDesktopManagedApiBaseUrl(state.apiBaseUrl);
      const apiBaseUrl = shouldSyncLocalBackend && backend.baseUrl
        ? normalizeBackendApiBaseUrl(backend.baseUrl, DEFAULT_BACKEND_API_BASE_URL)
        : state.apiBaseUrl;
      if (shouldSyncLocalBackend && backend.baseUrl) {
        persistStoredConfig({ apiBaseUrl });
      }
      return {
        backend,
        apiBaseUrl,
        connectionMessage: backend.message
      };
    }),
  setCapabilities: (capabilities) =>
    set((state) => {
      const hasSavedChoice = typeof loadStoredConfig().useServerKey === "boolean";
      const useServerKey = capabilities.server_key_configured
        ? hasSavedChoice
          ? state.useServerKey
          : !state.apiKey
        : false;
      const hasSavedUpstreamApiBase = Boolean(loadStoredConfig().upstreamApiBase);
      const upstreamApiBase = hasSavedUpstreamApiBase ? state.upstreamApiBase : capabilities.default_api_base || state.upstreamApiBase;
      persistStoredConfig({ useServerKey, upstreamApiBase });
      return {
        capabilities,
        upstreamApiBase,
        useServerKey
      };
    }),
  setModels: (models) => set({ models }),
  setApiBaseUrl: (apiBaseUrl) => {
    const normalizedApiBaseUrl = normalizeBackendApiBaseUrl(apiBaseUrl, DEFAULT_BACKEND_API_BASE_URL);
    persistStoredConfig({ apiBaseUrl: normalizedApiBaseUrl });
    set({ apiBaseUrl: normalizedApiBaseUrl });
  },
  setUpstreamApiBase: (upstreamApiBase) => {
    persistStoredConfig({ upstreamApiBase });
    set({ upstreamApiBase });
  },
  setApiKey: (apiKey) => {
    persistStoredConfig({ apiKey });
    set({ apiKey });
  },
  setTemporaryApiKey: (temporaryApiKey) => {
    persistStoredConfig({ temporaryApiKey });
    set({ temporaryApiKey });
  },
  setUseServerKey: (useServerKey) => {
    persistStoredConfig({ useServerKey });
    set({ useServerKey });
  },
  setProxyMode: (proxyMode) => {
    persistStoredConfig({ proxyMode });
    set({ proxyMode });
  },
  setConnectionMessage: (connectionMessage) => set({ connectionMessage })
}));

function loadStoredConfig(): StoredApiConfig {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(API_CONFIG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistStoredConfig(patch: StoredApiConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadStoredConfig();
    window.localStorage.setItem(API_CONFIG_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // 配置写入失败不阻断生成流程；用户仍可在当前会话中继续使用。
  }
}

function resolveStoredApiBaseUrl(apiBaseUrl?: string): string {
  try {
    return normalizeBackendApiBaseUrl(apiBaseUrl || DEFAULT_BACKEND_API_BASE_URL, DEFAULT_BACKEND_API_BASE_URL);
  } catch {
    return DEFAULT_BACKEND_API_BASE_URL;
  }
}

function shouldSyncDesktopManagedApiBaseUrl(apiBaseUrl: string): boolean {
  if (!apiBaseUrl) {
    return true;
  }

  try {
    const parsed = new URL(apiBaseUrl);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    return isLoopbackHost(parsed.hostname) && normalizedPath === "/api";
  } catch {
    return true;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}
