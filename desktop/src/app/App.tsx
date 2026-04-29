import { Download, ImageIcon, UploadCloud } from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";

import { setApiBaseUrl as applyApiBaseUrl } from "../api/client";
import { fetchCapabilities, fetchModels } from "../api/capabilities";
import { createEdit, createGeneration } from "../api/image";
import { GallerySidebar } from "../components/gallery/GallerySidebar";
import { StatusBar } from "../components/layout/StatusBar";
import { TopBar } from "../components/layout/TopBar";
import { OperationLogCenter } from "../components/logs/OperationLogCenter";
import { PlaylistWorkflow } from "../components/playlist/PlaylistWorkflow";
import { PromptPanel } from "../components/prompt/PromptPanel";
import { ApiConfigPanel } from "../components/settings/ApiConfigPanel";
import { useBackendLogs } from "../hooks/useBackendLogs";
import { useTaskPolling } from "../hooks/useTaskPolling";
import { useConfigStore } from "../stores/configStore";
import { useGalleryStore } from "../stores/galleryStore";
import { useTaskStore } from "../stores/taskStore";
import type { GenerateInput, ImageTask, WorkspaceMode } from "../types";
import { appendOperationLog } from "../utils/operationLog";

const defaultParams: GenerateInput = {
  model: "gpt-image-2",
  prompt: "",
  size: "1024x1024",
  n: 1,
  quality: "auto",
  steps: 20,
  cfg_scale: 7
};

