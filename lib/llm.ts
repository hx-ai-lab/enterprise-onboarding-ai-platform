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

export function isLLMConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_BASE_URL);
}

export async function callLLM(params: LLMCallParams): Promise<LLMCallResult> {
  if (!isLLMConfigured()) {
    return {
      ok: false,
      reason: "LLM 未配置(缺少 LLM_API_KEY / LLM_BASE_URL),已使用 Mock 模式",
    };
  }

  const baseUrl = process.env.LLM_BASE_URL!.replace(/\/+$/, "");
  const apiKey = process.env.LLM_API_KEY!;
  const model = params.model || process.env.LLM_MODEL || "gpt-4o-mini";

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
