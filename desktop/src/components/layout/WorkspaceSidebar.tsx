import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FolderOpen,
  Images,
  Loader2,
  PauseCircle,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getBackendOrigin } from "../../api/client";
import { updateTaskGalleryVisibility } from "../../api/tasks";
import { useGalleryStore } from "../../stores/galleryStore";
import { useTaskStore } from "../../stores/taskStore";
import { showToast } from "../../stores/toastStore";
import type { CreationMode, ImageTask, SidebarView } from "../../types";
import { saveImageWithSystemDialog } from "../../utils/imageSaver";
import { appendOperationLog } from "../../utils/operationLog";
import { getCreationModeLabel, getTaskCreationMode } from "../../utils/taskGrouping";

interface WorkspaceSidebarProps {
  creationMode: CreationMode;
  activeView: SidebarView | "workspace";
  onCreationModeChange: (mode: CreationMode) => void;
  onViewChange: (view: SidebarView) => void;
}

const settingsMenuItems: Array<{ id: SidebarView; label: string; icon: typeof Images }> = [
  { id: "gallery", label: "画廊", icon: Images },
  { id: "status", label: "状态", icon: Activity },
  { id: "connection", label: "连接与鉴权", icon: ShieldCheck },
  { id: "output", label: "默认输出", icon: Sparkles },
  { id: "creative", label: "创作偏好", icon: FolderOpen },
  { id: "advanced", label: "高级采样", icon: SlidersHorizontal },
  { id: "backend", label: "后端状态", icon: Server },
  { id: "logs", label: "日志", icon: ScrollText }
];

