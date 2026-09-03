// Deterministic, rule-based fallbacks used whenever the real LLM is
// unconfigured or fails. Each function mirrors the JSON contract described
// in the corresponding Skill's prompt (see mock-data/skills.json), so the
// Executor can treat a mocked output exactly like a real one.

import type { Contact, Employee, OnboardingTask, Policy, Training } from "@/lib/types";

// ---------------------------------------------------------------------------
// skill-question-structuring
// ---------------------------------------------------------------------------
export type QuestionType =
  | "task"
  | "process"
  | "policy"
  | "contact"
  | "training"
  | "other";

export type StructuringInput = {
  question: string;
  employee: Pick<Employee, "department" | "position" | "onboarding_stage">;
};

export type StructuringOutput = {
  intent: string;
  question_type: QuestionType;
  department: string;
  position: string;
  onboarding_stage: string;
  keywords: string[];
};

const CATEGORY_KEYWORDS: Record<Exclude<QuestionType, "other">, string[]> = {
  policy: ["制度", "规定", "政策", "请假", "报销", "考勤", "社保", "公积金", "试用期", "薪酬", "工资", "保密", "手册"],
  contact: ["联系人", "联系方式", "找谁", "电话", "邮箱", "负责人", "HR", "IT", "行政", "财务"],
  training: ["培训", "课程", "学习", "考试"],
  task: ["任务", "要做", "清单", "待办", "下一步", "todo"],
  process: ["流程", "步骤", "怎么", "如何", "顺序", "第一天", "入职当天"],
};

/**
 * Maps a matched "contact" keyword to the Contact.role value it identifies,
 * so the executor can query tool-query-contacts by role instead of blindly
 * scoping to the asking employee's own department. Shared here (rather than
 * duplicated in the executor) so the structuring keywords and the role
 * lookup never drift apart.
 */
export const CONTACT_ROLE_BY_KEYWORD: Record<string, string> = {
  HR: "HR",
  IT: "IT",
  行政: "行政",
  培训: "培训",
  财务: "财务",
  负责人: "部门负责人",
};

const CATEGORY_PRIORITY: Exclude<QuestionType, "other">[] = [
  "policy",
  "contact",
  "training",
  "task",
  "process",
];

