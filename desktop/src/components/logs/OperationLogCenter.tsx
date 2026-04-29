import { Copy, Filter, ListChecks, RotateCcw, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { useOperationLogStore } from "../../stores/operationLogStore";
import { useTaskStore } from "../../stores/taskStore";
import type { OperationLogLevel } from "../../types";
import { appendOperationLog } from "../../utils/operationLog";

type LogFilter = "all" | OperationLogLevel;

export function OperationLogCenter() {
  const [filter, setFilter] = useState<LogFilter>("all");
  const entries = useOperationLogStore((state) => state.entries);
  const clearLogs = useOperationLogStore((state) => state.clearLogs);
  const tasks = Object.values(useTaskStore((state) => state.tasks));

  const filteredEntries = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.level === filter)),
    [entries, filter]
  );

  const stats = useMemo(
    () => ({
      total: entries.length,
      running: tasks.filter((task) => task.status === "pending" || task.status === "running").length,
      failed: entries.filter((entry) => entry.level === "error").length,
      warnings: entries.filter((entry) => entry.level === "warn").length
    }),
    [entries, tasks]
  );

  return (
    <section className="log-center">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Logs</p>
          <h1>操作日志</h1>
        </div>
        <div className="workflow-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              void navigator.clipboard.writeText(formatLogExport(entries));
              appendOperationLog({ source: "日志", message: "已复制全部操作日志" });
            }}
          >
            <Copy size={14} />
            复制全部
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              clearLogs();
            }}
          >
            <RotateCcw size={14} />
            清空日志
          </button>
        </div>
      </div>

      <div className="log-summary">
        <span className="workflow-stat">
          <ScrollText size={14} />
          总记录 {stats.total}
        </span>
        <span className="workflow-stat">
          <ListChecks size={14} />
          运行中任务 {stats.running}
        </span>
        <span className="workflow-stat">
          <Filter size={14} />
          警告 {stats.warnings}
        </span>
        <span className="workflow-stat">错误 {stats.failed}</span>
      </div>

      <div className="log-filter-row" role="tablist" aria-label="日志过滤">
        {[
          { id: "all" as const, label: "全部" },
          { id: "info" as const, label: "信息" },
          { id: "warn" as const, label: "警告" },
          { id: "error" as const, label: "错误" }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={filter === item.id ? "log-filter active" : "log-filter"}
            onClick={() => {
              setFilter(item.id);
              appendOperationLog({ source: "日志", message: `切换日志过滤：${item.label}` });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="log-entry-list">
        {filteredEntries.map((entry) => (
          <article className="log-entry" key={entry.id}>
            <div className="log-entry-meta">
              <span className={`log-level-badge ${entry.level}`}>{renderLevel(entry.level)}</span>
              <span className="log-entry-source">{entry.source}</span>
              <time>{formatTime(entry.createdAt)}</time>
            </div>
            <strong>{entry.message}</strong>
            {entry.detail && <pre className="log-entry-detail">{entry.detail}</pre>}
          </article>
        ))}
        {filteredEntries.length === 0 && <p className="empty-state">还没有符合当前过滤条件的日志。</p>}
      </div>
    </section>
  );
}

function renderLevel(level: OperationLogLevel): string {
  if (level === "warn") return "警告";
  if (level === "error") return "错误";
  return "信息";
}

function formatTime(value: string): string {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function formatLogExport(entries: ReturnType<typeof useOperationLogStore.getState>["entries"]): string {
  return entries
    .map((entry) => `[${formatTime(entry.createdAt)}] [${entry.level}] [${entry.source}] ${entry.message}${entry.detail ? `\n${entry.detail}` : ""}`)
    .join("\n\n");
}
