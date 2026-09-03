import { CapabilityDisabledError, CapabilityNotFoundError } from "@/lib/errors";
import {
  getContacts,
  getEmployeeById,
  getOnboardingTasks,
  getPolicies,
  getTrainings,
} from "@/lib/data/reference-data";
import { getToolById } from "@/lib/data/tools";
import type { Employee, EmployeePublicView, OnboardingTask } from "@/lib/types";

export type ToolRunContext = {
  /** The currently simulated logged-in employee — the identity all privacy checks are anchored to. */
  employeeId: string;
};

function toPublicView(e: Employee): EmployeePublicView {
  return {
    id: e.id,
    name: e.name,
    department: e.department,
    position: e.position,
    onboarding_stage: e.onboarding_stage,
    status: e.status,
  };
}

// ---------------------------------------------------------------------------
// tool-query-employee
// ---------------------------------------------------------------------------
async function runQueryEmployee(
  input: { employee_id?: string },
  ctx: ToolRunContext,
) {
  const targetId = input.employee_id || ctx.employeeId;
  const employee = await getEmployeeById(targetId);
  if (!employee) {
    return { found: false, message: "当前系统未查询到相关信息" };
  }
  if (targetId === ctx.employeeId) {
    return { found: true, self: true, employee };
  }
  // Cross-employee lookups only ever return desensitized public org info.
  return { found: true, self: false, employee: toPublicView(employee) };
}

// ---------------------------------------------------------------------------
// tool-query-tasks
// ---------------------------------------------------------------------------
async function runQueryTasks(
  input: { employee_id?: string },
  ctx: ToolRunContext,
) {
  const targetId = input.employee_id || ctx.employeeId;
  if (targetId !== ctx.employeeId) {
    return {
      found: false,
      message: "出于隐私保护,无法查询其他员工的入职任务详情",
    };
  }
  const tasks = await getOnboardingTasks();
  const mine = tasks.filter((t) => t.employee_id === targetId);
  return { found: mine.length > 0, tasks: mine };
}

// ---------------------------------------------------------------------------
// tool-query-contacts
// ---------------------------------------------------------------------------
async function runQueryContacts(input: {
  role?: string;
  department?: string;
  keyword?: string;
}) {
  const contacts = await getContacts();
  const keyword = input.keyword?.trim().toLowerCase();
  const filtered = contacts.filter((c) => {
    if (input.role && c.role !== input.role) return false;
    if (input.department && !c.scope.includes(input.department) && c.department !== input.department) {
      return false;
    }
    if (keyword) {
      const haystack = `${c.name}${c.role}${c.title}${c.department}${c.scope}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
  return { found: filtered.length > 0, contacts: filtered };
}

// ---------------------------------------------------------------------------
// tool-query-policies
// ---------------------------------------------------------------------------
async function runQueryPolicies(input: { keyword?: string; category?: string }) {
  const policies = await getPolicies();
  const keyword = input.keyword?.trim().toLowerCase();
  const filtered = policies.filter((p) => {
    if (input.category && p.category !== input.category) return false;
    if (keyword) {
      const haystack = `${p.name}${p.category}${p.summary}${p.keywords.join(" ")}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
  return { found: filtered.length > 0, policies: filtered };
}

// ---------------------------------------------------------------------------
// tool-query-trainings
// ---------------------------------------------------------------------------
async function runQueryTrainings(input: {
  department?: string;
  category?: string;
}) {
  const trainings = await getTrainings();
  const filtered = trainings.filter((t) => {
    if (
      input.department &&
      t.target_department !== "all" &&
      t.target_department !== input.department
    ) {
      return false;
    }
    if (input.category && t.category !== input.category) return false;
    return true;
  });
  return { found: filtered.length > 0, trainings: filtered };
}

// ---------------------------------------------------------------------------
// tool-task-status-calc — pure computation, no LLM involved
// ---------------------------------------------------------------------------
async function runTaskStatusCalc(
  input: { employee_id?: string },
  ctx: ToolRunContext,
) {
  const targetId = input.employee_id || ctx.employeeId;
  if (targetId !== ctx.employeeId) {
    return {
      found: false,
      message: "出于隐私保护,无法计算其他员工的任务完成情况",
    };
  }
  const tasks = await getOnboardingTasks();
  const mine = tasks.filter((t) => t.employee_id === targetId);
  if (mine.length === 0) {
    return { found: false, message: "当前系统未查询到相关信息" };
  }

  const now = new Date();
  const priorityWeight: Record<OnboardingTask["priority"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const completed = mine.filter((t) => t.status === "completed");
  const overdue = mine.filter(
    (t) => t.status !== "completed" && new Date(t.due_date) < now,
  );
  const upcoming = mine
    .filter((t) => t.status !== "completed")
    .sort((a, b) => {
      const pw = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (pw !== 0) return pw;
      return a.due_date.localeCompare(b.due_date);
    });

  return {
    found: true,
    employee_id: targetId,
    total_tasks: mine.length,
    completed_tasks: completed.length,
    completion_rate: Number((completed.length / mine.length).toFixed(2)),
    overdue_tasks: overdue.map((t) => ({
      id: t.id,
      name: t.name,
      due_date: t.due_date,
      priority: t.priority,
    })),
    upcoming_tasks_by_priority: upcoming.map((t) => ({
      id: t.id,
      name: t.name,
      due_date: t.due_date,
      priority: t.priority,
      status: t.status,
    })),
  };
}

type ToolHandler = (
  input: Record<string, unknown>,
  ctx: ToolRunContext,
) => Promise<unknown>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  "tool-query-employee": (input, ctx) =>
    runQueryEmployee(input as { employee_id?: string }, ctx),
  "tool-query-tasks": (input, ctx) =>
    runQueryTasks(input as { employee_id?: string }, ctx),
  "tool-query-contacts": (input) =>
    runQueryContacts(
      input as { role?: string; department?: string; keyword?: string },
    ),
  "tool-query-policies": (input) =>
    runQueryPolicies(input as { keyword?: string; category?: string }),
  "tool-query-trainings": (input) =>
    runQueryTrainings(input as { department?: string; category?: string }),
  "tool-task-status-calc": (input, ctx) =>
    runTaskStatusCalc(input as { employee_id?: string }, ctx),
};

/**
 * Runs a Tool by id. Always re-checks the enabled flag at call time (not
 * just at plan time) so a disabled Tool is rejected even when invoked
 * directly, e.g. from a manual test call.
 */
export async function runTool(
  toolId: string,
  input: Record<string, unknown>,
  ctx: ToolRunContext,
): Promise<unknown> {
  const tool = await getToolById(toolId);
  if (!tool) throw new CapabilityNotFoundError("tool", toolId);
  if (!tool.enabled) {
    throw new CapabilityDisabledError("tool", tool.id, tool.name);
  }
  const handler = TOOL_HANDLERS[toolId];
  if (!handler) {
    throw new Error(`未实现的 Tool 处理逻辑: ${toolId}`);
  }
  return handler(input, ctx);
}

export function isKnownToolId(toolId: string): boolean {
  return toolId in TOOL_HANDLERS;
}
