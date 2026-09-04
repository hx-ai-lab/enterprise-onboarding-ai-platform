import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const stateFile = path.join(root, ".data", "runtime-state.json");
const namespace = `verify-${Date.now()}`;
let originalState = null;

try {
  originalState = await fs.readFile(stateFile);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function startServer(port, extraEnv) {
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      VERCEL: "",
      VERCEL_ENV: "",
      STORAGE_NAMESPACE: "",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  return { child, output: () => output };
}

async function waitUntilReady(baseUrl, server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.child.exitCode !== null) throw new Error(`Next.js exited early:\n${server.output()}`);
    try {
      await fetch(`${baseUrl}/api/employees`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Next.js did not become ready:\n${server.output()}`);
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  server.child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (server.child.exitCode === null) server.child.kill("SIGKILL");
}

async function json(baseUrl, pathname, init) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.json();
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${pathname}: ${response.status} ${body.error ?? ""}`);
  return body;
}

let server;
try {
  const baseUrl = "http://127.0.0.1:3217";
  server = startServer(3217, { STORAGE_NAMESPACE: namespace });
  await waitUntilReady(baseUrl, server);

  const initialAgents = await json(baseUrl, "/api/agents");
  if (!initialAgents.agents.some((agent) => agent.id === "agent-onboarding-assistant")) {
    throw new Error("Seed Agent was not loaded");
  }

  await json(baseUrl, "/api/agents/agent-onboarding-assistant", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ description: "verification override", enabled: true }),
  });
  const created = await json(baseUrl, "/api/agents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Verification Agent",
      description: "custom record",
      system_prompt: "Return a safe answer.",
      model_id: "demo",
      bound_skill_ids: [],
      bound_tool_ids: [],
      enabled: true,
    }),
  });
  await json(baseUrl, `/api/agents/${created.agent.id}`, { method: "DELETE" });
  const deletedCustom = await fetch(`${baseUrl}/api/agents/${created.agent.id}`);
  if (deletedCustom.status !== 404) throw new Error("Custom delete did not persist");

  await json(baseUrl, "/api/tools/tool-query-trainings", { method: "DELETE" });
  const tools = await json(baseUrl, "/api/tools");
  if (tools.tools.some((tool) => tool.id === "tool-query-trainings")) {
    throw new Error("Seed tombstone was not applied");
  }

  await json(baseUrl, "/api/skills/skill-policy-qa/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "请假制度是什么", employee_id: "emp-001" }),
  });
  const testedSkill = await json(baseUrl, "/api/skills/skill-policy-qa");
  if (!testedSkill.skill.last_test?.tested_at) throw new Error("Skill last_test was not persisted");

  const run = await json(baseUrl, "/api/agents/agent-onboarding-assistant/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "IT 支持的联系方式是什么", employee_id: "emp-001" }),
  });
  const logs = await json(baseUrl, "/api/agents/agent-onboarding-assistant/logs");
  if (!logs.logs.some((log) => log.id === run.log_id && log.plan && log.steps)) {
    throw new Error("Run Log trace was not persisted or read back");
  }

  await stopServer(server);
  server = startServer(3217, { STORAGE_NAMESPACE: namespace });
  await waitUntilReady(baseUrl, server);
  const afterRestart = await json(baseUrl, "/api/agents/agent-onboarding-assistant");
  if (afterRestart.agent.description !== "verification override") {
    throw new Error("Seed override did not survive server restart");
  }
  await stopServer(server);

  const beforeFailClosed = await fs.readFile(stateFile, "utf-8");
  server = startServer(3218, { VERCEL_ENV: "preview" });
  await waitUntilReady("http://127.0.0.1:3218", server);
  const failClosed = await fetch("http://127.0.0.1:3218/api/agents");
  if (failClosed.status < 500) throw new Error("Preview silently fell back without Redis credentials");
  await stopServer(server);
  const afterFailClosed = await fs.readFile(stateFile, "utf-8");
  if (afterFailClosed !== beforeFailClosed) throw new Error("Preview fail-closed check wrote local fallback data");

  server = startServer(3219, {
    VERCEL_ENV: "preview",
    KV_REST_API_URL: "http://127.0.0.1:1",
    KV_REST_API_TOKEN: "verification-only-placeholder",
  });
  await waitUntilReady("http://127.0.0.1:3219", server);
  const unavailableRedis = await fetch("http://127.0.0.1:3219/api/agents");
  if (unavailableRedis.status < 500) throw new Error("Redis connection failure did not propagate to the API");
  await stopServer(server);

  console.log(
    "Storage verification passed: Seed/Override, Custom CRUD, Tombstone, Skill test, Run Log, restart, Redis errors, fail closed.",
  );
} finally {
  if (server) await stopServer(server);
  if (originalState) {
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, originalState);
  } else {
    await fs.rm(stateFile, { force: true });
  }
}
