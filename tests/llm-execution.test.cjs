/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");
const { runWithSkill } = require("../.test-dist/lib/skills/llm-execution.js");

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

const skill = {
  id: "skill-reply-generation",
  name: "入职沟通话术生成 Skill",
  description: "test",
  prompt: "system prompt",
  model_params: { model: "gpt-4o-mini", temperature: 0.6, max_tokens: 900 },
  enabled: true,
  last_test: null,
  created_at: "2026-08-15T02:00:00.000Z",
  updated_at: "2026-08-15T02:00:00.000Z",
};

function chatResponse({ content, finish_reason }, init = {}) {
  return new Response(
    JSON.stringify({ choices: [{ finish_reason, message: { content } }] }),
    { status: 200, ...init },
  );
}

const testInput = {
  question: "test",
  employee: { name: "张三", department: "研发部", position: "工程师" },
};

test("finish_reason=stop with valid JSON succeeds without retry, no second call", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return chatResponse({ content: '{"reply":"你好,欢迎入职"}', finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 1);
  assert.equal(result.mocked, false);
  assert.equal(result.execution_mode, "llm");
  assert.equal(result.llm_failure_type, undefined);
  assert.equal(result.llm_retry_attempted, undefined);
  assert.deepEqual(result.output, { reply: "你好,欢迎入职" });
});

test("finish_reason=length with truncated JSON and a failed retry falls back to Mock as truncated_output", async () => {
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    if (calls === 1) {
      assert.equal(body.max_tokens, 900);
      return chatResponse({ content: '{"reply":"这是一段被截断的回复,还没有说完', finish_reason: "length" });
    }
    // Retry: strict suffix appended, higher max_tokens, still truncated.
    assert.match(body.messages[1].content, /Return only the complete JSON object/);
    assert.equal(body.max_tokens, 1350);
    return chatResponse({ content: '{"reply":"仍然被截断,没有闭合括号', finish_reason: "length" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 2);
  assert.equal(result.mocked, true);
  assert.equal(result.execution_mode, "mock");
  assert.equal(result.llm_failure_type, "truncated_output");
  assert.equal(result.llm_retry_attempted, true);
  assert.equal(result.finish_reason, "length");
});

test("finish_reason=length with truncated JSON succeeds after one retry", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return chatResponse({ content: '{"reply":"这是一段被截断的回复,还没有说完', finish_reason: "length" });
    }
    return chatResponse({ content: '{"reply":"这是重试后完整返回的回复内容"}', finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 2);
  assert.equal(result.mocked, false);
  assert.equal(result.execution_mode, "llm");
  assert.equal(result.llm_failure_type, undefined);
  assert.equal(result.llm_retry_attempted, true);
  assert.deepEqual(result.output, { reply: "这是重试后完整返回的回复内容" });
});

test("retry still runs schema validation — a retry that parses but fails the contract falls back to Mock", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return chatResponse({ content: '{"reply":"被截断的回复还没结', finish_reason: "length" });
    }
    // Parses fine but the wrong shape for skill-reply-generation (missing "reply").
    return chatResponse({ content: '{"final_reply":"字段名不对"}', finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 2);
  assert.equal(result.mocked, true);
  assert.equal(result.execution_mode, "mock");
  assert.equal(result.llm_failure_type, "schema_validation_error");
  assert.equal(result.llm_retry_attempted, true);
});

test("a non-length parse failure never triggers a retry", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return chatResponse({ content: "抱歉,我无法以 JSON 格式作答。", finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 1);
  assert.equal(result.mocked, true);
  assert.equal(result.llm_failure_type, "parse_error");
  assert.equal(result.llm_retry_attempted, undefined);
});

// Reproduces the production symptom: HTTP 200, finish_reason=length, but
// message.content is "" — a reasoning-capable model spending the entire
// max_tokens budget on internal reasoning before any visible answer token.
// Previously this short-circuited straight to Mock via the !result.ok
// branch with no retry at all.
test("finish_reason=length with empty message.content succeeds after one retry with a much larger budget", async () => {
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls += 1;
    const body = JSON.parse(options.body);
    if (calls === 1) {
      assert.equal(body.max_tokens, 900);
      return chatResponse({ content: "", finish_reason: "length" });
    }
    assert.match(body.messages[1].content, /Return only the complete JSON object/);
    // Empty-content truncation gets the larger of the two retry budgets (3x, not 1.5x).
    assert.equal(body.max_tokens, 2700);
    return chatResponse({ content: '{"reply":"重试后终于拿到完整回复"}', finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 2);
  assert.equal(result.mocked, false);
  assert.equal(result.execution_mode, "llm");
  assert.equal(result.llm_failure_type, undefined);
  assert.equal(result.llm_retry_attempted, true);
  assert.deepEqual(result.output, { reply: "重试后终于拿到完整回复" });
});

test("finish_reason=length with empty content on both attempts falls back to Mock as truncated_output, not empty_content", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return chatResponse({ content: "", finish_reason: "length" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 2);
  assert.equal(result.mocked, true);
  assert.equal(result.execution_mode, "mock");
  assert.equal(result.llm_failure_type, "truncated_output");
  assert.equal(result.llm_retry_attempted, true);
});

test("empty content with finish_reason=stop is a different bug (not a budget problem) and is never retried", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return chatResponse({ content: "", finish_reason: "stop" });
  };

  const result = await runWithSkill(skill, testInput);

  assert.equal(calls, 1);
  assert.equal(result.mocked, true);
  assert.equal(result.llm_failure_type, "empty_content");
  assert.equal(result.llm_retry_attempted, undefined);
});

