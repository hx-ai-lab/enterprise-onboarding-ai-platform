import { randomUUID } from "node:crypto";
import { SeedOverrideRepository } from "@/lib/data/seed-override-repository";
import type { ModelParams, Skill, SkillTest } from "@/lib/types";

const repository = new SeedOverrideRepository<Skill>("skills.json", "skills");

export function getSkills(): Promise<Skill[]> {
  return repository.getAll();
}

export async function getSkillById(id: string): Promise<Skill | null> {
  const skills = await getSkills();
  return skills.find((s) => s.id === id) ?? null;
}

export async function getEnabledSkillsByIds(ids: string[]): Promise<Skill[]> {
  const skills = await getSkills();
  const set = new Set(ids);
  return skills.filter((s) => set.has(s.id) && s.enabled);
}

export type CreateSkillInput = {
  name: string;
  description: string;
  prompt: string;
  model_params: ModelParams;
  enabled?: boolean;
};

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const now = new Date().toISOString();
  const skill: Skill = {
    id: `skill-${randomUUID().slice(0, 8)}`,
    name: input.name,
    description: input.description,
    prompt: input.prompt,
    model_params: input.model_params,
    enabled: input.enabled ?? true,
    last_test: null,
    created_at: now,
    updated_at: now,
  };
  return repository.create(skill);
}

export type UpdateSkillInput = Partial<
  Pick<Skill, "name" | "description" | "prompt" | "model_params" | "enabled">
>;

export async function updateSkill(
  id: string,
  input: UpdateSkillInput,
): Promise<Skill | null> {
  return repository.update(id, input);
}

export async function setSkillLastTest(
  id: string,
  test: SkillTest,
): Promise<Skill | null> {
  return repository.update(id, { last_test: test } as Partial<Skill>);
}

export async function deleteSkill(id: string): Promise<boolean> {
  return repository.delete(id);
}
