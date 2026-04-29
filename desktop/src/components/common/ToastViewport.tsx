import { AlertCircle, CheckCircle2, Clock3, X } from "lucide-react";
import { useEffect } from "react";

import { useToastStore } from "../../stores/toastStore";

export function ToastViewport() {
  const items = useToastStore((state) => state.items);
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = items.map((item) =>
      window.setTimeout(() => {
        dismissToast(item.id);
      }, item.durationMs ?? 3200)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, items]);

  if (!items.length) {
    return null;
  }

  return (
    <aside className="toast-viewport" aria-live="polite">
      {items.map((item) => (
        <article key={item.id} className={`toast-card ${item.tone}`}>
          <span className={`toast-icon ${item.tone}`}>{renderToastIcon(item.tone)}</span>
          <div className="toast-copy">
            <strong>{item.title}</strong>
            {item.description && <p>{item.description}</p>}
          </div>
          <button type="button" className="toast-close" aria-label="关闭提示" onClick={() => dismissToast(item.id)}>
            <X size={14} />
          </button>
        </article>
      ))}
    </aside>
  );
}

function renderToastIcon(tone: "success" | "info" | "warn" | "error") {
  if (tone === "success") {
    return <CheckCircle2 size={16} />;
  }
  if (tone === "error") {
    return <AlertCircle size={16} />;
  }
  return <Clock3 size={16} />;
}
