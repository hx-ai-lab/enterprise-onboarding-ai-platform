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
  type LLMCallResult,
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

// Two different truncation signatures need two different retry budgets:
//  - "unparseable": the model got most of the way through the JSON and got
//    cut off — it's close, so a modest bump is enough.
//  - "empty": message.content came back "" with finish_reason "length" —
//    the entire max_tokens budget was consumed before any visible answer
//    token was emitted (the classic signature of a reasoning-capable model
//    spending it all on internal reasoning). A modest bump would likely be
//    swallowed the same way, so this needs a much larger jump to have any
//    chance of leaving room for a visible answer.
function retryMaxTokensForUnparseable(baseMaxTokens: number): number {
  return Math.min(Math.round(baseMaxTokens * 1.5), 4000);
}
function retryMaxTokensForEmpty(baseMaxTokens: number): number {
  return Math.min(Math.round(baseMaxTokens * 3), 8000);
}

/** Pulls the safe-to-display diagnostics off an LLMCallResult regardless of ok/failure branch. */
function pickMetadata(result: LLMCallResult): LLMCallMetadata {
  return {
    provider_status: result.provider_status,
    finish_reason: result.finish_reason,
    response_content_type: result.response_content_type,
    provider_request_id: result.provider_request_id,
    model: result.model,
    endpoint_host: result.endpoint_host,
    content_length: result.content_length,
    usage: result.usage,
    response_shape: result.response_shape,
  };
}

type TruncationKind = "empty" | "unparseable" | null;

/**
 * Both an empty message.content and a content string that doesn't close
 * into valid JSON are the same underlying failure — the provider hit
 * max_tokens before finishing the answer — as long as finish_reason
 * confirms it was actually a length cutoff. A response_shape_error (wrong
 * endpoint/API shape) or an empty answer with finish_reason "stop" (the
 * model deliberately said nothing) are different bugs and must not be
 * retried the same way.
 */
function classifyTruncation(result: LLMCallResult, parsed: unknown): TruncationKind {
  if (result.finish_reason !== "length") return null;
  if (!result.ok) return result.failure_type === "empty_content" ? "empty" : null;
  return parsed === null ? "unparseable" : null;
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
  const parsed = result.ok ? extractJson<unknown>(result.text) : null;

  if (result.ok && parsed !== null) {
    const validation = validateSkillOutput(skill.id, parsed);
    if (!validation.ok) {
      return validatedMock("LLM 返回 JSON 不符合 Skill 输出契约,已使用 Mock 模式", {
        llm_failure_type: "schema_validation_error",
        validation_error_summary: validation.summary,
        ...pickMetadata(result),
      });
    }
    return { output: parsed, mocked: false, execution_mode: "llm", ...pickMetadata(result) };
  }

  const truncation = classifyTruncation(result, parsed);
  if (truncation === null) {
    // Not a length-truncation scenario — no retry, classify and fall back directly.
    if (!result.ok) {
      return validatedMock(result.reason, { llm_failure_type: result.failure_type, ...pickMetadata(result) });
    }
    return validatedMock("LLM 返回内容无法解析为 JSON,已使用 Mock 模式", {
      llm_failure_type: "parse_error",
      ...pickMetadata(result),
    });
  }

  const retryResult = await callLLM({
    systemPrompt: skill.prompt,
    userPrompt: userPrompt + RETRY_STRICT_SUFFIX,
    model: skill.model_params.model,
    temperature: skill.model_params.temperature,
    max_tokens:
      truncation === "empty"
        ? retryMaxTokensForEmpty(skill.model_params.max_tokens)
        : retryMaxTokensForUnparseable(skill.model_params.max_tokens),
  });
  const retryParsed = retryResult.ok ? extractJson<unknown>(retryResult.text) : null;

  if (retryResult.ok && retryParsed !== null) {
    // Retry must still pass the same schema validator as a first-attempt
    // success — a retry that parses but doesn't match the contract is not a
    // real success.
    const retryValidation = validateSkillOutput(skill.id, retryParsed);
    if (!retryValidation.ok) {
      return validatedMock("LLM 重试后返回 JSON 仍不符合 Skill 输出契约,已使用 Mock 模式", {
        llm_failure_type: "schema_validation_error",
        validation_error_summary: retryValidation.summary,
        ...pickMetadata(retryResult),
        llm_retry_attempted: true,
      });
    }
    return {
      output: retryParsed,
      mocked: false,
      execution_mode: "llm",
      ...pickMetadata(retryResult),
      llm_retry_attempted: true,
    };
  }

  const retryTruncation = classifyTruncation(retryResult, retryParsed);
  const reason =
    retryTruncation !== null
      ? "LLM 输出因达到 token 上限被截断,重试后仍被截断,已使用 Mock 模式"
      : !retryResult.ok
        ? retryResult.reason
        : "LLM 重试后返回内容仍无法解析为 JSON,已使用 Mock 模式";
  const llm_failure_type =
    retryTruncation !== null ? "truncated_output" : !retryResult.ok ? retryResult.failure_type : "parse_error";

  return validatedMock(reason, {
    llm_failure_type,
    ...pickMetadata(retryResult),
    llm_retry_attempted: true,
  });
}
