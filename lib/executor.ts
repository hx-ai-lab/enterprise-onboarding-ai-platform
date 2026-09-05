// Executor: runs a generated plan step by step against the real Tool/Skill
// implementations, wiring each step's input from prior steps' outputs, and
// drives the mandatory compliance-review retry loop before ever handing a
// reply back to the caller.

import { getSkills } from "@/lib/data/skills";
import { getTools } from "@/lib/data/tools";
import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import { generatePlan } from "@/lib/planner";
import {
  CONTACT_ROLE_BY_KEYWORD,
  type ComplianceReviewOutput,
  type PolicyQaOutput,
  type ProcessExplainOutput,
  type TaskDecisionOutput,
} from "@/lib/skills/mocks";
import { runSkill } from "@/lib/skills/runner";
import { runTool } from "@/lib/tools/runners";
import { redactTraceValue } from "@/lib/trace-redaction";
import type {
  Agent,
  ComplianceResult,
  Contact,
  Employee,
  ExecutionStep,
  OnboardingTask,
  PlanStep,
  Policy,
  RunStatus,
  Training,
} from "@/lib/types";

export type RunAgentParams = {
  agent: Agent;
  employee: Employee;
  allEmployees: Employee[];
  question: string;
};

export type RunAgentResult = {
  plan: PlanStep[];
  steps: ExecutionStep[];
  final_reply: string | null;
  compliance: ComplianceResult | null;
  status: RunStatus;
  error?: string;
  duration_ms: number;
};

const MAX_COMPLIANCE_ATTEMPTS = 2;

function employeeContext(e: Employee) {
  return { department: e.department, position: e.position, onboarding_stage: e.onboarding_stage };
}

function describeError(err: unknown): string {
  if (err instanceof CapabilityDisabledError || err instanceof CapabilityNotFoundError) {
    return String(redactTraceValue(err.message));
  }
  if (err instanceof Error) return String(redactTraceValue(err.message));
  return String(redactTraceValue(String(err)));
}

function stepBase(step: PlanStep) {
  return {
    step: step.step,
    type: step.type,
    capability_id: step.capability_id,
    capability_name: step.capability_name,
    purpose: step.purpose,
  };
}

