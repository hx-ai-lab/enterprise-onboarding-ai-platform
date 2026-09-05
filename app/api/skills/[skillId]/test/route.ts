import { NextResponse } from "next/server";
import { capabilityErrorResponse, jsonError, parseJsonBody, storageErrorResponse } from "@/lib/api-utils";
import { getEmployeeById, getEmployees } from "@/lib/data/reference-data";
import { getSkillById, setSkillLastTest } from "@/lib/data/skills";
import { buildSkillTestInput } from "@/lib/skills/test-harness";
import { runSkill } from "@/lib/skills/runner";
import { redactTraceValue } from "@/lib/trace-redaction";

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
    const safeInput = redactTraceValue(input);
    const safeOutput = redactTraceValue(result.output);
    const inputStr = JSON.stringify(safeInput, null, 2);
    const outputStr = JSON.stringify(safeOutput, null, 2);

    await setSkillLastTest(skillId, { input: inputStr, output: outputStr, tested_at });

    return NextResponse.json({
      input: safeInput,
      output: safeOutput,
      mocked: result.mocked,
      execution_mode: result.execution_mode,
      mock_reason: result.mock_reason,
      llm_failure_type: result.llm_failure_type,
      provider_status: result.provider_status,
      finish_reason: result.finish_reason,
      response_content_type: result.response_content_type,
      provider_request_id: result.provider_request_id,
      validation_error_summary: result.validation_error_summary,
      llm_retry_attempted: result.llm_retry_attempted,
      model: result.model,
      endpoint_host: result.endpoint_host,
      content_length: result.content_length,
      usage: result.usage,
      response_shape: result.response_shape,
      raw_response_sample: result.raw_response_sample,
      tested_at,
    });
  } catch (err) {
    const mapped = capabilityErrorResponse(err);
    if (mapped) return mapped;
    try {
      return storageErrorResponse(err);
    } catch {
      // Not a storage error; preserve the test endpoint's existing message below.
    }
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(500, `测试执行失败:${message}`);
  }
}
