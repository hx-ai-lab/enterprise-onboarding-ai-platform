/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { validateSkillOutput } = require("../.test-dist/lib/skills/contracts.js");

test("reply generation requires a non-empty reply", () => {
  assert.equal(validateSkillOutput("skill-reply-generation", { reply: "hello" }).ok, true);
  const missing = validateSkillOutput("skill-reply-generation", { final_reply: "wrong contract" });
  assert.equal(missing.ok, false);
  assert.match(missing.summary, /reply/);
});

test("compliance review rejects invalid risk enums", () => {
  const valid = {
    risk_level: "low",
    passed: true,
    issues: [],
    suggestions: [],
    final_reply: "safe",
  };
  assert.equal(validateSkillOutput("skill-compliance-review", valid).ok, true);
  const invalid = validateSkillOutput("skill-compliance-review", { ...valid, risk_level: "critical" });
  assert.equal(invalid.ok, false);
  assert.match(invalid.summary, /risk_level/);
});

test("valid JSON with the wrong Skill shape fails validation", () => {
  const result = validateSkillOutput("skill-task-decision", { recommended_actions: [], summary: "ok" });
  assert.equal(result.ok, false);
  assert.match(result.summary, /recommended_tasks/);
});
