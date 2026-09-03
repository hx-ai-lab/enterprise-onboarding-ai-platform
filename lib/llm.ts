// Thin client for an OpenAI-compatible chat completions endpoint, configured
// entirely via environment variables. Every caller must be able to fall back
// to a deterministic mock when the LLM is unconfigured or unreachable, so
// this module never throws — it always resolves to a tagged result.

export type LLMCallParams = {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export type LLMCallResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

const TIMEOUT_MS = 15_000;
const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

// LLM_API_KEY is the primary, provider-agnostic name (works with any
// OpenAI-compatible endpoint via LLM_BASE_URL); OPENAI_API_KEY is accepted
// as an alias so a plain OpenAI key works with zero extra config — when set
// without an explicit LLM_BASE_URL, requests go straight to OpenAI's API.
function resolveApiKey(): string | undefined {
  // Trim defensively: env vars pasted into a dashboard UI easily pick up a
  // trailing newline/space, which silently turns into an "invalid API key"
  // error from the provider that looks like a wrong key rather than whitespace.
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

export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  const apiKey = resolveApiKey();
  const baseUrlRaw = resolveBaseUrl();
  if (!apiKey || !baseUrlRaw) {
    return {
      ok: false,
      reason: "LLM 未配置(缺少 LLM_API_KEY / OPENAI_API_KEY),已使用 Mock 模式",
    };
  }

  const baseUrl = baseUrlRaw.replace(/\/+$/, "");
  // A deployment-level LLM_MODEL wins over a Skill's stored model_params.model:
  // every Skill (including all 6 built-ins) always has a concrete model value,
  // so treating it as higher priority than the env var made LLM_MODEL
  // effectively dead — switching providers via env vars alone (e.g. to a
  // non-OpenAI endpoint with different model names) would silently keep
  // sending the old model name from each Skill's stored config.
  const model = process.env.LLM_MODEL?.trim() || params.model || "gpt-4o-mini";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
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

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `LLM 接口返回错误状态 ${res.status}${body ? `:${body.slice(0, 200)}` : ""},已使用 Mock 模式`,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      return { ok: false, reason: "LLM 响应中未包含有效内容,已使用 Mock 模式" };
    }
    return { ok: true, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `LLM 调用异常(${message}),已使用 Mock 模式` };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Best-effort JSON extraction from an LLM text response: tries a direct
 * parse, then a ```json fenced block, then the first {...} / [...] span.
 */
export function extractJson<T>(text: string): T | null {
  const attempts: string[] = [text.trim()];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) attempts.push(fenced[1].trim());

  const braceMatch = text.match(/[{[][\s\S]*[}\]]/);
  if (braceMatch) attempts.push(braceMatch[0]);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try next candidate
    }
  }
  return null;
}
