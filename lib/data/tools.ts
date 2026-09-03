import { randomUUID } from "node:crypto";
import { readCollection, updateCollection } from "@/lib/data/json-store";
import type { Tool } from "@/lib/types";

const FILE = "tools.json";

export function getTools(): Promise<Tool[]> {
  return readCollection<Tool>(FILE);
}

export async function getToolById(id: string): Promise<Tool | null> {
  const tools = await getTools();
  return tools.find((t) => t.id === id) ?? null;
}

export async function getEnabledToolsByIds(ids: string[]): Promise<Tool[]> {
  const tools = await getTools();
  const set = new Set(ids);
  return tools.filter((t) => set.has(t.id) && t.enabled);
}

export type CreateToolInput = {
  name: string;
  description: string;
  data_source: string;
  enabled?: boolean;
};

export async function createTool(input: CreateToolInput): Promise<Tool> {
  const now = new Date().toISOString();
  const tool: Tool = {
    id: `tool-${randomUUID().slice(0, 8)}`,
    name: input.name,
    description: input.description,
    data_source: input.data_source,
    enabled: input.enabled ?? true,
    created_at: now,
    updated_at: now,
  };
  await updateCollection<Tool>(FILE, (tools) => [...tools, tool]);
  return tool;
}

export type UpdateToolInput = Partial<
  Pick<Tool, "name" | "description" | "data_source" | "enabled">
>;

export async function updateTool(
  id: string,
  input: UpdateToolInput,
): Promise<Tool | null> {
  let updated: Tool | null = null;
  await updateCollection<Tool>(FILE, (tools) =>
    tools.map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, ...input, updated_at: new Date().toISOString() };
      return updated;
    }),
  );
  return updated;
}

export async function deleteTool(id: string): Promise<boolean> {
  let existed = false;
  await updateCollection<Tool>(FILE, (tools) => {
    existed = tools.some((t) => t.id === id);
    return tools.filter((t) => t.id !== id);
  });
  return existed;
}
