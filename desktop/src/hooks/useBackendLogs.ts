import { useEffect, useRef } from "react";

import { fetchBackendLogs } from "../api/logs";
import { appendOperationLog } from "../utils/operationLog";

export function useBackendLogs(): void {
  const lastLogIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const logs = await fetchBackendLogs(lastLogIdRef.current, 120);
        if (cancelled || logs.length === 0) {
          return;
        }

        logs.forEach((entry) => {
          lastLogIdRef.current = Math.max(lastLogIdRef.current, entry.id);
          appendOperationLog({
            externalId: `backend:${entry.id}`,
            createdAt: entry.created_at,
            level: entry.level,
            source: entry.source,
            message: entry.message,
            detail: entry.detail
          });
        });
      } catch {
        // 后端日志拉取失败不反复刷屏，避免在后端重启期间产生噪音。
      }
    }

    void tick();
    const interval = window.setInterval(tick, document.hidden ? 5_000 : 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);
}
