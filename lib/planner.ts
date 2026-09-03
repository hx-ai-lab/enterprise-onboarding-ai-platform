// Rule-based Planner: deterministically decides which currently-enabled
// (and Agent-bound) Skills/Tools are relevant to a question. A disabled or
// unbound capability is simply never added to the plan — it never appears,
// exactly as required, rather than appearing as a crossed-out step.
//
// Planning intentionally stays rule-based rather than LLM-driven: the
// Executor's step-input wiring depends on knowing exactly which steps exist
// and in what order, and an LLM-authored plan could reference the right
// capability ids but in a shape the Executor can't safely wire up. Keeping
// planning deterministic also means Mock mode and real-LLM mode produce the
// identical plan for the same question — only the per-step Skill outputs
// differ.

import type { PlanStep } from "@/lib/types";

export const ESSENTIAL_SKILLS: { id: string; name: string }[] = [
  { id: "skill-question-structuring", name: "入职问题结构化 Skill" },
  { id: "skill-reply-generation", name: "入职沟通话术生成 Skill" },
  { id: "skill-compliance-review", name: "合规与风险审核 Skill" },
];

type Needs = {
  task: boolean;
  process: boolean;
  policy: boolean;
  contact: boolean;
  training: boolean;
};

// Keep the "contact" keyword set here in sync with CATEGORY_KEYWORDS.contact
// in lib/skills/mocks.ts — this decides whether the contacts Tool is planned
// at all, while that one decides which role it's queried for.
function detectNeeds(question: string): Needs {
  const needs: Needs = {
    task: /任务|要做|清单|待办|下一步|todo/i.test(question),
    process: /流程|步骤|怎么|如何|顺序|第一天|入职当天/.test(question),
    policy: /制度|规定|政策|请假|报销|考勤|社保|公积金|试用期|薪酬|工资|保密|手册/.test(question),
    contact: /联系人|联系方式|找谁|电话|邮箱|负责人|HR|IT|行政|财务/i.test(question),
    training: /培训|课程|学习|考试/.test(question),
  };

  const isEmpty = !needs.task && !needs.process && !needs.policy && !needs.contact && !needs.training;
  if (isEmpty) {
    // A generic "what do I need to do" question with no strong keyword signal.
    needs.task = true;
    needs.process = true;
  }
  return needs;
}

export type PlanBuildParams = {
  question: string;
  /** Skill ids that are both bound to the running Agent and currently enabled. */
  enabledSkillIds: Set<string>;
  /** Tool ids that are both bound to the running Agent and currently enabled. */
  enabledToolIds: Set<string>;
  skillNames: Map<string, string>;
  toolNames: Map<string, string>;
};

export type PlanBuildResult = {
  plan: PlanStep[];
  /** essential pipeline Skills that are missing (disabled or not bound) — a hard block. */
  missing_essentials: { id: string; name: string }[];
};

export function generatePlan(params: PlanBuildParams): PlanBuildResult {
  const { question, enabledSkillIds, enabledToolIds, skillNames, toolNames } = params;
  const needs = detectNeeds(question);

  const candidates: { type: "skill" | "tool"; id: string; purpose: string }[] = [
    {
      type: "skill",
      id: "skill-question-structuring",
      purpose: "将员工的自然语言问题解析为结构化意图,用于决定后续需要调用哪些能力",
    },
    { type: "tool", id: "tool-query-employee", purpose: "核实当前员工身份与基础档案信息" },
  ];

  if (needs.task || needs.process) {
    candidates.push({ type: "tool", id: "tool-query-tasks", purpose: "查询该员工的入职任务清单" });
  }
  if (needs.task) {
    candidates.push({
      type: "tool",
      id: "tool-task-status-calc",
      purpose: "计算任务完成率与逾期情况,辅助判断优先级",
    });
  }
  if (needs.policy) {
    candidates.push({ type: "tool", id: "tool-query-policies", purpose: "查询与问题相关的制度知识库内容" });
  }
  if (needs.contact) {
    candidates.push({ type: "tool", id: "tool-query-contacts", purpose: "查询相关联系人信息" });
  }
  if (needs.training) {
    candidates.push({ type: "tool", id: "tool-query-trainings", purpose: "查询适用的培训计划" });
  }
  if (needs.task) {
    candidates.push({ type: "skill", id: "skill-task-decision", purpose: "基于任务数据判断下一步推荐任务" });
  }
  if (needs.process) {
    candidates.push({ type: "skill", id: "skill-process-explain", purpose: "生成步骤化的入职流程说明" });
  }
  if (needs.policy) {
    candidates.push({ type: "skill", id: "skill-policy-qa", purpose: "基于制度知识库内容回答问题" });
  }
  candidates.push({
    type: "skill",
    id: "skill-reply-generation",
    purpose: "汇总前序结果生成自然友好的最终回复",
  });
  candidates.push({
    type: "skill",
    id: "skill-compliance-review",
    purpose: "对最终回复进行合规与风险审核,审核通过前不得返回给员工",
  });

  const plan: PlanStep[] = [];
  let stepNo = 1;
  for (const c of candidates) {
    const enabled = c.type === "skill" ? enabledSkillIds.has(c.id) : enabledToolIds.has(c.id);
    if (!enabled) continue;
    const name = (c.type === "skill" ? skillNames.get(c.id) : toolNames.get(c.id)) ?? c.id;
    plan.push({
      step: stepNo++,
      type: c.type,
      capability_id: c.id,
      capability_name: name,
      purpose: c.purpose,
    });
  }

  const missing_essentials = ESSENTIAL_SKILLS.filter((s) => !enabledSkillIds.has(s.id));

  return { plan, missing_essentials };
}