export function App() {
  const [mode, setMode] = useState<WorkspaceMode>("text");
  const [prompt, setPrompt] = useState("夜晚城市里的独立音乐歌单封面，蓝绿色霓虹反射在雨水路面，电影感构图");
  const [negativePrompt, setNegativePrompt] = useState("低清晰度，变形文字，杂乱边框");
  const [params, setParams] = useState<GenerateInput>(defaultParams);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const backend = useConfigStore((state) => state.backend);
  const apiBaseUrl = useConfigStore((state) => state.apiBaseUrl);
  const upstreamApiBase = useConfigStore((state) => state.upstreamApiBase);
  const apiKey = useConfigStore((state) => state.apiKey);
  const temporaryApiKey = useConfigStore((state) => state.temporaryApiKey);
  const useServerKey = useConfigStore((state) => state.useServerKey);
  const capabilities = useConfigStore((state) => state.capabilities);
  const models = useConfigStore((state) => state.models);
  const setBackend = useConfigStore((state) => state.setBackend);
  const setCapabilities = useConfigStore((state) => state.setCapabilities);
  const setModels = useConfigStore((state) => state.setModels);
  const setConnectionMessage = useConfigStore((state) => state.setConnectionMessage);

  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskIds = useTaskStore((state) => state.activeTaskIds);
  const addTaskFromResponse = useTaskStore((state) => state.addTaskFromResponse);
  const galleryItems = useGalleryStore((state) => state.items);
  const previousModeRef = useRef<WorkspaceMode | null>(null);
  const effectiveApiKey = useMemo(() => {
    const overrideKey = temporaryApiKey.trim();
    if (overrideKey) {
      return overrideKey;
    }
    const trimmed = apiKey.trim();
    const canUseServerKey = Boolean(capabilities?.server_key_configured);
    return canUseServerKey && useServerKey || !trimmed ? undefined : trimmed;
  }, [apiKey, capabilities?.server_key_configured, temporaryApiKey, useServerKey]);

  useTaskPolling();
  useBackendLogs();

  useEffect(() => {
    if (apiBaseUrl) {
      applyApiBaseUrl(apiBaseUrl);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (previousModeRef.current === null) {
      previousModeRef.current = mode;
      return;
    }
    if (previousModeRef.current !== mode) {
      appendOperationLog({
        source: "导航",
        message: `切换到${renderModeLabel(mode)}`
      });
      previousModeRef.current = mode;
    }
  }, [mode]);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    async function bootstrapDesktop() {
      if (!window.desktopApi) {
        const fallbackBackend = { status: "starting" as const, baseUrl: "http://127.0.0.1:8765", port: 8765, message: "正在连接轻量桌面后端" };
        setBackend(fallbackBackend);
        applyApiBaseUrl(useConfigStore.getState().apiBaseUrl);
        const loaded = await loadBackendMetadata();
        setBackend({
          ...fallbackBackend,
          status: loaded ? "online" : "offline",
          message: loaded ? "轻量桌面后端在线" : "轻量桌面后端不可用"
        });
        return;
      }

      const state = await window.desktopApi.getBackendState();
      setBackend(state);
      if (state.baseUrl) {
        applyApiBaseUrl(useConfigStore.getState().apiBaseUrl);
        await loadBackendMetadata();
      }

      dispose = window.desktopApi.onBackendStateChanged((nextState) => {
        setBackend(nextState);
        if (nextState.baseUrl) {
          applyApiBaseUrl(useConfigStore.getState().apiBaseUrl);
          void loadBackendMetadata();
        }
      });
    }

    void bootstrapDesktop();
    return () => dispose?.();
  }, [setBackend, setCapabilities, setConnectionMessage, setModels]);

  async function loadBackendMetadata() {
    try {
      const [capabilities, modelList] = await Promise.all([fetchCapabilities(), fetchModels()]);
      setCapabilities(capabilities);
      setModels(modelList);
      return true;
    } catch {
      setConnectionMessage("后端元信息读取失败");
      return false;
    }
  }

  const recentResult = useMemo(() => {
    return Object.values(tasks)
      .filter((task) => task.status === "succeeded" && task.imageUrl)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  }, [tasks]);
  const stageCoverUrl = recentResult?.imageUrl ? new URL(recentResult.imageUrl, backend.baseUrl || "http://127.0.0.1:8765").toString() : "";
  const stageStyle = stageCoverUrl ? ({ ["--stage-cover" as string]: `url("${stageCoverUrl}")` } as CSSProperties) : undefined;

  async function submitGeneration() {
    setIsSubmitting(true);
    try {
      const input = { ...params, prompt, negative_prompt: negativePrompt || undefined };
      const response = await createGeneration(input, effectiveApiKey, upstreamApiBase);
      addTaskFromResponse(response, input);
      appendOperationLog({
        source: "修图",
        message: "已提交普通生成任务",
        detail: { model: input.model, size: input.size }
      });
      setMode("text");
    } catch (error) {
      appendOperationLog({
        source: "修图",
        level: "error",
        message: "普通生成任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitEdit() {
    if (!referenceFile) {
      return;
    }
    setIsSubmitting(true);
    try {
      const input = { ...params, prompt, negative_prompt: negativePrompt || undefined };
      const response = await createEdit(input, referenceFile, effectiveApiKey, upstreamApiBase);
      addTaskFromResponse(response, input);
      appendOperationLog({
        source: "修图",
        message: "已提交参考图重绘任务",
        detail: { model: input.model, size: input.size, fileName: referenceFile.name }
      });
    } catch (error) {
      appendOperationLog({
        source: "修图",
        level: "error",
        message: "参考图重绘任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function restartBackend() {
    if (!window.desktopApi) {
      await loadBackendMetadata();
      return;
    }
    const state = await window.desktopApi?.restartBackend();
    if (state?.baseUrl) {
      setBackend(state);
      applyApiBaseUrl(useConfigStore.getState().apiBaseUrl);
      await loadBackendMetadata();
    }
  }

  return (
    <div className={`app-shell mode-${mode}`}>
      <TopBar mode={mode} onModeChange={setMode} galleryCount={galleryItems.length} queueCount={activeTaskIds.length} backendStatus={backend.status} />
      <main className="app-grid">
        <GallerySidebar />

        <section className="center-stage" style={stageStyle}>
          {mode === "text" && (
            <PlaylistWorkflow params={params} onParamsChange={setParams} />
          )}

          {mode === "edit" && (
            <EditWorkspace
              prompt={prompt}
              negativePrompt={negativePrompt}
              referenceFile={referenceFile}
              isSubmitting={isSubmitting}
              onPromptChange={setPrompt}
              onNegativePromptChange={setNegativePrompt}
              onReferenceChange={(file) => {
                setReferenceFile(file);
                appendOperationLog({
                  source: "图生图",
                  message: file ? "已选择参考图" : "已清空参考图",
                  detail: file?.name
                });
              }}
              onSubmit={submitEdit}
            />
          )}

          {mode === "gallery" && <GalleryOverview />}
          {mode === "logs" && <OperationLogCenter />}
          {mode === "settings" && <ApiConfigPanel models={models} params={params} onParamsChange={setParams} onRestartBackend={restartBackend} />}
        </section>
      </main>
      <StatusBar
        backend={backend}
        taskCount={galleryItems.length}
        queueCount={activeTaskIds.length}
        useServerKey={Boolean(capabilities?.server_key_configured) && useServerKey}
        hasLocalKey={Boolean(apiKey.trim())}
      />
    </div>
  );
}

function renderModeLabel(mode: WorkspaceMode): string {
  if (mode === "text") return "歌单生成";
  if (mode === "edit") return "图生图";
  if (mode === "gallery") return "画廊";
  if (mode === "logs") return "日志";
  return "设置";
}

function ResultPreview({ task }: { task?: ImageTask }) {
  if (!task?.imageUrl) {
    return (
      <section className="result-preview empty-preview">
        <ImageIcon size={42} />
        <p>结果预览</p>
      </section>
    );
  }

  const imageUrl = task.imageUrl;

  return (
    <section className="result-preview">
      <img src={new URL(imageUrl, useConfigStore.getState().backend.baseUrl || "http://127.0.0.1:8765").toString()} alt={task.prompt} />
      <div className="result-toolbar">
        <strong>{task.prompt}</strong>
        <button type="button" onClick={() => void saveImage(imageUrl, `${task.task_id}.png`)}>
          <Download size={14} />
          保存
        </button>
      </div>
    </section>
  );
}

async function saveImage(url: string, defaultName: string) {
  if (window.desktopApi) {
    await window.desktopApi.saveImage({ url, defaultName });
    return;
  }

  const backendBase = useConfigStore.getState().backend.baseUrl || "http://127.0.0.1:8765";
  const response = await fetch(new URL(url, backendBase).toString());
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = defaultName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

interface EditWorkspaceProps {
  prompt: string;
  negativePrompt: string;
  referenceFile: File | null;
  isSubmitting: boolean;
  onPromptChange: (value: string) => void;
  onNegativePromptChange: (value: string) => void;
  onReferenceChange: (file: File | null) => void;
  onSubmit: () => void;
}

function EditWorkspace({
  prompt,
  negativePrompt,
  referenceFile,
  isSubmitting,
  onPromptChange,
  onNegativePromptChange,
  onReferenceChange,
  onSubmit
}: EditWorkspaceProps) {
  return (
    <section className="workspace-section edit-workspace">
      <div className="section-header">
        <div>
          <p className="eyebrow">Image Edit</p>
          <h1>参考图重绘</h1>
        </div>
      </div>

      <label className="drop-zone">
        <input
          type="file"
          accept="image/*"
          onChange={(event) => onReferenceChange(event.target.files?.[0] ?? null)}
        />
        <UploadCloud size={28} />
        <span>{referenceFile ? referenceFile.name : "拖入或选择参考图"}</span>
      </label>

      <PromptPanel
        prompt={prompt}
        negativePrompt={negativePrompt}
        isSubmitting={isSubmitting}
        onPromptChange={onPromptChange}
        onNegativePromptChange={onNegativePromptChange}
        onGenerate={onSubmit}
      />
    </section>
  );
}

function GalleryOverview() {
  const items = useGalleryStore((state) => state.items);
  const backendBase = useConfigStore((state) => state.backend.baseUrl || "http://127.0.0.1:8765");

  return (
    <section className="overview-grid">
      {items.map((item) => (
        <article key={item.id} className="overview-tile">
          <img src={new URL(item.imageUrl, backendBase).toString()} alt={item.prompt} />
          <div>
            <strong>{item.model}</strong>
            <span>{item.size}</span>
          </div>
        </article>
      ))}
      {items.length === 0 && <p className="empty-state">暂无画廊记录</p>}
    </section>
  );
}

function TaskCenter() {
  const tasks = Object.values(useTaskStore((state) => state.tasks)).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <section className="task-center">
      <div className="section-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>任务明细</h1>
        </div>
      </div>
      {tasks.map((task) => (
        <article className="task-detail-row" key={task.task_id}>
          <div>
            <strong>{task.prompt}</strong>
            <span>{task.task_id}</span>
          </div>
          <span className={`status-pill ${task.status}`}>{task.status}</span>
          <span>{task.progress}%</span>
          <p>{task.error || task.message}</p>
        </article>
      ))}
      {tasks.length === 0 && <p className="empty-state">暂无任务</p>}
    </section>
  );
}
