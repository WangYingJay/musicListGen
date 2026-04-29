import { AlertCircle, CheckCircle2, Clock3, Copy, Download, Loader2, PauseCircle, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { getBackendOrigin } from "../../api/client";
import { updateTaskGalleryVisibility } from "../../api/tasks";
import { useGalleryStore } from "../../stores/galleryStore";
import { useTaskStore } from "../../stores/taskStore";
import { showToast } from "../../stores/toastStore";
import type { GalleryItem, ImageTask } from "../../types";
import { saveImageWithSystemDialog } from "../../utils/imageSaver";
import { appendOperationLog } from "../../utils/operationLog";

export function GallerySidebar() {
  const items = useGalleryStore((state) => state.items);
  const query = useGalleryStore((state) => state.query);
  const removeItem = useGalleryStore((state) => state.removeItem);

  const tasksById = useTaskStore((state) => state.tasks);
  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const stopLocalTask = useTaskStore((state) => state.stopLocalTask);
  const selectTask = useTaskStore((state) => state.selectTask);
  const updateTaskFromResponse = useTaskStore((state) => state.updateTaskFromResponse);

  const backendOrigin = getBackendOrigin();
  const normalizedQuery = query.trim().toLowerCase();

  const runningTasks = useMemo(
    () =>
      Object.values(tasksById)
        .filter((task) => (task.status === "pending" || task.status === "running") && matchesTask(task, normalizedQuery))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [normalizedQuery, tasksById]
  );

  const historyItems = useMemo(
    () =>
      items
        .filter((item) => matchesGallery(item, normalizedQuery))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items, normalizedQuery]
  );

  return (
    <aside className="gallery-rail editor-sidebar">
      <div className="sidebar-shell">
        {/*<div className="sidebar-brand">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>创作记录</h2>
          </div>
          <span className="count-badge">{runningTasks.length + historyItems.length}</span>
        </div>

        <label className="search-box sidebar-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务或提示词" />
        </label>*/}

        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <span>任务队列</span>
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

        <div className="sidebar-section">
          <div className="sidebar-section-head">
            <span>历史画廊</span>
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
                    appendOperationLog({ source: "侧栏", message: `已查看历史结果 ${item.taskId}` });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectTask(item.taskId);
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

function matchesTask(task: ImageTask, query: string) {
  if (!query) {
    return true;
  }
  const size = typeof task.params === "object" && task.params && "size" in task.params ? String(task.params.size || "") : "";
  return [task.prompt, task.task_id, task.message, size].some((value) => value?.toLowerCase().includes(query));
}

function matchesGallery(item: GalleryItem, query: string) {
  if (!query) {
    return true;
  }
  return [item.prompt, item.model, item.size, item.taskId].some((value) => value?.toLowerCase().includes(query));
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
    return <Clock3 size={14} />;
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
      title: "已复制历史提示词"
    });
  } catch (error) {
    showToast({
      tone: "error",
      title: "复制历史提示词失败",
      description: error instanceof Error ? error.message : String(error)
    });
  }
}
