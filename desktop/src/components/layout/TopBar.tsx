import { Activity, Images, ListChecks, ScrollText, Settings, Sparkles, Wand2 } from "lucide-react";

import brandLogo from "../../../../assets/logo-source.png";

type TopBarMode = "text" | "edit" | "gallery" | "logs" | "settings";

interface TopBarProps {
  mode: TopBarMode;
  onModeChange: (mode: TopBarMode) => void;
  galleryCount: number;
  queueCount: number;
  backendStatus: "online" | "starting" | "offline";
}

const navItems: Array<{ id: TopBarMode; label: string; icon: typeof Sparkles }> = [
  { id: "text", label: "歌单生成", icon: Sparkles },
  { id: "edit", label: "图生图", icon: Wand2 },
  { id: "gallery", label: "画廊", icon: Images },
  { id: "logs", label: "日志", icon: ScrollText },
  { id: "settings", label: "设置", icon: Settings }
];

export function TopBar({ mode, onModeChange, galleryCount, queueCount, backendStatus }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-mark">
        <div className="brand-icon">
          <img className="brand-logo" src={brandLogo} alt="有品服务 Logo" />
        </div>
        <div className="brand-copy">
          <strong>有品服务</strong>
          <span>歌单生成工作台</span>
        </div>
      </div>
      <nav className="main-nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={mode === item.id ? "nav-button active" : "nav-button"}
              type="button"
              onClick={() => onModeChange(item.id)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="top-spacer" />
      <div className="top-status-list" aria-label="工作区状态">
        <span className={`top-status-item ${backendStatus}`}>
          <Activity size={14} />
          {backendStatus === "online" ? "后端在线" : backendStatus === "starting" ? "后端启动中" : "后端离线"}
        </span>
        <span className="top-status-item">
          <ListChecks size={14} />
          队列 {queueCount}
        </span>
        <span className="top-status-item">
          <Images size={14} />
          画廊 {galleryCount}
        </span>
      </div>
    </header>
  );
}
