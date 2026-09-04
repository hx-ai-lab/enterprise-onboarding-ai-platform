import { NextResponse } from "next/server";
import { jsonError, parseJsonBody, storageErrorResponse } from "@/lib/api-utils";
import { getAgentById } from "@/lib/data/agents";
import { appendLog } from "@/lib/data/logs";
import { getEmployees } from "@/lib/data/reference-data";
import { runAgent } from "@/lib/executor";
import { redactTraceValue } from "@/lib/trace-redaction";

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

  // A run is complete only after its trace has been persisted. Storage errors
  // propagate to the route error boundary instead of reporting false success.
  let log;
  try {
    log = await appendLog({
      agent_id: agent.id,
      agent_name: agent.name,
      employee_id: employee.id,
      employee_name: employee.name,
      question: redactTraceValue(question) as string,
      plan: result.plan,
      steps: result.steps,
      final_reply: redactTraceValue(result.final_reply) as string | null,
      compliance: redactTraceValue(result.compliance) as typeof result.compliance,
      status: result.status,
      error: result.error,
      duration_ms: result.duration_ms,
    });
  } catch (err) {
    return storageErrorResponse(err);
  }

  return NextResponse.json({ ...result, log_id: log.id, employee });
}
