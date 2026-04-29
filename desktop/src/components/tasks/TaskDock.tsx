import { AlertCircle, CheckCircle2, Loader2, PauseCircle } from "lucide-react";
import { useMemo } from "react";

import { useTaskStore } from "../../stores/taskStore";

export function TaskDock() {
  const tasksById = useTaskStore((state) => state.tasks);
  const stopLocalTask = useTaskStore((state) => state.stopLocalTask);

  const recentTasks = useMemo(
    () => Object.values(tasksById).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    [tasksById]
  );

  return (
    <aside className="task-dock">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Queue</p>
          <h2>任务队列</h2>
        </div>
      </div>

      <div className="task-list">
        {recentTasks.map((task) => (
          <article key={task.task_id} className="task-row">
            <div className={`task-icon ${task.status}`}>
              {task.status === "succeeded" ? (
                <CheckCircle2 size={15} />
              ) : task.status === "failed" ? (
                <AlertCircle size={15} />
              ) : task.status === "cancelled" ? (
                <PauseCircle size={15} />
              ) : (
                <Loader2 className="spin" size={15} />
              )}
            </div>
            <div className="task-copy">
              <strong>{task.prompt || "未命名任务"}</strong>
              <span>{task.message}</span>
              <div className="progress-track">
                <i style={{ width: `${task.progress}%` }} />
              </div>
            </div>
            {(task.status === "pending" || task.status === "running") && (
              <button type="button" className="ghost-icon" onClick={() => stopLocalTask(task.task_id)}>
                停止
              </button>
            )}
          </article>
        ))}
        {recentTasks.length === 0 && <p className="empty-state">暂无任务</p>}
      </div>
    </aside>
  );
}
