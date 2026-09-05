// Minimal client for an OpenAI-compatible chat-completions endpoint. The
// response adapter is intentionally conservative: it supports the standard
// message content shapes but does not treat provider reasoning as an answer.

import { redactText } from "./trace-redaction";

export type LLMCallParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  /** Primarily useful for tests; production defaults to 15 seconds. */
  timeoutMs?: number;
};

export type LLMFailureType =
  | "not_configured"
  | "http_error"
  | "timeout"
  | "network_error"
  | "response_json_error"
  | "response_shape_error"
  | "empty_content";

export type ResponseContentType =
  | "string"
  | "array"
  | "missing"
  | "null"
  | "empty"
  | "unsupported";

export type LLMUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /** Present on reasoning-capable models (e.g. o1/o3/gpt-5-thinking-style APIs) that report a separate reasoning-token count under usage.completion_tokens_details. */
  reasoning_tokens?: number;
};

export type LLMResponseShape = {
  top_level_keys?: string[];
  message_keys?: string[];
};

export type LLMCallMetadata = {
  provider_status?: number;
  finish_reason?: string;
  response_content_type?: ResponseContentType;
  provider_request_id?: string;
  /** Safe-to-display request/response diagnostics — never includes secrets. */
  model?: string;
  endpoint_host?: string;
  content_length?: number;
  usage?: LLMUsage;
  response_shape?: LLMResponseShape;
  /** Redacted, length-capped snippet of the raw HTTP body — only ever set when it couldn't be parsed as JSON at all (see failure_type "response_json_error"), so the shape can be diagnosed instead of discarded. */
  raw_response_sample?: string;
};

export type LLMCallResult =
  | ({ ok: true; text: string } & LLMCallMetadata)
  | ({ ok: false; failure_type: LLMFailureType; reason: string } & LLMCallMetadata);

const TIMEOUT_MS = 15_000;
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

function resolveApiKey(): string | undefined {
  const raw = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function resolveBaseUrl(): string | undefined {
  const raw = process.env.LLM_BASE_URL?.trim();
  return raw || (resolveApiKey() ? OPENAI_DEFAULT_BASE_URL : undefined);
}

export function isLLMConfigured(): boolean {
  return Boolean(resolveApiKey() && resolveBaseUrl());
}

function safeRequestId(headers: Headers): string | undefined {
  const value =
    headers.get("x-request-id") ??
    headers.get("request-id") ??
    headers.get("openai-request-id") ??
    headers.get("cf-ray");
  if (!value) return undefined;
  const sanitized = value.trim().slice(0, 128);
  return /^[a-zA-Z0-9._:/-]+$/.test(sanitized) ? sanitized : undefined;
}

type ContentExtraction =
  | { ok: true; text: string; contentType: "string" | "array" }
  | {
      ok: false;
      failureType: "response_shape_error" | "empty_content";
      contentType: Exclude<ResponseContentType, "string">;
      reason: string;
    };

/** Extracts only final-answer text. Provider-specific reasoning fields are ignored. */
export function extractMessageContent(payload: unknown): ContentExtraction {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      failureType: "response_shape_error",
      contentType: "unsupported",
      reason: "LLM 响应顶层结构不是对象",
    };
  }

  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return {
      ok: false,
      failureType: "response_shape_error",
      contentType: "missing",
      reason: "LLM 响应缺少非空 choices",
    };
  }
  const first = choices[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    return {
      ok: false,
      failureType: "response_shape_error",
      contentType: "unsupported",
      reason: "LLM 响应的首个 choice 结构不受支持",
    };
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return {
      ok: false,
      failureType: "response_shape_error",
      contentType: "missing",
      reason: "LLM 响应缺少 choices[0].message",
    };
  }
  if (!("content" in message)) {
    return {
      ok: false,
      failureType: "response_shape_error",
      contentType: "missing",
      reason: "LLM 响应缺少 choices[0].message.content",
    };
  }

  const content = (message as { content: unknown }).content;
  if (content === null) {
    return {
      ok: false,
      failureType: "empty_content",
      contentType: "null",
      reason: "LLM 响应的 message.content 为 null",
    };
  }
  if (typeof content === "string") {
    if (!content.trim()) {
      return {
        ok: false,
        failureType: "empty_content",
        contentType: "empty",
        reason: "LLM 响应的 message.content 为空",
      };
    }
    return { ok: true, text: content, contentType: "string" };
  }
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object" || Array.isArray(part)) continue;
      const candidate = part as { type?: unknown; text?: unknown };
      if (
        (candidate.type === "text" || candidate.type === "output_text") &&
        typeof candidate.text === "string" &&
        candidate.text.trim()
      ) {
        textParts.push(candidate.text);
      }
    }
    if (textParts.length === 0) {
      return {
        ok: false,
        failureType: "empty_content",
        contentType: "array",
        reason: "LLM 响应的 content-parts 数组中没有非空文本",
      };
    }
    return { ok: true, text: textParts.join("\n"), contentType: "array" };
  }
  return {
    ok: false,
    failureType: "response_shape_error",
    contentType: "unsupported",
    reason: "LLM 响应的 message.content 类型不受支持",
  };
}

