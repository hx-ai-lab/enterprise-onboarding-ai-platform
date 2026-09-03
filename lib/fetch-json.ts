/**
 * Parses a fetch Response as JSON without ever throwing "Unexpected end of
 * JSON input" on an empty/non-JSON body (e.g. a platform-level 500 with no
 * payload). Throws a normal Error with a readable message instead, so
 * callers can keep doing `catch (e) { setError(e.message) }`.
 */
export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // body wasn't valid JSON — fall through, handled below
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : undefined) ??
      (text ? text.slice(0, 200) : `请求失败(状态码 ${res.status})`);
    throw new Error(message);
  }

  if (data === null) {
    throw new Error("服务器返回了空响应,请重试");
  }

  return data as T;
}
