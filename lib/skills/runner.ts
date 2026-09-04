import { getSkillById } from "@/lib/data/skills";
import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import { runWithSkill, type SkillRunResult } from "@/lib/skills/llm-execution";

export type { SkillRunResult };

/**
 * Runs a Skill by id. Always re-checks the enabled flag at call time (not
 * just at plan time) so a disabled Skill is rejected even when invoked
 * directly, e.g. from the Skill test page.
 */
export async function runSkill(
  skillId: string,
  input: Record<string, unknown>,
): Promise<SkillRunResult> {
  const skill = await getSkillById(skillId);
  if (!skill) throw new CapabilityNotFoundError("skill", skillId);
  if (!skill.enabled) {
    throw new CapabilityDisabledError("skill", skill.id, skill.name);
  }
  return runWithSkill(skill, input);
}
