import { ChevronDown, Clock3, FolderOpen, Images, ImageUp, PenSquare, ScrollText, Search, Server, Settings2, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useConfigStore } from "../../stores/configStore";
import { useGalleryStore } from "../../stores/galleryStore";
import { useTaskStore } from "../../stores/taskStore";
import type { CreationMode, SidebarView } from "../../types";
import { parsePlaylistPromptSummary } from "../../utils/playlistConversation";
import { appendOperationLog } from "../../utils/operationLog";
import { getCreationModeLabel, getTaskCreationMode } from "../../utils/taskGrouping";

interface ChatSidebarProps {
  creationMode: CreationMode;
  activeView: SidebarView | "workspace";
  onCreationModeChange: (mode: CreationMode) => void;
  onViewChange: (view: SidebarView | "workspace") => void;
  onNewSession: () => void;
}

const settingsMenuEntries: Array<{ id: SidebarView; label: string; icon: typeof Images }> = [
  { id: "gallery", label: "作品库", icon: Images },
  { id: "status", label: "任务状态", icon: Clock3 },
  { id: "backend", label: "后端状态", icon: Server },
  { id: "logs", label: "操作日志", icon: ScrollText },
  { id: "connection", label: "连接与授权", icon: ShieldCheck },
  { id: "output", label: "默认输出", icon: Sparkles },
  { id: "creative", label: "创作偏好", icon: FolderOpen },
  { id: "advanced", label: "高级采样", icon: SlidersHorizontal }
];

export function ChatSidebar({ creationMode, activeView, onCreationModeChange, onViewChange, onNewSession }: ChatSidebarProps) {
  const [settingsOpen, setSettingsOpen] = useState(() => isSettingsMenuView(activeView));
  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const activeTaskIds = useTaskStore((state) => state.activeTaskIds);
  const galleryItems = useGalleryStore((state) => state.items);
  const backend = useConfigStore((state) => state.backend);

  const recentSessions = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => getTaskCreationMode(task) === creationMode)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, 10),
    [creationMode, tasksById]
  );

  const queueCount = useMemo(
    () => activeTaskIds.filter((taskId) => tasksById[taskId] && getTaskCreationMode(tasksById[taskId]) === creationMode).length,
    [activeTaskIds, creationMode, tasksById]
  );

  const galleryCount = useMemo(
    () =>
      galleryItems.filter((item) => {
        const task = tasksById[item.taskId];
        return task ? getTaskCreationMode(task) === creationMode : false;
      }).length,
    [creationMode, galleryItems, tasksById]
  );
  const hasActiveSettingsView = isSettingsMenuView(activeView);

  useEffect(() => {
    if (hasActiveSettingsView) {
      setSettingsOpen(true);
    }
  }, [hasActiveSettingsView]);

  return (
    <aside className="workspace-sidebar chat-sidebar">
      <div className="workspace-sidebar-shell chat-sidebar-shell">
        <div className="chat-sidebar-brand">
          <div>
            <strong>有品服务</strong>
            <span>歌单封面生成</span>
          </div>
        </div>

        <button
          type="button"
          className="chat-sidebar-primary"
          onClick={() => {
            selectTask(null);
            onNewSession();
            onViewChange("workspace");
            appendOperationLog({ source: "侧栏", message: "开始新的创作会话" });
          }}
        >
          <PenSquare size={16} />
          <span>新建创作</span>
        </button>

        <button
          type="button"
          className={activeView === "gallery" ? "chat-sidebar-search active" : "chat-sidebar-search"}
          onClick={() => {
            onViewChange("gallery");
            appendOperationLog({ source: "侧栏", message: "打开作品库浏览历史结果" });
          }}
        >
          <Search size={16} />
          <span>搜索记录</span>
        </button>

        <div className="chat-sidebar-mode-group" role="tablist" aria-label="创作模式">
          {(["text", "textToImage", "edit"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={creationMode === mode ? "chat-sidebar-mode active" : "chat-sidebar-mode"}
              role="tab"
              aria-selected={creationMode === mode}
              onClick={() => {
                onCreationModeChange(mode);
                onViewChange("workspace");
              }}
            >
              {mode === "text" ? <ScrollText size={14} /> : mode === "textToImage" ? <Sparkles size={14} /> : <ImageUp size={14} />}
              <span>{getCreationModeLabel(mode)}</span>
            </button>
          ))}
        </div>

        <section className="chat-sidebar-section chat-sidebar-history">
          <div className="chat-sidebar-section-head">
            <span>最近</span>
            <strong>{recentSessions.length}</strong>
          </div>
          <div className="chat-sidebar-session-list">
            {recentSessions.map((task) => {
              const taskMode = getTaskCreationMode(task);
              const summary = taskMode === "text" ? parsePlaylistPromptSummary(task.prompt) : null;
              const title = summary?.title || task.prompt.slice(0, 22) || "未命名任务";
              const secondary = summary
                ? `${summary.songCount} 首歌 · ${formatConversationTime(task.created_at)}`
                : `${task.status === "succeeded" ? `${getCreationModeLabel(taskMode)}完成` : task.message || "等待处理中"} · ${formatConversationTime(task.created_at)}`;

              return (
                <button
                  key={task.task_id}
                  type="button"
                  className={selectedTaskId === task.task_id && activeView === "workspace" ? "chat-session-button active" : "chat-session-button"}
                  onClick={() => {
                    selectTask(task.task_id);
                    onViewChange("workspace");
                    appendOperationLog({ source: "侧栏", message: `切换到历史会话 ${task.task_id}` });
                  }}
                >
                  <strong>{title}</strong>
                  <span>{secondary}</span>
                </button>
              );
            })}
            {recentSessions.length === 0 && <p className="chat-sidebar-empty">当前模式下还没有历史会话</p>}
          </div>
        </section>

        <section className="chat-sidebar-section">
          <div className="chat-sidebar-section-head">
            <span>设置</span>
          </div>
          <div className={settingsOpen ? "chat-settings-group open" : "chat-settings-group"}>
            <button
              type="button"
              className={hasActiveSettingsView ? "chat-more-button chat-settings-toggle active" : "chat-more-button chat-settings-toggle"}
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <span className="chat-settings-toggle-main">
                <Settings2 size={15} />
                <span>设置</span>
              </span>
              <ChevronDown className={settingsOpen ? "chat-settings-chevron open" : "chat-settings-chevron"} size={15} />
            </button>
            {settingsOpen ? (
              <div className="chat-settings-submenu">
                {settingsMenuEntries.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      className={activeView === entry.id ? "chat-settings-child active" : "chat-settings-child"}
                      onClick={() => onViewChange(entry.id)}
                    >
                      <Icon size={14} />
                      <span>{entry.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <div className="chat-sidebar-footer">
          <div className="chat-sidebar-status-row">
            <span className={`chat-status-dot ${backend.status}`} />
            <span>{backend.status === "online" ? "后端在线" : backend.status === "starting" ? "后端启动中" : "后端离线"}</span>
          </div>
          <div className="chat-sidebar-meta-row">
            <span>
              <Clock3 size={13} />
              队列 {queueCount}
            </span>
            <span>
              <Images size={13} />
              作品 {galleryCount}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function formatConversationTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function isSettingsMenuView(view: SidebarView | "workspace"): view is SidebarView {
  return view === "gallery" || view === "status" || view === "backend" || view === "logs" || view === "connection" || view === "output" || view === "creative" || view === "advanced";
}
