import axios from "axios";

export const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8765";
export const DEFAULT_BACKEND_API_BASE_URL = `${DEFAULT_BACKEND_ORIGIN}/api`;

export class InvalidBackendApiBaseUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBackendApiBaseUrlError";
  }
}

export const apiClient = axios.create({
  baseURL: DEFAULT_BACKEND_API_BASE_URL,
  timeout: 20_000
});

export function setBackendBaseUrl(baseUrl: string): void {
  apiClient.defaults.baseURL = normalizeBackendApiBaseUrl(baseUrl, DEFAULT_BACKEND_API_BASE_URL);
}

export function setApiBaseUrl(baseUrl: string): void {
  apiClient.defaults.baseURL = normalizeBackendApiBaseUrl(baseUrl, DEFAULT_BACKEND_API_BASE_URL);
}

export function getBackendOrigin(): string {
  const baseURL = String(apiClient.defaults.baseURL || DEFAULT_BACKEND_API_BASE_URL);
  const parsed = new URL(baseURL);
  parsed.pathname = parsed.pathname.replace(/\/api(?:\/.*)?$/, "") || "/";
  return parsed.toString().replace(/\/$/, "");
}

export function normalizeBackendApiBaseUrl(baseUrl: string, fallback = DEFAULT_BACKEND_API_BASE_URL): string {
  const rawValue = baseUrl.trim() || fallback;
  let parsed: URL;
  try {
    parsed = new URL(rawValue);
  } catch {
    throw new InvalidBackendApiBaseUrlError("本地后端地址格式不正确，请填写类似 http://127.0.0.1:8765 的地址。");
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "") || "/";
  if (isLikelyUpstreamApiPath(cleanPath)) {
    throw new InvalidBackendApiBaseUrlError("这里需要填写本地后端地址，不能直接填写上游 OpenAI 兼容接口的 /v1 地址。");
  }

  // 前端只应访问本地任务后端，统一规范到 /api，避免误打到上游图片接口。
  parsed.pathname = cleanPath === "/" ? "/api" : hasApiPrefix(cleanPath) ? cleanPath : `${cleanPath}/api`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function isLikelyUpstreamApiPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return (
    normalized === "/v1"
    || normalized.startsWith("/v1/")
    || normalized === "/images"
    || normalized.startsWith("/images/")
    || normalized === "/responses"
    || normalized.startsWith("/responses/")
    || normalized === "/chat"
    || normalized.startsWith("/chat/")
    || normalized === "/audio"
    || normalized.startsWith("/audio/")
    || normalized === "/embeddings"
    || normalized.startsWith("/embeddings/")
    || normalized === "/models"
    || normalized.startsWith("/models/")
  );
}

function hasApiPrefix(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
