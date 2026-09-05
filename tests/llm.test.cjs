/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const {
  callLLM,
  extractJson,
  extractMessageContent,
} = require("../.test-dist/lib/llm.js");

const originalFetch = global.fetch;
const originalEnv = {
  LLM_API_KEY: process.env.LLM_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  LLM_BASE_URL: process.env.LLM_BASE_URL,
  LLM_MODEL: process.env.LLM_MODEL,
};

beforeEach(() => {
  process.env.LLM_API_KEY = "test-key-never-logged";
  process.env.LLM_BASE_URL = "https://provider.invalid/v1";
  delete process.env.OPENAI_API_KEY;
  delete process.env.LLM_MODEL;
});

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("extractJson supports standard, fenced, and prefixed JSON", () => {
  assert.deepEqual(extractJson('{"reply":"ok"}'), { reply: "ok" });
  assert.deepEqual(extractJson('```json\n{"reply":"ok"}\n```'), { reply: "ok" });
  assert.deepEqual(extractJson('Result:\n{"reply":"ok"}\nDone.'), { reply: "ok" });
  assert.equal(extractJson("not json"), null);
});

test("extractMessageContent supports strings and text content parts", () => {
  assert.deepEqual(
    extractMessageContent({ choices: [{ message: { content: "answer" } }] }),
    { ok: true, text: "answer", contentType: "string" },
  );
  assert.deepEqual(
    extractMessageContent({
      choices: [{ message: { content: [{ type: "text", text: "one" }, { type: "output_text", text: "two" }] } }],
    }),
    { ok: true, text: "one\ntwo", contentType: "array" },
  );
});

test("extractMessageContent classifies missing, null, empty, and unsupported content", () => {
  assert.equal(extractMessageContent({}).contentType, "missing");
  assert.equal(extractMessageContent({ choices: [{ message: {} }] }).contentType, "missing");
  assert.equal(extractMessageContent({ choices: [{ message: { content: null } }] }).contentType, "null");
  assert.equal(extractMessageContent({ choices: [{ message: { content: "  " } }] }).contentType, "empty");
  assert.equal(extractMessageContent({ choices: [{ message: { content: 12 } }] }).contentType, "unsupported");
});

test("callLLM returns safe success metadata", async () => {
  global.fetch = async () => new Response(
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{\"reply\":\"ok\"}" } }] }),
    { status: 200, headers: { "x-request-id": "req-safe-123" } },
  );
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, true);
  assert.equal(result.finish_reason, "stop");
  assert.equal(result.provider_request_id, "req-safe-123");
  assert.equal(result.response_content_type, "string");
});

test("callLLM classifies and redacts HTTP errors", async () => {
  global.fetch = async () => new Response(
    "Authorization: Bearer top-secret-token api_key=another-secret user@example.com 13900001001",
    { status: 429 },
  );
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, false);
  assert.equal(result.failure_type, "http_error");
  assert.equal(result.provider_status, 429);
  assert.doesNotMatch(result.reason, /top-secret|another-secret|user@example|13900001001/);
});

test("callLLM distinguishes response JSON errors and keeps a redacted sample of the raw body", async () => {
  global.fetch = async () => new Response("not-json", { status: 200 });
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, false);
  assert.equal(result.failure_type, "response_json_error");
  assert.equal(result.raw_response_sample, "not-json");
});

test("callLLM's raw_response_sample on a non-JSON body is redacted and length-capped", async () => {
  const secretLaced = `<html>Bearer super-secret-token api_key=another-secret ${"x".repeat(600)}</html>`;
  global.fetch = async () => new Response(secretLaced, { status: 200 });
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, false);
  assert.equal(result.failure_type, "response_json_error");
  assert.ok(result.raw_response_sample.length <= 500);
  assert.doesNotMatch(result.raw_response_sample, /super-secret-token|another-secret/);
});

test("a raw_response_sample is never present on a successful call or any other failure type", async () => {
  global.fetch = async () => new Response(
    JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "{\"reply\":\"ok\"}" } }] }),
    { status: 200 },
  );
  const ok = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(ok.raw_response_sample, undefined);

  global.fetch = async () => new Response("server exploded", { status: 500 });
  const httpError = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(httpError.failure_type, "http_error");
  assert.equal(httpError.raw_response_sample, undefined);
});

test("callLLM surfaces safe diagnostics (model, endpoint_host, usage incl. reasoning_tokens) on success", async () => {
  global.fetch = async () => new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"reply":"ok"}' } }],
      usage: {
        prompt_tokens: 200,
        completion_tokens: 50,
        total_tokens: 250,
        completion_tokens_details: { reasoning_tokens: 30 },
      },
    }),
    { status: 200 },
  );
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user", model: "o1-mini" });
  assert.equal(result.ok, true);
  assert.equal(result.model, "o1-mini");
  assert.equal(result.endpoint_host, "provider.invalid");
  assert.equal(result.content_length, '{"reply":"ok"}'.length);
  assert.deepEqual(result.usage, {
    prompt_tokens: 200,
    completion_tokens: 50,
    total_tokens: 250,
    reasoning_tokens: 30,
  });
  assert.deepEqual(result.response_shape.message_keys, ["role", "content"]);
});

test("callLLM reproduces the production symptom: HTTP 200, finish_reason=length, empty content, with reasoning_tokens visible in usage", async () => {
  global.fetch = async () => new Response(
    JSON.stringify({
      choices: [{ finish_reason: "length", message: { role: "assistant", content: "" } }],
      usage: {
        prompt_tokens: 300,
        completion_tokens: 900,
        total_tokens: 1200,
        completion_tokens_details: { reasoning_tokens: 900 },
      },
    }),
    { status: 200 },
  );
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, false);
  assert.equal(result.failure_type, "empty_content");
  assert.equal(result.finish_reason, "length");
  assert.equal(result.response_content_type, "empty");
  assert.equal(result.content_length, 0);
  assert.equal(result.usage.reasoning_tokens, 900);
});

test("callLLM never treats a provider reasoning_content field as the answer", async () => {
  global.fetch = async () => new Response(
    JSON.stringify({
      choices: [{
        finish_reason: "length",
        message: { role: "assistant", reasoning_content: "internal chain of thought...", content: "" },
      }],
    }),
    { status: 200 },
  );
  const result = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(result.ok, false);
  assert.equal(result.failure_type, "empty_content");
  assert.deepEqual(result.response_shape.message_keys, ["role", "reasoning_content", "content"]);
});

test("callLLM classifies timeout separately from network errors", async () => {
  global.fetch = async (_url, options) => new Promise((_, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
  const timeout = await callLLM({ systemPrompt: "system", userPrompt: "user", timeoutMs: 5 });
  assert.equal(timeout.ok, false);
  assert.equal(timeout.failure_type, "timeout");

  global.fetch = async () => { throw new TypeError("connection refused"); };
  const network = await callLLM({ systemPrompt: "system", userPrompt: "user" });
  assert.equal(network.ok, false);
  assert.equal(network.failure_type, "network_error");
});
