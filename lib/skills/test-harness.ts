// Builds a realistic, self-contained input payload for the Skills "test"
// page: given free text + a simulated employee identity, it fetches
// whatever reference data the target Skill would normally receive from the
// Tools in a real Agent run, so a single-Skill test still reflects real data
// instead of asking the operator to hand-author JSON.

import { getEmployees } from "@/lib/data/reference-data";
import { mockStructuring, mockTaskDecision } from "@/lib/skills/mocks";
import { runTool } from "@/lib/tools/runners";
import type { Employee, OnboardingTask, Policy } from "@/lib/types";

function employeeContext(e: Employee) {
  return { department: e.department, position: e.position, onboarding_stage: e.onboarding_stage };
}

export async function buildSkillTestInput(
  skillId: string,
  question: string,
  employeeId: string,
): Promise<Record<string, unknown>> {
  const employees = await getEmployees();
  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const ctx = { employeeId: employee.id };
  const structured = mockStructuring({ question, employee });

  switch (skillId) {
    case "skill-question-structuring":
      return { question, employee: employeeContext(employee) };

    case "skill-task-decision": {
      const taskResult = (await runTool("tool-query-tasks", {}, ctx)) as {
        tasks: OnboardingTask[];
      };
      return { employee: employeeContext(employee), tasks: taskResult.tasks ?? [] };
    }

    case "skill-process-explain": {
      const taskResult = (await runTool("tool-query-tasks", {}, ctx)) as {
        tasks: OnboardingTask[];
      };
      return { tasks: taskResult.tasks ?? [] };
    }

    case "skill-policy-qa": {
      const keyword = structured.keywords[0] ?? question;
      const policyResult = (await runTool("tool-query-policies", { keyword }, ctx)) as {
        policies: Policy[];
      };
      return { question, policies: policyResult.policies ?? [] };
    }

    case "skill-reply-generation": {
      const taskResult = (await runTool("tool-query-tasks", {}, ctx)) as {
        tasks: OnboardingTask[];
      };
      const taskDecision = mockTaskDecision({ employee, tasks: taskResult.tasks ?? [] });
      return {
        question,
        employee: { name: employee.name, department: employee.department, position: employee.position },
        task_result: taskDecision,
      };
    }

    case "skill-compliance-review": {
      const otherIdentifiers = employees
        .filter((e) => e.id !== employee.id)
        .flatMap((e) => [e.phone, e.email]);
      return { draft_reply: question, other_employee_identifiers: otherIdentifiers };
    }

    default:
      return { question, employee: employeeContext(employee) };
  }
}
