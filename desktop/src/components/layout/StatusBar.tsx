import { Activity, Database, Server } from "lucide-react";

import type { BackendState } from "../../types";

interface StatusBarProps {
  backend: BackendState;
  taskCount: number;
  queueCount: number;
  useServerKey: boolean;
  hasLocalKey: boolean;
}

export function StatusBar({ backend, taskCount, queueCount, useServerKey, hasLocalKey }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span className={`status-pill ${backend.status}`}>
        <Server size={13} />
        {backend.status === "online" ? "后端在线" : backend.status === "starting" ? "后端启动中" : "后端离线"}
      </span>
      <span className="status-item">
        <Activity size={13} />
        队列 {queueCount}
      </span>
      <span className="status-item">
        <Database size={13} />
        画廊 {taskCount}
      </span>
      <span className="status-item">Key：{useServerKey ? "服务端默认" : hasLocalKey ? "本地配置" : "未配置"}</span>
      <span className="status-message">{backend.message}</span>
    </footer>
  );
}
