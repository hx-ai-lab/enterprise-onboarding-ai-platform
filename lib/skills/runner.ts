import { getSkillById } from "@/lib/data/skills";
import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import { callLLM, extractJson, isLLMConfigured } from "@/lib/llm";
import {
  mockComplianceReview,
  mockPolicyQa,
  mockProcessExplain,
  mockReplyGeneration,
  mockStructuring,
  mockTaskDecision,
  type ComplianceReviewInput,
  type PolicyQaInput,
  type ProcessExplainInput,
  type ReplyGenerationInput,
  type StructuringInput,
  type TaskDecisionInput,
} from "@/lib/skills/mocks";
import type { Skill } from "@/lib/types";

export type SkillRunResult = {
  output: unknown;
  mocked: boolean;
  mock_reason?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockRunner = (input: any) => unknown;

const MOCK_RUNNERS: Record<string, MockRunner> = {
  "skill-question-structuring": (input: StructuringInput) => mockStructuring(input),
  "skill-task-decision": (input: TaskDecisionInput) => mockTaskDecision(input),
  "skill-process-explain": (input: ProcessExplainInput) => mockProcessExplain(input),
  "skill-policy-qa": (input: PolicyQaInput) => mockPolicyQa(input),
  "skill-reply-generation": (input: ReplyGenerationInput) => mockReplyGeneration(input),
  "skill-compliance-review": (input: ComplianceReviewInput) => mockComplianceReview(input),
};

export function isKnownSkillId(skillId: string): boolean {
  return skillId in MOCK_RUNNERS;
}

/** Generic fallback for user-created Skills that have no dedicated pipeline logic yet. */
function genericMockRunner(input: Record<string, unknown>) {
  return {
    note: "该 Skill 未内置专用 Mock 逻辑,以下为通用模拟输出,仅用于演示 Mock 模式可正常返回结果。",
    echoed_input: input,
    generated_at: new Date().toISOString(),
  };
}

async function runWithSkill(
  skill: Skill,
  input: Record<string, unknown>,
): Promise<SkillRunResult> {
  const mockFn = MOCK_RUNNERS[skill.id] ?? genericMockRunner;

  if (isLLMConfigured()) {
    const userPrompt = `以下是本次调用的输入数据(JSON):\n${JSON.stringify(
      input,
      null,
      2,
    )}\n\n请严格按 Prompt 中约定的 JSON 结构输出结果,不要输出多余文字。`;

    const result = await callLLM({
      systemPrompt: skill.prompt,
      userPrompt,
      model: skill.model_params.model,
      temperature: skill.model_params.temperature,
      max_tokens: skill.model_params.max_tokens,
    });

    if (result.ok) {
      const parsed = extractJson<unknown>(result.text);
      if (parsed !== null && typeof parsed === "object") {
        return { output: parsed, mocked: false };
      }
      return {
        output: mockFn(input),
        mocked: true,
        mock_reason: "LLM 返回内容无法解析为 JSON,已使用 Mock 模式",
      };
    }

    return { output: mockFn(input), mocked: true, mock_reason: result.reason };
  }

  return {
    output: mockFn(input),
    mocked: true,
    mock_reason: "LLM 未配置,已使用 Mock 模式",
  };
}

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
