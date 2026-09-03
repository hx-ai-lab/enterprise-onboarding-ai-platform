import { randomUUID } from "node:crypto";
import { readCollection, updateCollection } from "@/lib/data/json-store";
import type { Agent } from "@/lib/types";

const FILE = "agents.json";

export function getAgents(): Promise<Agent[]> {
  return readCollection<Agent>(FILE);
}

export async function getAgentById(id: string): Promise<Agent | null> {
  const agents = await getAgents();
  return agents.find((a) => a.id === id) ?? null;
}

export type CreateAgentInput = {
  name: string;
  description: string;
  system_prompt: string;
  model_id: string;
  bound_skill_ids: string[];
  bound_tool_ids: string[];
  enabled?: boolean;
};

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const now = new Date().toISOString();
  const agent: Agent = {
    id: `agent-${randomUUID().slice(0, 8)}`,
    name: input.name,
    description: input.description,
    system_prompt: input.system_prompt,
    model_id: input.model_id,
    bound_skill_ids: input.bound_skill_ids,
    bound_tool_ids: input.bound_tool_ids,
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now,
  };
  await updateCollection<Agent>(FILE, (agents) => [...agents, agent]);
  return agent;
}

export type UpdateAgentInput = Partial<
  Pick<
    Agent,
    | "name"
    | "description"
    | "system_prompt"
    | "model_id"
    | "bound_skill_ids"
    | "bound_tool_ids"
    | "enabled"
  >
>;

export async function updateAgent(
  id: string,
  input: UpdateAgentInput,
): Promise<Agent | null> {
  let updated: Agent | null = null;
  await updateCollection<Agent>(FILE, (agents) =>
    agents.map((a) => {
      if (a.id !== id) return a;
      updated = { ...a, ...input, updated_at: new Date().toISOString() };
      return updated;
    }),
  );
  return updated;
}

export async function deleteAgent(id: string): Promise<boolean> {
  let existed = false;
  await updateCollection<Agent>(FILE, (agents) => {
    existed = agents.some((a) => a.id === id);
    return agents.filter((a) => a.id !== id);
  });
  return existed;
}
