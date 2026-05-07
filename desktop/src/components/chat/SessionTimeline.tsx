import { AlertCircle, CheckCircle2, Copy, Download, Loader2, PauseCircle, Sparkles } from "lucide-react";

import type { TaskStatus } from "../../types";

export interface SessionTurnItem {
  id: string;
  title: string;
  shortPrompt: string;
  artistName: string;
  songCount: number;
  songPreview: string[];
  status: TaskStatus;
  message: string;
  imageUrl?: string;
  model: string;
  size: string;
  createdAt: string;
  active: boolean;
}

interface SessionTimelineProps {
  turns: SessionTurnItem[];
  onSelectTurn: (taskId: string) => void;
  onReuseTurn: (taskId: string) => void;
  onCopyPrompt: (taskId: string) => void;
  onDownloadImage: (taskId: string) => void;
}

export function SessionTimeline({ turns, onSelectTurn, onReuseTurn, onCopyPrompt, onDownloadImage }: SessionTimelineProps) {
  return (
    <div className="session-timeline" aria-label="创作会话记录">
      {turns.map((turn) => (
        <section key={turn.id} className={turn.active ? "timeline-turn active" : "timeline-turn"}>
          <article className="timeline-card timeline-request-card">
            <div className="timeline-card-head">
              <span className="timeline-role">本轮输入</span>
              <button type="button" className="timeline-inline-button" onClick={() => onSelectTurn(turn.id)}>
                聚焦
              </button>
            </div>

            <h3>{turn.title}</h3>
            <p>{turn.shortPrompt}</p>

            <div className="timeline-meta-list">
              {turn.artistName ? <span>{turn.artistName}</span> : null}
              <span>{turn.songCount} 首歌</span>
              {turn.songPreview.length > 0 ? <span>{turn.songPreview.join(" / ")}</span> : null}
            </div>
          </article>

          <article className="timeline-card timeline-result-card">
            <div className="timeline-card-head">
              <span className={`timeline-status-badge ${turn.status}`}>{renderStatusIcon(turn.status)}{renderStatusLabel(turn.status)}</span>
              <span className="timeline-time">{formatTimelineTime(turn.createdAt)}</span>
            </div>

            <div className={turn.imageUrl ? "timeline-result-grid has-image" : "timeline-result-grid"}>
              {turn.imageUrl ? (
                <div className="timeline-image-frame">
                  <img src={turn.imageUrl} alt={turn.title} />
                </div>
              ) : (
                <div className="timeline-image-frame placeholder">
                  <Sparkles size={26} />
                  <span>结果返回后会显示在这里</span>
                </div>
              )}

              <div className="timeline-result-copy">
                <p>{turn.message || "系统已经记录了这轮生成结果。"}</p>

                <div className="timeline-meta-list compact">
                  <span>{turn.model}</span>
                  <span>{turn.size}</span>
                </div>

                <div className="timeline-action-row">
                  <button type="button" className="timeline-action-button" onClick={() => onReuseTurn(turn.id)}>
                    继续优化
                  </button>
                  <button type="button" className="timeline-action-button subtle" onClick={() => onCopyPrompt(turn.id)}>
                    <Copy size={14} />
                    复制提示词
                  </button>
                  <button
                    type="button"
                    className="timeline-action-button subtle"
                    disabled={!turn.imageUrl}
                    onClick={() => onDownloadImage(turn.id)}
                  >
                    <Download size={14} />
                    保存图片
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      ))}
    </div>
  );
}

function renderStatusIcon(status: TaskStatus) {
  if (status === "succeeded") {
    return <CheckCircle2 size={14} />;
  }
  if (status === "failed") {
    return <AlertCircle size={14} />;
  }
  if (status === "cancelled") {
    return <PauseCircle size={14} />;
  }
  return <Loader2 size={14} className={status === "running" ? "spin" : ""} />;
}

function renderStatusLabel(status: TaskStatus): string {
  if (status === "succeeded") {
    return "已生成";
  }
  if (status === "failed") {
    return "生成失败";
  }
  if (status === "cancelled") {
    return "已停止";
  }
  if (status === "pending") {
    return "等待处理";
  }
  return "生成中";
}

function formatTimelineTime(value: string): string {
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