export function mockStructuring(input: StructuringInput): StructuringOutput {
  const question = input.question || "";
  const scored: { type: QuestionType; score: number; hits: string[] }[] = [];

  for (const type of CATEGORY_PRIORITY) {
    const hits = CATEGORY_KEYWORDS[type].filter((kw) => question.includes(kw));
    scored.push({ type, score: hits.length, hits });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const question_type: QuestionType = top.score > 0 ? top.type : "other";
  const keywords = top.hits.length > 0 ? top.hits.slice(0, 6) : [question.slice(0, 12)].filter(Boolean);

  return {
    intent: `员工希望了解与「${question_type === "other" ? "入职相关事项" : keywords[0]}」相关的信息`,
    question_type,
    department: input.employee.department,
    position: input.employee.position,
    onboarding_stage: input.employee.onboarding_stage,
    keywords,
  };
}

// ---------------------------------------------------------------------------
// skill-task-decision
// ---------------------------------------------------------------------------
export type TaskDecisionInput = {
  employee: Pick<Employee, "department" | "position" | "onboarding_stage">;
  tasks: OnboardingTask[];
};

export type RecommendedTask = {
  task_id: string;
  name: string;
  priority: OnboardingTask["priority"];
  suggested_time: string;
  required: boolean;
  depends_on: string[];
  owner: string;
};

export type TaskDecisionOutput = {
  recommended_tasks: RecommendedTask[];
  summary: string;
};

const PRIORITY_WEIGHT: Record<OnboardingTask["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function mockTaskDecision(input: TaskDecisionInput): TaskDecisionOutput {
  const pending = input.tasks.filter((t) => t.status !== "completed");
  const sorted = [...pending].sort((a, b) => {
    const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (pw !== 0) return pw;
    return a.due_date.localeCompare(b.due_date);
  });
  const top = sorted.slice(0, 5);

  const recommended_tasks: RecommendedTask[] = top.map((t) => ({
    task_id: t.id,
    name: t.name,
    priority: t.priority,
    suggested_time: t.due_date,
    required: t.required,
    depends_on: t.depends_on,
    owner: t.owner_role,
  }));

  const requiredCount = top.filter((t) => t.required).length;
  const summary =
    top.length === 0
      ? "当前系统未查询到待完成的入职任务,你的入职任务已全部完成。"
      : `根据你当前的入职阶段,系统查询到 ${pending.length} 项待办任务,优先推荐完成以下 ${top.length} 项,其中 ${requiredCount} 项为必做项。`;

  return { recommended_tasks, summary };
}

// ---------------------------------------------------------------------------
// skill-process-explain
// ---------------------------------------------------------------------------
export type ProcessExplainInput = {
  tasks: OnboardingTask[];
};

export type ProcessExplainOutput = {
  steps: { step: number; title: string; description: string }[];
  notes: string;
};

export function mockProcessExplain(input: ProcessExplainInput): ProcessExplainOutput {
  const ordered = [...input.tasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const steps = ordered.slice(0, 8).map((t, idx) => ({
    step: idx + 1,
    title: t.name,
    description: `建议于 ${t.due_date} 前完成,由「${t.owner_role}」协助跟进,当前状态:${
      t.status === "completed" ? "已完成" : t.status === "in_progress" ? "进行中" : "待开始"
    }。`,
  }));

  return {
    steps,
    notes:
      steps.length > 0
        ? "以上步骤基于系统查询到的入职任务数据整理,具体安排如有调整请以实际通知为准。"
        : "当前系统未查询到相关入职任务数据,建议联系人力资源部门确认具体流程。",
  };
}

// ---------------------------------------------------------------------------
// skill-policy-qa
// ---------------------------------------------------------------------------
export type PolicyQaInput = {
  question: string;
  policies: Policy[];
};

export type PolicyQaOutput = {
  answer: string;
  matched_policies: { name: string; version: string; effective_date: string }[];
  found: boolean;
};

export function mockPolicyQa(input: PolicyQaInput): PolicyQaOutput {
  if (input.policies.length === 0) {
    return {
      answer: "当前系统未查询到相关制度信息,建议联系人力资源部门进一步确认。",
      matched_policies: [],
      found: false,
    };
  }

  const lines = input.policies.map(
    (p) => `《${p.name}》(版本 ${p.version},生效日期 ${p.effective_date}):${p.summary}`,
  );

  return {
    answer: lines.join("\n"),
    matched_policies: input.policies.map((p) => ({
      name: p.name,
      version: p.version,
      effective_date: p.effective_date,
    })),
    found: true,
  };
}

// ---------------------------------------------------------------------------
// skill-reply-generation
// ---------------------------------------------------------------------------
export type ReplyGenerationInput = {
  question: string;
  employee: Pick<Employee, "name" | "department" | "position">;
  task_result?: TaskDecisionOutput;
  process_result?: ProcessExplainOutput;
  policy_result?: PolicyQaOutput;
  contacts?: Contact[];
  trainings?: Training[];
  previous_suggestions?: string[];
};

export type ReplyGenerationOutput = {
  reply: string;
};

const SENSITIVE_FINANCE_KEYWORDS = ["薪酬", "工资", "社保", "公积金", "五险一金", "报销"];

export function mockReplyGeneration(input: ReplyGenerationInput): ReplyGenerationOutput {
  const parts: string[] = [];
  parts.push(`你好${input.employee.name ? ` ${input.employee.name}` : ""},以下是关于你问题的整理信息:`);

  if (input.task_result && input.task_result.recommended_tasks.length > 0) {
    const list = input.task_result.recommended_tasks
      .map((t) => `- ${t.name}(${t.required ? "必做" : "选做"},建议 ${t.suggested_time} 前完成,负责协助方:${t.owner})`)
      .join("\n");
    parts.push(`【推荐任务】\n${input.task_result.summary}\n${list}`);
  }

  if (input.process_result && input.process_result.steps.length > 0) {
    const list = input.process_result.steps.map((s) => `${s.step}. ${s.title} — ${s.description}`).join("\n");
    parts.push(`【流程说明】\n${list}\n${input.process_result.notes}`);
  }

  if (input.policy_result) {
    parts.push(`【制度信息】\n${input.policy_result.answer}`);
  }

  if (input.contacts && input.contacts.length > 0) {
    const list = input.contacts
      .map((c) => `- ${c.title} ${c.name}(${c.role}) · ${c.email} · ${c.phone} · 服务时间:${c.office_hours}`)
      .join("\n");
    parts.push(`【相关联系人】\n${list}`);
  }

  if (input.trainings && input.trainings.length > 0) {
    const list = input.trainings
      .map((t) => `- ${t.name}(${t.category},${t.format},约 ${t.duration_hours} 小时,${t.required ? "必修" : "选修"})`)
      .join("\n");
    parts.push(`【相关培训】\n${list}`);
  }

  const mentionsFinance = parts.some((p) => SENSITIVE_FINANCE_KEYWORDS.some((kw) => p.includes(kw)));
  if (mentionsFinance) {
    parts.push(
      "如涉及薪酬、社保或公积金的具体到账时间与金额,请以系统内的实际记录为准,如有疑问建议直接联系财务或人力资源部门确认。",
    );
  }

  if (input.previous_suggestions && input.previous_suggestions.length > 0) {
    parts.push(`(已根据审核建议调整表述:${input.previous_suggestions.join(";")})`);
  }

  if (parts.length === 1) {
    parts.push("当前系统未查询到与你的问题直接相关的信息,建议联系人力资源部门进一步确认。");
  }

  return { reply: parts.join("\n\n") };
}

// ---------------------------------------------------------------------------
// skill-compliance-review
// ---------------------------------------------------------------------------
export type ComplianceReviewInput = {
  draft_reply: string;
  other_employee_identifiers: string[];
};

export type ComplianceReviewOutput = {
  risk_level: "low" | "medium" | "high";
  passed: boolean;
  issues: string[];
  suggestions: string[];
  final_reply: string;
};

const ABSOLUTE_PROMISE_WORDS = ["保证", "肯定能", "百分之百", "100%", "绝对", "一定能通过"];
const DISCRIMINATORY_WORDS = ["性别歧视", "地域歧视", "残疾歧视", "年龄歧视"];

export function mockComplianceReview(input: ComplianceReviewInput): ComplianceReviewOutput {
  let text = input.draft_reply;
  const issues: string[] = [];
  const suggestions: string[] = [];
  let riskLevel: "low" | "medium" | "high" = "low";

  for (const identifier of input.other_employee_identifiers) {
    if (identifier && text.includes(identifier)) {
      issues.push(`回复中包含了其他员工的私人联系方式(${identifier}),涉嫌隐私泄露`);
      suggestions.push("移除或替换为该员工可自行公开的组织信息,不展示他人手机号/邮箱等私人联系方式");
      text = text.split(identifier).join("***(已脱敏)");
      riskLevel = "high";
    }
  }

  const mentionsFinance = SENSITIVE_FINANCE_KEYWORDS.some((kw) => text.includes(kw));
  if (mentionsFinance) {
    for (const word of ABSOLUTE_PROMISE_WORDS) {
      if (text.includes(word)) {
        issues.push(`回复中对薪酬/社保/公积金等事项使用了绝对化承诺用语「${word}」`);
        suggestions.push("将绝对化承诺改为引导员工以系统实际记录或对应负责人确认为准的表述");
        text = text.split(word).join("预计");
        if (riskLevel === "low") riskLevel = "medium";
      }
    }
  }

  for (const word of DISCRIMINATORY_WORDS) {
    if (text.includes(word)) {
      issues.push(`回复中可能包含歧视性表达相关内容「${word}」`);
      suggestions.push("删除或改写涉及歧视性表达的内容");
      riskLevel = "high";
    }
  }

  const passed = issues.length === 0;

  return {
    risk_level: riskLevel,
    passed,
    issues,
    suggestions,
    final_reply: text,
  };
}
