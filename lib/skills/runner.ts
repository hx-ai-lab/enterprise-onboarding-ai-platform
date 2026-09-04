import { getSkillById } from "@/lib/data/skills";
import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import {
  callLLM,
  extractJson,
  isLLMConfigured,
  type LLMCallMetadata,
  type LLMFailureType,
} from "@/lib/llm";
import { validateSkillOutput } from "@/lib/skills/contracts";
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
  execution_mode: "llm" | "mock";
  mock_reason?: string;
  llm_failure_type?: LLMFailureType | "parse_error" | "schema_validation_error";
  validation_error_summary?: string;
} & LLMCallMetadata;

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

  function validatedMock(
    reason: string,
    diagnostics: Omit<SkillRunResult, "output" | "mocked" | "execution_mode" | "mock_reason"> = {},
  ): SkillRunResult {
    const output = mockFn(input);
    const validation = validateSkillOutput(skill.id, output);
    if (!validation.ok) {
      throw new Error(`内置 Mock 输出不符合 Skill 契约: ${validation.summary}`);
    }
    return {
      output,
      mocked: true,
      execution_mode: "mock",
      mock_reason: reason,
      ...diagnostics,
    };
  }

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
      if (parsed === null) {
        return validatedMock("LLM 返回内容无法解析为 JSON,已使用 Mock 模式", {
          llm_failure_type: "parse_error",
          provider_status: result.provider_status,
          finish_reason: result.finish_reason,
          response_content_type: result.response_content_type,
          provider_request_id: result.provider_request_id,
        });
      }
      const validation = validateSkillOutput(skill.id, parsed);
      if (!validation.ok) {
        return validatedMock("LLM 返回 JSON 不符合 Skill 输出契约,已使用 Mock 模式", {
          llm_failure_type: "schema_validation_error",
          validation_error_summary: validation.summary,
          provider_status: result.provider_status,
          finish_reason: result.finish_reason,
          response_content_type: result.response_content_type,
          provider_request_id: result.provider_request_id,
        });
      }
      return {
        output: parsed,
        mocked: false,
        execution_mode: "llm",
        provider_status: result.provider_status,
        finish_reason: result.finish_reason,
        response_content_type: result.response_content_type,
        provider_request_id: result.provider_request_id,
      };
    }

    return validatedMock(result.reason, {
      llm_failure_type: result.failure_type,
      provider_status: result.provider_status,
      finish_reason: result.finish_reason,
      response_content_type: result.response_content_type,
      provider_request_id: result.provider_request_id,
    });
  }

  return validatedMock("LLM 未配置,已使用 Mock 模式", { llm_failure_type: "not_configured" });
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