export async function runAgent(params: RunAgentParams): Promise<RunAgentResult> {
  const start = Date.now();
  const { agent, employee, allEmployees, question } = params;

  const [allSkills, allTools] = await Promise.all([getSkills(), getTools()]);
  const boundSkillSet = new Set(agent.bound_skill_ids);
  const boundToolSet = new Set(agent.bound_tool_ids);
  const enabledSkillIds = new Set(
    allSkills.filter((s) => s.enabled && boundSkillSet.has(s.id)).map((s) => s.id),
  );
  const enabledToolIds = new Set(
    allTools.filter((t) => t.enabled && boundToolSet.has(t.id)).map((t) => t.id),
  );
  const skillNames = new Map(allSkills.map((s) => [s.id, s.name]));
  const toolNames = new Map(allTools.map((t) => [t.id, t.name]));

  const { plan, missing_essentials } = generatePlan({
    question,
    enabledSkillIds,
    enabledToolIds,
    skillNames,
    toolNames,
  });

  if (missing_essentials.length > 0) {
    const names = missing_essentials.map((s) => s.name).join("、");
    return {
      plan,
      steps: [],
      final_reply: null,
      compliance: null,
      status: "blocked",
      error: `该 Agent 缺少必须的核心能力(${names}),可能是未绑定或已被禁用。为保证合规安全,本次请求已中止,请在 Agent 详情页确认绑定关系,并在 Skills 管理页确认这些 Skill 已启用后重试。`,
      duration_ms: Date.now() - start,
    };
  }

  const toolCtx = { employeeId: employee.id };
  const steps: ExecutionStep[] = [];

  type StructuredResult = { keywords?: string[]; question_type?: string };
  type TasksToolResult = { found: boolean; tasks: OnboardingTask[] };
  type PoliciesToolResult = { found: boolean; policies: Policy[] };
  type ContactsToolResult = { found: boolean; contacts: Contact[] };
  type TrainingsToolResult = { found: boolean; trainings: Training[] };

  let structured: StructuredResult | null = null;
  let tasksResult: TasksToolResult | null = null;
  let policiesResult: PoliciesToolResult | null = null;
  let contactsResult: ContactsToolResult | null = null;
  let trainingsResult: TrainingsToolResult | null = null;
  let taskDecision: TaskDecisionOutput | null = null;
  let processExplain: ProcessExplainOutput | null = null;
  let policyQa: PolicyQaOutput | null = null;
  let draftReply: string | null = null;
  let replyGenFailed = false;

  async function execToolStep(step: PlanStep, input: Record<string, unknown>): Promise<unknown> {
    const t0 = Date.now();
    try {
      const output = await runTool(step.capability_id, input, toolCtx);
      steps.push({
        ...stepBase(step),
        status: "success",
        input: redactTraceValue(input),
        output: redactTraceValue(output),
        mocked: false,
        execution_mode: "tool",
        duration_ms: Date.now() - t0,
      });
      return output;
    } catch (err) {
      steps.push({
        ...stepBase(step),
        status: "error",
        input: redactTraceValue(input),
        output: null,
        error: describeError(err),
        mocked: false,
        execution_mode: "tool",
        duration_ms: Date.now() - t0,
      });
      return null;
    }
  }

  async function execSkillStep(
    step: PlanStep,
    input: Record<string, unknown>,
  ): Promise<{ output: unknown; ok: boolean }> {
    const t0 = Date.now();
    try {
      const result = await runSkill(step.capability_id, input);
      steps.push({
        ...stepBase(step),
        status: "success",
        input: redactTraceValue(input),
        output: redactTraceValue(result.output),
        note: result.mocked ? result.mock_reason : undefined,
        mocked: result.mocked,
        execution_mode: result.execution_mode,
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
        duration_ms: Date.now() - t0,
      });
      return { output: result.output, ok: true };
    } catch (err) {
      steps.push({
        ...stepBase(step),
        status: "error",
        input: redactTraceValue(input),
        output: null,
        error: describeError(err),
        mocked: false,
        execution_mode: "llm",
        duration_ms: Date.now() - t0,
      });
      return { output: null, ok: false };
    }
  }

  for (const step of plan) {
    switch (step.capability_id) {
      case "skill-question-structuring": {
        const input = { question, employee: employeeContext(employee) };
        const { output } = await execSkillStep(step, input);
        structured = output as StructuredResult | null;
        break;
      }
      case "tool-query-employee": {
        await execToolStep(step, {});
        break;
      }
      case "tool-query-tasks": {
        const output = await execToolStep(step, {});
        tasksResult = output as TasksToolResult | null;
        break;
      }
      case "tool-task-status-calc": {
        await execToolStep(step, {});
        break;
      }
      case "tool-query-policies": {
        const keyword = structured?.keywords?.[0] ?? question;
        const output = await execToolStep(step, { keyword });
        policiesResult = output as PoliciesToolResult | null;
        break;
      }
      case "tool-query-contacts": {
        // Resolve which role the question is actually asking about (IT/HR/
        // finance/...) instead of blindly scoping to the asker's own
        // department — "IT 支持的联系方式" from a Marketing employee must
        // still return the IT contact, not her own department head.
        const matchedRole = (structured?.keywords ?? [])
          .map((k) => CONTACT_ROLE_BY_KEYWORD[k])
          .find(Boolean);
        const input: Record<string, unknown> = matchedRole
          ? matchedRole === "部门负责人"
            ? { role: matchedRole, department: employee.department }
            : { role: matchedRole }
          : { department: employee.department };
        const output = await execToolStep(step, input);
        contactsResult = output as ContactsToolResult | null;
        break;
      }
      case "tool-query-trainings": {
        const output = await execToolStep(step, { department: employee.department });
        trainingsResult = output as TrainingsToolResult | null;
        break;
      }
      case "skill-task-decision": {
        const input = { employee: employeeContext(employee), tasks: tasksResult?.tasks ?? [] };
        const { output } = await execSkillStep(step, input);
        taskDecision = output as TaskDecisionOutput | null;
        break;
      }
      case "skill-process-explain": {
        const input = { tasks: tasksResult?.tasks ?? [] };
        const { output } = await execSkillStep(step, input);
        processExplain = output as ProcessExplainOutput | null;
        break;
      }
      case "skill-policy-qa": {
        const input = { question, policies: policiesResult?.policies ?? [] };
        const { output } = await execSkillStep(step, input);
        policyQa = output as PolicyQaOutput | null;
        break;
      }
      case "skill-reply-generation": {
        const input = {
          question,
          employee: { name: employee.name, department: employee.department, position: employee.position },
          task_result: taskDecision ?? undefined,
          process_result: processExplain ?? undefined,
          policy_result: policyQa ?? undefined,
          contacts: contactsResult?.contacts,
          trainings: trainingsResult?.trainings,
        };
        const { output, ok } = await execSkillStep(step, input);
        if (ok) {
          draftReply = (output as { reply?: string } | null)?.reply ?? null;
        }
        replyGenFailed = !ok;
        break;
      }
      case "skill-compliance-review":
        // Handled after the main loop so it can retry against a regenerated reply.
        break;
      default:
        break;
    }
  }

  if (replyGenFailed || draftReply === null) {
    return {
      plan,
      steps,
      final_reply: null,
      compliance: null,
      status: "error",
      error: "生成最终回复的步骤执行失败,已终止本次请求,未返回任何回复内容。",
      duration_ms: Date.now() - start,
    };
  }

  const replyGenStep = plan.find((s) => s.capability_id === "skill-reply-generation")!;
  const complianceStep = plan.find((s) => s.capability_id === "skill-compliance-review")!;
  const otherIdentifiers = allEmployees
    .filter((e) => e.id !== employee.id)
    .flatMap((e) => [e.phone, e.email]);

  let currentDraft = draftReply;
  let lastCompliance: ComplianceReviewOutput | null = null;
  let complianceBroke = false;

  for (let attempt = 1; attempt <= MAX_COMPLIANCE_ATTEMPTS; attempt++) {
    const input = { draft_reply: currentDraft, other_employee_identifiers: otherIdentifiers };
    const t0 = Date.now();
    try {
      const result = await runSkill("skill-compliance-review", input);
      const output = result.output as ComplianceReviewOutput;
      lastCompliance = output;
      steps.push({
        step: complianceStep.step,
        type: "skill",
        capability_id: complianceStep.capability_id,
        capability_name: complianceStep.capability_name,
        purpose:
          attempt === 1
            ? complianceStep.purpose
            : `根据审核建议重新生成回复后再次审核(第 ${attempt} 次)`,
        status: "success",
        input: redactTraceValue(input),
        output: redactTraceValue(output),
        note: result.mocked ? result.mock_reason : undefined,
        mocked: result.mocked,
        execution_mode: result.execution_mode,
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
        duration_ms: Date.now() - t0,
        retry_of_step: attempt > 1 ? complianceStep.step : undefined,
      });

      if (output.passed) break;
      if (attempt >= MAX_COMPLIANCE_ATTEMPTS) break;

      const regenInput = {
        question,
        employee: { name: employee.name, department: employee.department, position: employee.position },
        task_result: taskDecision ?? undefined,
        process_result: processExplain ?? undefined,
        policy_result: policyQa ?? undefined,
        contacts: contactsResult?.contacts,
        trainings: trainingsResult?.trainings,
        previous_suggestions: output.suggestions,
      };
      const regenT0 = Date.now();
      const regenResult = await runSkill("skill-reply-generation", regenInput);
      const regenOutput = regenResult.output as { reply?: string };
      steps.push({
        step: replyGenStep.step,
        type: "skill",
        capability_id: replyGenStep.capability_id,
        capability_name: replyGenStep.capability_name,
        purpose: "根据合规审核建议重新生成回复",
        status: "success",
        input: redactTraceValue(regenInput),
        output: redactTraceValue(regenOutput),
        note: regenResult.mocked ? regenResult.mock_reason : undefined,
        mocked: regenResult.mocked,
        execution_mode: regenResult.execution_mode,
        llm_failure_type: regenResult.llm_failure_type,
        provider_status: regenResult.provider_status,
        finish_reason: regenResult.finish_reason,
        response_content_type: regenResult.response_content_type,
        provider_request_id: regenResult.provider_request_id,
        validation_error_summary: regenResult.validation_error_summary,
        llm_retry_attempted: regenResult.llm_retry_attempted,
        model: regenResult.model,
        endpoint_host: regenResult.endpoint_host,
        content_length: regenResult.content_length,
        usage: regenResult.usage,
        response_shape: regenResult.response_shape,
        raw_response_sample: regenResult.raw_response_sample,
        duration_ms: Date.now() - regenT0,
        retry_of_step: replyGenStep.step,
      });
      currentDraft = regenOutput.reply ?? currentDraft;
    } catch (err) {
      steps.push({
        step: complianceStep.step,
        type: "skill",
        capability_id: complianceStep.capability_id,
        capability_name: complianceStep.capability_name,
        purpose: complianceStep.purpose,
        status: "error",
        input: redactTraceValue(input),
        output: null,
        error: describeError(err),
        mocked: false,
        execution_mode: "llm",
        duration_ms: Date.now() - t0,
        retry_of_step: attempt > 1 ? complianceStep.step : undefined,
      });
      complianceBroke = true;
      break;
    }
  }

  if (complianceBroke || !lastCompliance) {
    return {
      plan,
      steps,
      final_reply: null,
      compliance: null,
      status: "blocked",
      error: "合规与风险审核步骤执行失败,为保证合规安全,本次请求未返回回复内容。",
      duration_ms: Date.now() - start,
    };
  }

  const compliance: ComplianceResult = {
    risk_level: lastCompliance.risk_level,
    passed: lastCompliance.passed,
    issues: lastCompliance.issues,
    suggestions: lastCompliance.suggestions,
    final_reply: lastCompliance.final_reply,
  };

  const status: RunStatus = compliance.passed ? "success" : "blocked";

  return {
    plan,
    steps,
    final_reply: compliance.final_reply,
    compliance,
    status,
    error:
      status === "blocked"
        ? "合规审核未能在重试后完全通过,已返回经过安全兜底处理的回复,请人工复核。"
        : undefined,
    duration_ms: Date.now() - start,
  };
}
