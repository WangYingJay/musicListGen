export type BackendStatus = "starting" | "online" | "offline";

export interface BackendState {
  status: BackendStatus;
  baseUrl: string;
  port: number | null;
  message: string;
}

export type WorkspaceMode = "text" | "edit" | "gallery" | "logs" | "settings";
export type TaskStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";
export type TaskKind = "generations" | "edits";
export type OperationLogLevel = "info" | "warn" | "error";

export interface GenerateInput {
  model: string;
  prompt: string;
  negative_prompt?: string;
  size: string;
  n: number;
  quality: "auto" | "standard" | "high";
  steps?: number;
  cfg_scale?: number;
  seed?: number;
}

export interface ImageTask {
  id: string;
  task_id: string;
  kind: TaskKind;
  prompt: string;
  negativePrompt?: string;
  params: GenerateInput | Record<string, unknown>;
  status: TaskStatus;
  progress: number;
  message: string;
  imageUrl?: string;
  error?: string | null;
  result?: {
    data?: Array<{ url: string }>;
  } | null;
  poll_url?: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TaskResponse {
  id: string;
  task_id: string;
  kind: TaskKind;
  status: TaskStatus;
  progress: number;
  message: string;
  error?: string | null;
  result?: {
    data?: Array<{ url: string }>;
  } | null;
  poll_url: string;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface Capabilities {
  server_key_configured: boolean;
  supports_generations: boolean;
  supports_edits: boolean;
  supports_cancel: boolean;
  supports_progress: boolean;
  supports_moderation: boolean;
  supports_models: boolean;
  default_api_base: string;
}

export interface ModelItem {
  id: string;
  name: string;
  supports_edit: boolean;
  sizes: string[];
}

export interface GalleryItem {
  id: string;
  taskId: string;
  imageUrl: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  size: string;
  seed?: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface OperationLogEntry {
  id: string;
  externalId?: string;
  createdAt: string;
  level: OperationLogLevel;
  source: string;
  message: string;
  detail?: string;
}

export interface BackendLogItem {
  id: number;
  created_at: string;
  level: OperationLogLevel;
  source: string;
  message: string;
  detail?: string | null;
}
