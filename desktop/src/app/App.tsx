import { Activity, Copy, Download, ImageIcon, RefreshCw, Server, UploadCloud } from "lucide-react";
import { type CSSProperties, type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { setApiBaseUrl as applyApiBaseUrl } from "../api/client";
import { fetchCapabilities, fetchModels } from "../api/capabilities";
import { createEdit } from "../api/image";
import { fetchTasks } from "../api/tasks";
import { ChatPlaylistWorkspace } from "../components/chat/ChatPlaylistWorkspace";
import { ChatSidebar } from "../components/chat/ChatSidebar";
import { ToastViewport } from "../components/common/ToastViewport";
import { OperationLogCenter } from "../components/logs/OperationLogCenter";
import { PromptPanel } from "../components/prompt/PromptPanel";
import { ApiConfigPanel } from "../components/settings/ApiConfigPanel";
import { useBackendLogs } from "../hooks/useBackendLogs";
import { useTaskPolling } from "../hooks/useTaskPolling";
import { useConfigStore } from "../stores/configStore";
import { useGalleryStore } from "../stores/galleryStore";
import { useTaskStore } from "../stores/taskStore";
import { showToast } from "../stores/toastStore";
import type { Capabilities, CreationMode, GenerateInput, ImageTask, SettingsSection, SidebarView, WorkspaceMode } from "../types";
import { saveImageWithSystemDialog } from "../utils/imageSaver";
import { appendOperationLog } from "../utils/operationLog";
import { getCreationModeLabel, getTaskCreationMode } from "../utils/taskGrouping";

const defaultParams: GenerateInput = {
  model: "gpt-image-2",
  prompt: "",
  size: "1024x1024",
  n: 1,
  quality: "auto",
  steps: 20,
  cfg_scale: 7
};

type MainView = "workspace" | SidebarView;

export function App() {
  const [mode, setMode] = useState<WorkspaceMode>("text");
  const [activeView, setActiveView] = useState<MainView>("workspace");
  const [workspaceResetSignal, setWorkspaceResetSignal] = useState(0);
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
  const hydrateTasks = useTaskStore((state) => state.hydrateTasks);
  const addTaskFromResponse = useTaskStore((state) => state.addTaskFromResponse);
  const hydrateGalleryFromTasks = useGalleryStore((state) => state.hydrateFromTasks);
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
  }, [hydrateGalleryFromTasks, hydrateTasks, setBackend, setCapabilities, setConnectionMessage, setModels]);

  async function loadBackendMetadata() {
    try {
      const [capabilities, modelList, persistedTasks] = await Promise.all([fetchCapabilities(), fetchModels(), fetchTasks()]);
      setCapabilities(capabilities);
      setModels(modelList);
      hydrateTasks(persistedTasks);
      hydrateGalleryFromTasks(Object.values(useTaskStore.getState().tasks));
      return true;
    } catch {
      setConnectionMessage("后端元信息读取失败");
      return false;
    }
  }

  const recentResult = useMemo(() => {
    return Object.values(tasks)
      .filter((task) => task.status === "succeeded" && task.imageUrl && getTaskCreationMode(task) === mode)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  }, [mode, tasks]);
  const stageCoverUrl = recentResult?.imageUrl ? new URL(recentResult.imageUrl, backend.baseUrl || "http://127.0.0.1:8765").toString() : "";
  const stageStyle = stageCoverUrl ? ({ ["--stage-cover" as string]: `url("${stageCoverUrl}")` } as CSSProperties) : undefined;

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
      showToast({
        tone: "success",
        title: "重绘任务已提交",
        description: `${input.model} · ${input.size}`
      });
    } catch (error) {
      appendOperationLog({
        source: "修图",
        level: "error",
        message: "参考图重绘任务提交失败",
        detail: error instanceof Error ? error.message : String(error)
      });
      showToast({
        tone: "error",
        title: "参考图重绘任务提交失败",
        description: error instanceof Error ? error.message : String(error)
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
    <div className={`app-shell workspace-shell mode-${mode}`}>
      <main className="workspace-layout">
        <ChatSidebar
          creationMode={mode}
          activeView={activeView}
          onCreationModeChange={(nextMode) => {
            setMode(nextMode);
            // 模式切换后优先回到首页创作台，避免用户误停留在上一模式的历史详情里。
            setActiveView("workspace");
          }}
          onViewChange={(view) => setActiveView(view)}
          onNewSession={() => setWorkspaceResetSignal((value) => value + 1)}
        />

        <section className="workspace-main" style={stageStyle}>
          {activeView === "workspace" && mode === "text" && (
            <ChatPlaylistWorkspace params={params} onParamsChange={setParams} resetSignal={workspaceResetSignal} />
          )}

          {activeView === "workspace" && mode === "edit" && (
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

          {activeView === "gallery" && <GalleryOverview creationMode={mode} />}
          {activeView === "status" && <TaskStatusBoard creationMode={mode} />}
          {activeView === "backend" && (
            <BackendStatusPanel
              backend={backend}
              capabilities={capabilities}
              mode={mode}
              queueCount={activeTaskIds.length}
              galleryCount={galleryItems.length}
              useServerKey={Boolean(capabilities?.server_key_configured) && useServerKey}
              hasLocalKey={Boolean(apiKey.trim())}
              onRestartBackend={restartBackend}
            />
          )}
          {activeView === "logs" && <OperationLogCenter />}
          {isSettingsView(activeView) && (
            <ApiConfigPanel
              models={models}
              params={params}
              onParamsChange={setParams}
              onRestartBackend={restartBackend}
              initialSection={activeView}
            />
          )}
        </section>
      </main>
      <ToastViewport />
    </div>
  );
}

function renderModeLabel(mode: WorkspaceMode): string {
  if (mode === "text") return "歌单生成";
  return "图生图";
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
  try {
    const result = await saveImageWithSystemDialog(url, defaultName);
    if (result.saved) {
      showToast({
        tone: "success",
        title: "图片已保存",
        description: result.path || defaultName
      });
      return;
    }

    if (result.cancelled) {
      showToast({
        tone: "info",
        title: "已取消保存图片"
      });
    }
  } catch (error) {
    showToast({
      tone: "error",
      title: "保存图片失败",
      description: error instanceof Error ? error.message : String(error)
    });
  }
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
  const [referencePreviewUrl, setReferencePreviewUrl] = useState("");

  useEffect(() => {
    if (!referenceFile) {
      setReferencePreviewUrl("");
      return undefined;
    }
    const previewUrl = URL.createObjectURL(referenceFile);
    setReferencePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [referenceFile]);

  function handleReferenceChange(event: ChangeEvent<HTMLInputElement>) {
    onReferenceChange(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  return (
    <section className="view-shell edit-workspace-shell">
      <header className="view-header">
        <div>
          <p className="eyebrow">Image Edit</p>
          <h1>参考图重绘</h1>
          <span>上传一张参考图，再用简短描述告诉系统你想保留什么、改变什么。</span>
        </div>
      </header>

      <div className="view-grid two-columns">
        <section className="surface-card">
          <div className="surface-card-head">
            <div>
              <h2>参考图</h2>
              <p>建议先放主视觉，再在下方补充你想优化的方向。</p>
            </div>
          </div>

          <label className={referencePreviewUrl ? "drop-zone has-preview" : "drop-zone"}>
            <input type="file" accept="image/*" onChange={handleReferenceChange} />
            {referencePreviewUrl ? (
              <>
                <img className="drop-zone-preview-image" src={referencePreviewUrl} alt="参考图预览" />
                <div className="drop-zone-preview-badge">
                  <span>参考图预览</span>
                  <strong>点击重新选择</strong>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={28} />
                <span>拖入或选择参考图</span>
              </>
            )}
          </label>
        </section>

        <PromptPanel
          prompt={prompt}
          negativePrompt={negativePrompt}
          isSubmitting={isSubmitting}
          onPromptChange={onPromptChange}
          onNegativePromptChange={onNegativePromptChange}
          onGenerate={onSubmit}
        />
      </div>
    </section>
  );
}

function GalleryOverview({ creationMode }: { creationMode: CreationMode }) {
  const items = useGalleryStore((state) => state.items);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const tasksById = useTaskStore((state) => state.tasks);
  const backendBase = useConfigStore((state) => state.backend.baseUrl || "http://127.0.0.1:8765");
  // 画廊页需要和左侧筛选一致，避免歌单和图生图的历史结果混在一起。
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const task = tasksById[item.taskId];
        return task ? getTaskCreationMode(task) === creationMode : false;
      }),
    [creationMode, items, tasksById]
  );
  const selectedItem = filteredItems.find((item) => item.taskId === selectedTaskId) || filteredItems[0];
  const selectedTask = selectedItem ? tasksById[selectedItem.taskId] : undefined;
  const previewUrl = selectedItem ? new URL(selectedItem.imageUrl, backendBase).toString() : "";

  async function copyPrompt() {
    if (!selectedItem?.prompt) {
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedItem.prompt);
      appendOperationLog({ source: "画廊", message: "已复制画廊提示词" });
      showToast({
        tone: "success",
        title: "已复制提示词"
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "复制提示词失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function saveCurrentImage() {
    if (!selectedItem) {
      return;
    }
    try {
      const result = await saveImageWithSystemDialog(selectedItem.imageUrl, `${selectedItem.taskId}.png`);
      if (result.saved) {
        appendOperationLog({ source: "画廊", message: "已保存画廊图片", detail: { taskId: selectedItem.taskId, path: result.path } });
        showToast({
          tone: "success",
          title: "图片已保存",
          description: result.path || `${selectedItem.taskId}.png`
        });
        return;
      }
      if (result.cancelled) {
        showToast({
          tone: "info",
          title: "已取消保存图片"
        });
      }
    } catch (error) {
      showToast({
        tone: "error",
        title: "保存画廊图片失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return (
    <section className="view-shell gallery-overview-shell">
      <header className="view-header">
        <div>
          <p className="eyebrow">Gallery</p>
          <h1>{getCreationModeLabel(creationMode)}作品库</h1>
          <span>浏览本地保存的生成结果，快速查看提示词、状态和输出规格。</span>
        </div>
      </header>

      <div className="view-grid gallery-view-grid">
        <div className="surface-card">
          <div className="surface-card-head">
            <div>
              <h2>全部结果</h2>
              <p>当前模式下共 {filteredItems.length} 张作品。</p>
            </div>
          </div>

          <div className="overview-grid">
        {filteredItems.map((item) => {
          const active = selectedItem?.taskId === item.taskId;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "overview-tile active" : "overview-tile"}
              onClick={() => {
                selectTask(item.taskId);
                appendOperationLog({ source: "画廊", message: `已查看画廊详情 ${item.taskId}` });
              }}
            >
              <img src={new URL(item.imageUrl, backendBase).toString()} alt={item.prompt} />
              <div>
                <strong>{item.model}</strong>
                <span>{item.size}</span>
              </div>
            </button>
          );
        })}
        {filteredItems.length === 0 && <p className="empty-state">当前模式下暂无画廊记录</p>}
          </div>
        </div>

      <aside className="gallery-detail-panel surface-card">
        {selectedItem ? (
          <>
            <div className="gallery-detail-preview">
              <img src={previewUrl} alt={selectedItem.prompt} />
            </div>
            <div className="gallery-detail-copy">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Gallery Detail</p>
                  <h1>图片详情</h1>
                </div>
              </div>
              <div className="gallery-detail-meta">
                <span>模型 {selectedItem.model}</span>
                <span>尺寸 {selectedItem.size}</span>
                <span>任务 {selectedItem.taskId}</span>
                <span>时间 {formatLocalTime(selectedItem.createdAt)}</span>
                <span>状态 {selectedTask?.status || "succeeded"}</span>
              </div>
              <p className="gallery-detail-message">{selectedTask?.message || "这张结果已经持久化保存到本地任务库中。"}</p>
              <pre className="prompt-preview-box">{selectedItem.prompt || "没有可展示的提示词"}</pre>
              <div className="workflow-actions result-column-actions">
                <button type="button" className="ghost-button" onClick={() => void copyPrompt()}>
                  <Copy size={14} />
                  复制提示词
                </button>
                <button type="button" className="ghost-button" onClick={() => void saveCurrentImage()}>
                  <Download size={14} />
                  保存图片
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="empty-state">点击左侧缩略图后，这里会显示图片详情与保存入口</p>
        )}
      </aside>
      </div>
    </section>
  );
}

function formatLocalTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false
  });
}

function TaskStatusBoard({ creationMode }: { creationMode: CreationMode }) {
  const tasksById = useTaskStore((state) => state.tasks);
  const tasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => getTaskCreationMode(task) === creationMode)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [creationMode, tasksById]
  );
  const stats = useMemo(
    () => ({
      total: tasks.length,
      running: tasks.filter((task) => task.status === "pending" || task.status === "running").length,
      succeeded: tasks.filter((task) => task.status === "succeeded").length,
      failed: tasks.filter((task) => task.status === "failed").length
    }),
    [tasks]
  );

  return (
    <section className="view-shell task-center">
      <header className="view-header">
        <div>
          <p className="eyebrow">Status</p>
          <h1>{getCreationModeLabel(creationMode)}状态</h1>
          <span>集中查看当前模式下的历史任务、运行进度和异常信息。</span>
        </div>
      </header>
      <div className="log-summary">
        <span className="workflow-stat">
          <Activity size={14} />
          总任务 {stats.total}
        </span>
        <span className="workflow-stat">运行中 {stats.running}</span>
        <span className="workflow-stat">成功 {stats.succeeded}</span>
        <span className="workflow-stat">失败 {stats.failed}</span>
      </div>
      <div className="task-status-list">
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
      </div>
      {tasks.length === 0 && <p className="empty-state">当前模式下暂无任务</p>}
    </section>
  );
}

interface BackendStatusPanelProps {
  backend: ReturnType<typeof useConfigStore.getState>["backend"];
  capabilities: Capabilities | null;
  mode: CreationMode;
  queueCount: number;
  galleryCount: number;
  useServerKey: boolean;
  hasLocalKey: boolean;
  onRestartBackend: () => void;
}

function BackendStatusPanel({
  backend,
  capabilities,
  mode,
  queueCount,
  galleryCount,
  useServerKey,
  hasLocalKey,
  onRestartBackend
}: BackendStatusPanelProps) {
  return (
    <section className="view-shell task-center backend-status-panel">
      <header className="view-header with-action">
        <div>
          <p className="eyebrow">Backend</p>
          <h1>后端状态</h1>
          <span>查看本地 sidecar 的运行情况、鉴权策略和能力清单。</span>
        </div>
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            appendOperationLog({ source: "后端", message: "请求重启本地后端" });
            void onRestartBackend();
          }}
        >
          <RefreshCw size={14} />
          重启后端
        </button>
      </header>

      <div className="log-summary">
        <span className={`status-pill ${backend.status}`}>
          <Server size={13} />
          {backend.status === "online" ? "后端在线" : backend.status === "starting" ? "后端启动中" : "后端离线"}
        </span>
        <span className="workflow-stat">{getCreationModeLabel(mode)}</span>
        <span className="workflow-stat">队列 {queueCount}</span>
        <span className="workflow-stat">画廊 {galleryCount}</span>
      </div>

      <div className="settings-grid backend-status-grid">
        <section className="settings-section">
          <div className="settings-section-head">
            <h3>连接摘要</h3>
            <p>这里集中展示当前桌面端后端的运行状态和基础连接信息。</p>
          </div>
          <div className="gallery-detail-meta">
            <span>状态 {backend.status}</span>
            <span>端口 {backend.port ?? "未分配"}</span>
            <span>地址 {backend.baseUrl || "未连接"}</span>
            <span>消息 {backend.message}</span>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>能力与鉴权</h3>
            <p>用来确认当前实例支持哪些能力，以及请求时会采用哪种 Key 策略。</p>
          </div>
          <div className="gallery-detail-meta">
            <span>服务端 Key {capabilities?.server_key_configured ? "已配置" : "未配置"}</span>
            <span>当前策略 {useServerKey ? "服务端默认" : hasLocalKey ? "本地 Key" : "未携带 Key"}</span>
            <span>支持生图 {capabilities?.supports_generations ? "是" : "否"}</span>
            <span>支持图生图 {capabilities?.supports_edits ? "是" : "否"}</span>
            <span>支持模型列表 {capabilities?.supports_models ? "是" : "否"}</span>
            <span>默认上游 {capabilities?.default_api_base || "未返回"}</span>
          </div>
        </section>
      </div>
    </section>
  );
}

function isSettingsView(view: MainView): view is SettingsSection {
  return view === "connection" || view === "output" || view === "creative" || view === "advanced";
}
