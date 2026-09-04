import { randomUUID } from "node:crypto";
import { readCollection, updateCollection } from "@/lib/data/kv-store";
import type { AgentRunLog } from "@/lib/types";

const FILE = "logs.json";
const MAX_LOGS = 300;

export function getLogs(): Promise<AgentRunLog[]> {
  return readCollection<AgentRunLog>(FILE);
}

export async function getLogsByAgent(agentId: string): Promise<AgentRunLog[]> {
  const logs = await getLogs();
  return logs
    .filter((l) => l.agent_id === agentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
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
  await updateCollection<AgentRunLog>(FILE, (logs) => {
    const next = [...logs, log];
    // Bound file growth for a long-running demo instance.
    return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
  });
  return log;
}
