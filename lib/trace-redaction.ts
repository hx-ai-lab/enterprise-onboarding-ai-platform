const SECRET_KEY = /authorization|api[-_]?key|secret|password|passwd|token|cookie/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?<!\d)(?:\+?86[- ]?)?1\d{2}[- ]?\d{4}[- ]?\d{4}(?!\d)/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const NAMED_SECRET = /\b(?:api[-_]?key|secret|token|authorization)\s*[:=]\s*[^\s,;]+/gi;

export function redactText(value: string): string {
  return value
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(NAMED_SECRET, (match) => `${match.split(/[:=]/, 1)[0]}=[REDACTED]`)
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .replace(PHONE, "[REDACTED_PHONE]");
}

/** Produces a JSON-safe copy suitable for persistent traces. */
export function redactTraceValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redactTraceValue(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY.test(key) ? "[REDACTED]" : redactTraceValue(item, seen),
    ]),
  );
}
