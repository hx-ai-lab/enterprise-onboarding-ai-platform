import { NextResponse } from "next/server";
import { jsonError, parseJsonBody } from "@/lib/api-utils";
import { getAgentById } from "@/lib/data/agents";
import { appendLog } from "@/lib/data/logs";
import { getEmployees } from "@/lib/data/reference-data";
import { runAgent } from "@/lib/executor";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const { agentId } = await params;
  const agent = await getAgentById(agentId);
  if (!agent) return jsonError(404, `未找到 Agent:${agentId}`);
  if (!agent.enabled) return jsonError(409, `Agent「${agent.name}」当前已被禁用,拒绝运行。`);

  const body = await parseJsonBody<{ employee_id?: string; question?: string }>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  const question = body.question?.trim();
  if (!question) return jsonError(400, "请输入问题后再运行");

  const employees = await getEmployees();
  const employee = employees.find((e) => e.id === body.employee_id);
  if (!employee) return jsonError(400, "请选择一个有效的模拟员工身份");

  const result = await runAgent({ agent, employee, allEmployees: employees, question });

  // The run itself already succeeded (or failed) by this point — a logging
  // failure is a side effect we don't want to lose the actual result over.
  let logId: string | null = null;
  try {
    const log = await appendLog({
      agent_id: agent.id,
      agent_name: agent.name,
      employee_id: employee.id,
      employee_name: employee.name,
      question,
      plan: result.plan,
      steps: result.steps,
      final_reply: result.final_reply,
      compliance: result.compliance,
      status: result.status,
      error: result.error,
      duration_ms: result.duration_ms,
    });
    logId = log.id;
  } catch (err) {
    console.error("[agents/run] failed to write execution log:", err);
  }

  return NextResponse.json({ ...result, log_id: logId, employee });
}
