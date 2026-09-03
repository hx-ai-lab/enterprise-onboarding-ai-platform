import { randomUUID } from "node:crypto";
import { readCollection, updateCollection } from "@/lib/data/json-store";
import type { ModelParams, Skill, SkillTest } from "@/lib/types";

const FILE = "skills.json";

export function getSkills(): Promise<Skill[]> {
  return readCollection<Skill>(FILE);
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
  await updateCollection<Skill>(FILE, (skills) => [...skills, skill]);
  return skill;
}

export type UpdateSkillInput = Partial<
  Pick<Skill, "name" | "description" | "prompt" | "model_params" | "enabled">
>;

export async function updateSkill(
  id: string,
  input: UpdateSkillInput,
): Promise<Skill | null> {
  let updated: Skill | null = null;
  await updateCollection<Skill>(FILE, (skills) =>
    skills.map((s) => {
      if (s.id !== id) return s;
      updated = { ...s, ...input, updated_at: new Date().toISOString() };
      return updated;
    }),
  );
  return updated;
}

export async function setSkillLastTest(
  id: string,
  test: SkillTest,
): Promise<Skill | null> {
  let updated: Skill | null = null;
  await updateCollection<Skill>(FILE, (skills) =>
    skills.map((s) => {
      if (s.id !== id) return s;
      updated = { ...s, last_test: test };
      return updated;
    }),
  );
  return updated;
}

export async function deleteSkill(id: string): Promise<boolean> {
  let existed = false;
  await updateCollection<Skill>(FILE, (skills) => {
    existed = skills.some((s) => s.id === id);
    return skills.filter((s) => s.id !== id);
  });
  return existed;
}