// Cross-Skill regression: the reported bug hit "入职任务决策 Skill" and
// "入职流程解释 Skill" identically, which is exactly what's expected if the
// bug lives in the shared LLM call layer rather than any one Skill's
// prompt/contract. Prove the fix generalizes across distinct Skills (task
// decision, process explain, policy QA) with their own real output
// contracts, not just skill-reply-generation.
const CROSS_SKILL_CASES = [
  {
    skill: {
      id: "skill-task-decision",
      name: "入职任务决策 Skill",
      description: "test",
      prompt: "system prompt",
      model_params: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1100 },
      enabled: true,
      last_test: null,
      created_at: "2026-08-15T02:00:00.000Z",
      updated_at: "2026-08-15T02:00:00.000Z",
    },
    input: { employee: { department: "研发部", position: "工程师", onboarding_stage: "first_week" }, tasks: [] },
    validJson: '{"summary":"暂无待办任务","recommended_tasks":[]}',
  },
  {
    skill: {
      id: "skill-process-explain",
      name: "入职流程解释 Skill",
      description: "test",
      prompt: "system prompt",
      model_params: { model: "gpt-4o-mini", temperature: 0.4, max_tokens: 1200 },
      enabled: true,
      last_test: null,
      created_at: "2026-08-15T02:00:00.000Z",
      updated_at: "2026-08-15T02:00:00.000Z",
    },
    input: { tasks: [] },
    validJson: '{"steps":[],"notes":"当前系统未查询到相关入职任务数据"}',
  },
  {
    skill: {
      id: "skill-policy-qa",
      name: "制度与知识问答 Skill",
      description: "test",
      prompt: "system prompt",
      model_params: { model: "gpt-4o-mini", temperature: 0.2, max_tokens: 800 },
      enabled: true,
      last_test: null,
      created_at: "2026-08-15T02:00:00.000Z",
      updated_at: "2026-08-15T02:00:00.000Z",
    },
    input: { question: "test", policies: [] },
    validJson: '{"answer":"当前系统未查询到相关制度信息","matched_policies":[],"found":false}',
  },
];

for (const { skill: crossSkill, input: crossInput, validJson } of CROSS_SKILL_CASES) {
  test(`[${crossSkill.id}] empty content + finish_reason=length retries and succeeds`, async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return chatResponse(
        calls === 1 ? { content: "", finish_reason: "length" } : { content: validJson, finish_reason: "stop" },
      );
    };

    const result = await runWithSkill(crossSkill, crossInput);

    assert.equal(calls, 2);
    assert.equal(result.mocked, false);
    assert.equal(result.execution_mode, "llm");
    assert.equal(result.llm_retry_attempted, true);
    assert.equal(result.llm_failure_type, undefined);
  });

  test(`[${crossSkill.id}] empty content + finish_reason=length still empty after retry -> truncated_output Mock fallback`, async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return chatResponse({ content: "", finish_reason: "length" });
    };

    const result = await runWithSkill(crossSkill, crossInput);

    assert.equal(calls, 2);
    assert.equal(result.mocked, true);
    assert.equal(result.execution_mode, "mock");
    assert.equal(result.llm_failure_type, "truncated_output");
  });
}

test("a successful real-LLM run carries safe diagnostics: model, endpoint_host, content_length, usage", async () => {
  global.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"reply":"ok"}' } }],
        usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
      }),
      { status: 200 },
    );

  const result = await runWithSkill(skill, testInput);

  assert.equal(result.mocked, false);
  assert.equal(result.model, "gpt-4o-mini");
  assert.equal(result.endpoint_host, "provider.invalid");
  assert.equal(result.content_length, '{"reply":"ok"}'.length);
  assert.deepEqual(result.usage, {
    prompt_tokens: 120,
    completion_tokens: 40,
    total_tokens: 160,
    reasoning_tokens: undefined,
  });
  assert.deepEqual(result.response_shape?.message_keys, ["role", "content"]);
});
