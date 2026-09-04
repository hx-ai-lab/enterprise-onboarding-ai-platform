/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { redactText, redactTraceValue } = require("../.test-dist/lib/trace-redaction.js");

test("redacts secrets, authorization, emails, and phone numbers", () => {
  const text = redactText("Bearer abc.def api_key=secret user@example.com 139-0000-1001");
  assert.doesNotMatch(text, /abc\.def|secret|user@example|139-0000-1001/);
  assert.match(text, /REDACTED/);
});

test("redacts sensitive keys recursively without dropping useful metadata", () => {
  const safe = redactTraceValue({
    authorization: "Bearer hidden",
    nested: { apiKey: "hidden", email: "person@example.com", status: 429 },
  });
  assert.deepEqual(safe, {
    authorization: "[REDACTED]",
    nested: { apiKey: "[REDACTED]", email: "[REDACTED_EMAIL]", status: 429 },
  });
});