export function WorkspaceSidebar({ creationMode, activeView, onCreationModeChange, onViewChange }: WorkspaceSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsLayerRef = useRef<HTMLDivElement | null>(null);
  const items = useGalleryStore((state) => state.items);
  const removeItem = useGalleryStore((state) => state.removeItem);
  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const stopLocalTask = useTaskStore((state) => state.stopLocalTask);
  const selectTask = useTaskStore((state) => state.selectTask);
  const updateTaskFromResponse = useTaskStore((state) => state.updateTaskFromResponse);

  const backendOrigin = getBackendOrigin();
  const currentLabel = getCreationModeLabel(creationMode);

  const runningTasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => getTaskCreationMode(task) === creationMode && (task.status === "pending" || task.status === "running"))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [creationMode, tasksById]
  );

  const historyItems = useMemo(
    () =>
      items
        .filter((item) => {
          const task = tasksById[item.taskId];
          return task ? getTaskCreationMode(task) === creationMode : false;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [creationMode, items, tasksById]
  );

  const hasActiveSettingsChild = settingsMenuItems.some((item) => item.id === activeView);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (settingsLayerRef.current?.contains(event.target as Node)) {
        return;
      }
      setSettingsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-sidebar-shell">
        <div className="workspace-mode-switch" role="tablist" aria-label="创作模式切换">
          {[
            { id: "text" as const, label: "歌单生成" },
            { id: "edit" as const, label: "图生图" }
          ].map((item) => {
            return (
              <button
                key={item.id}
                type="button"
                className={creationMode === item.id ? "workspace-mode-button active" : "workspace-mode-button"}
                role="tab"
                aria-selected={creationMode === item.id}
                onClick={() => {
                  setSettingsOpen(false);
                  onCreationModeChange(item.id);
                  appendOperationLog({ source: "侧栏", message: `切换到${item.label}` });
                }}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-section sidebar-section-queue">
          <div className="sidebar-section-head">
            <span>{currentLabel}任务队列</span>
            <strong>{runningTasks.length}</strong>
          </div>
          <div className="sidebar-list">
            {runningTasks.map((task) => (
              <article
                key={task.task_id}
                className={selectedTaskId === task.task_id ? "sidebar-row active" : "sidebar-row"}
                role="button"
                tabIndex={0}
                onClick={() => {
                  selectTask(task.task_id);
                  appendOperationLog({ source: "侧栏", message: `已聚焦任务 ${task.task_id}` });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectTask(task.task_id);
                  }
                }}
              >
                <span className={`sidebar-row-icon ${task.status}`}>{renderTaskIcon(task.status)}</span>
                <span className="sidebar-row-main">
                  <strong>{task.prompt || "未命名任务"}</strong>
                  <span>{task.message || "等待状态回传"}</span>
                  <i className="sidebar-progress-track">
                    <i style={{ width: `${task.progress}%` }} />
                  </i>
                </span>
                <span className="sidebar-row-meta">
                  <span>{task.progress}%</span>
                  <button
                    type="button"
                    className="sidebar-inline-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      stopLocalTask(task.task_id);
                    }}
                  >
                    停止
                  </button>
                </span>
              </article>
            ))}
            {runningTasks.length === 0 && <p className="sidebar-empty">当前没有运行中的任务</p>}
          </div>
        </div>

        <div className="sidebar-section sidebar-section-gallery">
          <div className="sidebar-section-head">
            <span>{currentLabel}历史画廊</span>
            <strong>{historyItems.length}</strong>
          </div>
          <div className="sidebar-list">
            {historyItems.map((item) => {
              const imageUrl = new URL(item.imageUrl, backendOrigin).toString();
              const active = selectedTaskId === item.taskId;

              return (
                <article
                  key={item.id}
                  className={active ? "sidebar-row asset-row active" : "sidebar-row asset-row"}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    selectTask(item.taskId);
                    onViewChange("gallery");
                    appendOperationLog({ source: "侧栏", message: `已查看历史结果 ${item.taskId}` });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectTask(item.taskId);
                      onViewChange("gallery");
                    }
                  }}
                >
                  <img className="sidebar-thumb" src={imageUrl} alt={item.prompt} />
                  <span className="sidebar-row-main">
                    <strong>{item.prompt || "未命名结果"}</strong>
                    <span>
                      {item.model} · {item.size}
                    </span>
                  </span>
                  <span className="sidebar-row-actions">
                    <button
                      type="button"
                      className="sidebar-inline-icon"
                      aria-label="复制提示词"
                      onClick={(event) => {
                        event.stopPropagation();
                        void copyPrompt(item.prompt);
                      }}
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-inline-icon"
                      aria-label="下载图片"
                      onClick={(event) => {
                        event.stopPropagation();
                        void saveGalleryImage(item.imageUrl, `${item.taskId}.png`);
                      }}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      className="sidebar-inline-icon"
                      aria-label="隐藏历史记录"
                      onClick={(event) => {
                        event.stopPropagation();
                        void hideGalleryItem(item.taskId, item.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </article>
              );
            })}
            {historyItems.length === 0 && <p className="sidebar-empty">生成完成的结果会在这里累计保存</p>}
          </div>
        </div>

        <div className="sidebar-settings" ref={settingsLayerRef}>
          <button
            type="button"
            className={settingsOpen || hasActiveSettingsChild ? "sidebar-settings-trigger active" : "sidebar-settings-trigger"}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((value) => !value)}
          >
            <span className="sidebar-settings-trigger-main">
              <Settings size={16} />
              <span>设置</span>
            </span>
            <ChevronDown className={settingsOpen ? "sidebar-settings-chevron open" : "sidebar-settings-chevron"} size={16} />
          </button>

          {settingsOpen && (
            <div className="sidebar-settings-menu" role="menu" aria-label="设置菜单">
              {settingsMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={activeView === item.id ? "sidebar-settings-item active" : "sidebar-settings-item"}
                    onClick={() => {
                      setSettingsOpen(false);
                      onViewChange(item.id);
                      appendOperationLog({ source: "侧栏", message: `打开${item.label}` });
                    }}
                  >
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  async function hideGalleryItem(taskId: string, itemId: string) {
    try {
      const response = await updateTaskGalleryVisibility(taskId, true);
      updateTaskFromResponse(response);
      removeItem(itemId);
      appendOperationLog({ source: "画廊", level: "warn", message: `已隐藏历史结果 ${taskId}` });
      showToast({
        tone: "success",
        title: "已从历史画廊隐藏"
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "隐藏历史结果失败",
        description: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function renderTaskIcon(status: ImageTask["status"]) {
  if (status === "succeeded") {
    return <CheckCircle2 size={14} />;
  }
  if (status === "failed") {
    return <AlertCircle size={14} />;
  }
  if (status === "cancelled") {
    return <PauseCircle size={14} />;
  }
  if (status === "pending") {
    return <Activity size={14} />;
  }
  return <Loader2 className="spin" size={14} />;
}

async function saveGalleryImage(url: string, defaultName: string) {
  try {
    const result = await saveImageWithSystemDialog(url, defaultName);
    if (result.saved) {
      appendOperationLog({ source: "画廊", message: "已保存历史图片", detail: { path: result.path, defaultName } });
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
      title: "保存历史图片失败",
      description: error instanceof Error ? error.message : String(error)
    });
  }
}

async function copyPrompt(prompt: string) {
  try {
    await navigator.clipboard.writeText(prompt);
    appendOperationLog({ source: "画廊", message: "已复制历史提示词" });
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
