import { randomUUID } from "node:crypto";
import { SeedOverrideRepository } from "@/lib/data/seed-override-repository";
import type { Tool } from "@/lib/types";

const repository = new SeedOverrideRepository<Tool>("tools.json", "tools");

export function getTools(): Promise<Tool[]> {
  return repository.getAll();
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
  return repository.create(tool);
}

export type UpdateToolInput = Partial<
  Pick<Tool, "name" | "description" | "data_source" | "enabled">
>;

export async function updateTool(
  id: string,
  input: UpdateToolInput,
): Promise<Tool | null> {
  return repository.update(id, input);
}

export async function deleteTool(id: string): Promise<boolean> {
  return repository.delete(id);
}
