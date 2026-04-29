import { useOperationLogStore } from "../stores/operationLogStore";
import type { OperationLogLevel } from "../types";

interface AppendOperationLogInput {
  level?: OperationLogLevel;
  source: string;
  message: string;
  detail?: unknown;
  createdAt?: string;
  externalId?: string;
}

export function appendOperationLog({ level = "info", source, message, detail, createdAt, externalId }: AppendOperationLogInput): void {
  useOperationLogStore.getState().appendLog({
    level,
    source,
    message,
    detail: formatLogDetail(detail),
    createdAt,
    externalId
  });
}

function formatLogDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null || detail === "") {
    return undefined;
  }
  if (typeof detail === "string") {
    return detail;
  }
  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}
