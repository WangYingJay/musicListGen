import { Clock3, Images, ImageUp, PenSquare, ScrollText, Search, Server, Settings2, Sparkles } from "lucide-react";
import { useMemo } from "react";

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

const moreEntries: Array<{ id: SidebarView; label: string; icon: typeof Images }> = [
  { id: "gallery", label: "作品库", icon: Images },
  { id: "status", label: "任务状态", icon: Clock3 },
  { id: "connection", label: "设置", icon: Settings2 },
  { id: "backend", label: "后端状态", icon: Server },
  { id: "logs", label: "操作日志", icon: ScrollText }
];

export function ChatSidebar({ creationMode, activeView, onCreationModeChange, onViewChange, onNewSession }: ChatSidebarProps) {
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
          {(["text", "edit"] as const).map((mode) => (
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
              {mode === "text" ? <Sparkles size={14} /> : <ImageUp size={14} />}
              <span>{getCreationModeLabel(mode)}</span>
            </button>
          ))}
        </div>

        <section className="chat-sidebar-section">
          <div className="chat-sidebar-section-head">
            <span>最近</span>
            <strong>{recentSessions.length}</strong>
          </div>
          <div className="chat-sidebar-session-list">
            {recentSessions.map((task) => {
              const summary = getTaskCreationMode(task) === "text" ? parsePlaylistPromptSummary(task.prompt) : null;
              const title = summary?.title || task.prompt.slice(0, 22) || "未命名任务";
              const secondary = summary
                ? `${summary.songCount} 首歌 · ${formatConversationTime(task.created_at)}`
                : `${task.status === "succeeded" ? "图生图完成" : task.message || "等待处理中"} · ${formatConversationTime(task.created_at)}`;

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
            <span>更多</span>
          </div>
          <div className="chat-sidebar-more-list">
            {moreEntries.map((entry) => {
              const Icon = entry.icon;
              const active = entry.id === "connection"
                ? activeView === "connection" || activeView === "output" || activeView === "creative" || activeView === "advanced"
                : activeView === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={active ? "chat-more-button active" : "chat-more-button"}
                  onClick={() => onViewChange(entry.id)}
                >
                  <Icon size={15} />
                  <span>{entry.label}</span>
                </button>
              );
            })}
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
