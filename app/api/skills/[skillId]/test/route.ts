import { NextResponse } from "next/server";
import { capabilityErrorResponse, jsonError, parseJsonBody } from "@/lib/api-utils";
import { getEmployeeById, getEmployees } from "@/lib/data/reference-data";
import { getSkillById, setSkillLastTest } from "@/lib/data/skills";
import { buildSkillTestInput } from "@/lib/skills/test-harness";
import { runSkill } from "@/lib/skills/runner";

type RouteContext = { params: Promise<{ skillId: string }> };

export async function POST(req: Request, { params }: RouteContext) {
  const { skillId } = await params;
  const skill = await getSkillById(skillId);
  if (!skill) return jsonError(404, `未找到 Skill:${skillId}`);

  const body = await parseJsonBody<{ question?: string; employee_id?: string }>(req);
  if (!body) return jsonError(400, "请求体不是合法的 JSON");

  const question = body.question?.trim();
  if (!question) return jsonError(400, "测试输入不能为空");

  let employeeId = body.employee_id;
  if (employeeId) {
    const employee = await getEmployeeById(employeeId);
    if (!employee) return jsonError(400, `未找到员工:${employeeId}`);
  } else {
    const employees = await getEmployees();
    employeeId = employees[0]?.id;
    if (!employeeId) return jsonError(500, "系统中没有可用的模拟员工数据");
  }

  const input = await buildSkillTestInput(skillId, question, employeeId);

  try {
    const result = await runSkill(skillId, input);
    const tested_at = new Date().toISOString();
    const inputStr = JSON.stringify(input, null, 2);
    const outputStr = JSON.stringify(result.output, null, 2);

    await setSkillLastTest(skillId, { input: inputStr, output: outputStr, tested_at });

    return NextResponse.json({
      input,
      output: result.output,
      mocked: result.mocked,
      mock_reason: result.mock_reason,
      tested_at,
    });
  } catch (err) {
    const mapped = capabilityErrorResponse(err);
    if (mapped) return mapped;
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, `测试执行失败:${message}`);
  }
}
