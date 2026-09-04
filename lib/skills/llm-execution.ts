// Runs a Skill's real LLM call (or Mock fallback) given an already-resolved
// Skill object. Split out of runner.ts so this logic — the part that talks
// to the LLM, parses/validates JSON, and retries on truncation — can be
// unit-tested without pulling in the data/storage layer that resolves a
// Skill by id.

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
  llm_failure_type?: LLMFailureType | "parse_error" | "schema_validation_error" | "truncated_output";
  validation_error_summary?: string;
  /** true when the one-shot truncation retry below actually fired for this call */
  llm_retry_attempted?: boolean;
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

/** Appended to the retry prompt only — keeps the base prompt/contract untouched. */
const RETRY_STRICT_SUFFIX = "\n\nReturn only the complete JSON object. Do not include explanations.";

/** Modest bump for the one retry attempt; capped so a misconfigured Skill can't request an unbounded budget. */
function retryMaxTokens(baseMaxTokens: number): number {
  return Math.min(Math.round(baseMaxTokens * 1.5), 4000);
}

export async function runWithSkill(
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

  if (!isLLMConfigured()) {
    return validatedMock("LLM 未配置,已使用 Mock 模式", { llm_failure_type: "not_configured" });
  }

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

  if (!result.ok) {
    return validatedMock(result.reason, {
      llm_failure_type: result.failure_type,
      provider_status: result.provider_status,
      finish_reason: result.finish_reason,
      response_content_type: result.response_content_type,
      provider_request_id: result.provider_request_id,
    });
  }

  const parsed = extractJson<unknown>(result.text);
  if (parsed !== null) {
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

  // Parse failed. Only worth a retry when it's actually the truncation
  // scenario (finish_reason === "length") — anything else (e.g. the model
  // just answered in prose despite instructions) won't be fixed by asking
  // again with more room.
  if (result.finish_reason !== "length") {
    return validatedMock("LLM 返回内容无法解析为 JSON,已使用 Mock 模式", {
      llm_failure_type: "parse_error",
      provider_status: result.provider_status,
      finish_reason: result.finish_reason,
      response_content_type: result.response_content_type,
      provider_request_id: result.provider_request_id,
    });
  }

  const retryResult = await callLLM({
    systemPrompt: skill.prompt,
    userPrompt: userPrompt + RETRY_STRICT_SUFFIX,
    model: skill.model_params.model,
    temperature: skill.model_params.temperature,
    max_tokens: retryMaxTokens(skill.model_params.max_tokens),
  });

  if (!retryResult.ok) {
    return validatedMock(retryResult.reason, {
      llm_failure_type: retryResult.failure_type,
      provider_status: retryResult.provider_status,
      finish_reason: retryResult.finish_reason,
      response_content_type: retryResult.response_content_type,
      provider_request_id: retryResult.provider_request_id,
      llm_retry_attempted: true,
    });
  }

  const retryParsed = extractJson<unknown>(retryResult.text);
  if (retryParsed === null) {
    const stillTruncated = retryResult.finish_reason === "length";
    return validatedMock(
      stillTruncated
        ? "LLM 输出因达到 token 上限被截断,重试后仍被截断,已使用 Mock 模式"
        : "LLM 重试后返回内容仍无法解析为 JSON,已使用 Mock 模式",
      {
        llm_failure_type: stillTruncated ? "truncated_output" : "parse_error",
        provider_status: retryResult.provider_status,
        finish_reason: retryResult.finish_reason,
        response_content_type: retryResult.response_content_type,
        provider_request_id: retryResult.provider_request_id,
        llm_retry_attempted: true,
      },
    );
  }

  // Retry must still pass the same schema validator as a first-attempt
  // success — a retry that parses but doesn't match the contract is not a
  // real success.
  const retryValidation = validateSkillOutput(skill.id, retryParsed);
  if (!retryValidation.ok) {
    return validatedMock("LLM 重试后返回 JSON 仍不符合 Skill 输出契约,已使用 Mock 模式", {
      llm_failure_type: "schema_validation_error",
      validation_error_summary: retryValidation.summary,
      provider_status: retryResult.provider_status,
      finish_reason: retryResult.finish_reason,
      response_content_type: retryResult.response_content_type,
      provider_request_id: retryResult.provider_request_id,
      llm_retry_attempted: true,
    });
  }

  return {
    output: retryParsed,
    mocked: false,
    execution_mode: "llm",
    provider_status: retryResult.provider_status,
    finish_reason: retryResult.finish_reason,
    response_content_type: retryResult.response_content_type,
    provider_request_id: retryResult.provider_request_id,
    llm_retry_attempted: true,
  };
}