function safeFinishReason(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return undefined;
  const value = (choices[0] as { finish_reason?: unknown }).finish_reason;
  return typeof value === "string" ? redactText(value).slice(0, 64) : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Token accounting only — never touches message content, so nothing here needs redaction. */
function safeUsage(payload: unknown): LLMUsage | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return undefined;
  const u = usage as Record<string, unknown>;
  const details = u.completion_tokens_details;
  const reasoning_tokens =
    details && typeof details === "object" && !Array.isArray(details)
      ? safeNumber((details as Record<string, unknown>).reasoning_tokens)
      : undefined;
  const result: LLMUsage = {
    prompt_tokens: safeNumber(u.prompt_tokens),
    completion_tokens: safeNumber(u.completion_tokens),
    total_tokens: safeNumber(u.total_tokens),
    reasoning_tokens,
  };
  return Object.values(result).some((v) => v !== undefined) ? result : undefined;
}

/** JSON key names only (schema shape, never values) — still run through redactText defensively. */
function safeKeyList(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const keys = Object.keys(value).slice(0, 20).map((k) => redactText(k).slice(0, 64));
  return keys.length > 0 ? keys : undefined;
}

function safeResponseShape(payload: unknown): LLMResponseShape | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const top_level_keys = safeKeyList(payload);
  const choices = (payload as { choices?: unknown }).choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    first && typeof first === "object" && !Array.isArray(first)
      ? (first as { message?: unknown }).message
      : undefined;
  const message_keys = safeKeyList(message);
  if (!top_level_keys && !message_keys) return undefined;
  return { top_level_keys, message_keys };
}

function safeEndpointHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
  }
}

export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const apiKey = resolveApiKey();
  const baseUrlRaw = resolveBaseUrl();
  if (!apiKey || !baseUrlRaw) {
    return {
      ok: false,
      failure_type: "not_configured",
      reason: "LLM 未配置,已使用 Mock 模式",
    };
  }

  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  const model = process.env.LLM_MODEL?.trim() || params.model || "gpt-4o-mini";
  const requestMetadata = { model, endpoint_host: safeEndpointHost(baseUrl) };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? TIMEOUT_MS);

  try {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: params.temperature ?? 0.3,
          max_tokens: params.max_tokens ?? 800,
          messages: [
            { role: "system", content: params.systemPrompt },
            { role: "user", content: params.userPrompt },
          ],
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
      return {
        ok: false,
        failure_type: timedOut ? "timeout" : "network_error",
        reason: timedOut
          ? "LLM 调用超时,已使用 Mock 模式"
          : `LLM 网络调用失败(${redactText(error instanceof Error ? error.message : String(error))}),已使用 Mock 模式`,
        ...requestMetadata,
      };
    }

    const metadata = {
      provider_status: res.status,
      provider_request_id: safeRequestId(res.headers),
      ...requestMetadata,
    };
    if (!res.ok) {
      const body = redactText(await res.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        failure_type: "http_error",
        reason: `LLM 接口返回错误状态 ${res.status}${body ? `:${body}` : ""},已使用 Mock 模式`,
        ...metadata,
      };
    }

    // Read as text first (not res.json()) so a parse failure still leaves a
    // sample of the raw body to diagnose — Response bodies are one-shot
    // streams, so once res.json() throws, the original bytes are gone for
    // good and every prior "response_json_error" carried zero information
    // about what the provider actually sent back.
    const rawBody = await res.text().catch(() => "");
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return {
        ok: false,
        failure_type: "response_json_error",
        reason: "LLM 响应不是合法 JSON,已使用 Mock 模式",
        raw_response_sample: redactText(rawBody).slice(0, 500),
        ...metadata,
      };
    }

    const finish_reason = safeFinishReason(json);
    const usage = safeUsage(json);
    const response_shape = safeResponseShape(json);
    const extracted = extractMessageContent(json);
    if (extracted.ok === false) {
      return {
        ok: false,
        failure_type: extracted.failureType,
        reason: `${extracted.reason},已使用 Mock 模式`,
        response_content_type: extracted.contentType,
        finish_reason,
        content_length: 0,
        usage,
        response_shape,
        ...metadata,
      };
    }
    return {
      ok: true,
      text: extracted.text,
      response_content_type: extracted.contentType,
      finish_reason,
      content_length: extracted.text.length,
      usage,
      response_shape,
      ...metadata,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Direct JSON, fenced JSON, then JSON surrounded by a small amount of text. */
export function extractJson<T>(text: string): T | null {
  const attempts: string[] = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());
  const braceMatch = text.match(/[{[][^]*[}\]]/);
  if (braceMatch) attempts.push(braceMatch[0]);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Continue to the next conservative extraction strategy.
    }
  }
  return null;
}
