import { randomUUID } from "node:crypto";
import { getRuntimeStorage, storageKey, type RunLogKeys } from "@/lib/storage/runtime-storage";
import type { AgentRunLog } from "@/lib/types";

const MAX_LOGS = 300;
const KEYS: RunLogKeys = {
  items: storageKey("run-logs:items"),
  all: storageKey("run-logs:all"),
  byAgent: (agentId) => storageKey(`run-logs:by-agent:${agentId}`),
};

export function getLogs(): Promise<AgentRunLog[]> {
  return getRuntimeStorage().getRunLogs(KEYS);
}

export async function getLogsByAgent(agentId: string): Promise<AgentRunLog[]> {
  return getRuntimeStorage().getRunLogs(KEYS, agentId);
}

export async function getLogById(id: string): Promise<AgentRunLog | null> {
  const logs = await getLogs();
  return logs.find((l) => l.id === id) ?? null;
}

export async function appendLog(
  entry: Omit<AgentRunLog, "id" | "created_at">,
): Promise<AgentRunLog> {
  const log: AgentRunLog = {
    ...entry,
    id: `log-${randomUUID().slice(0, 8)}`,
    created_at: new Date().toISOString(),
  };
  await getRuntimeStorage().appendRunLog(KEYS, log, MAX_LOGS);
  return log;
}
