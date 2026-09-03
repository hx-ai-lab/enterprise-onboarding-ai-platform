// Shared domain types for the Agent / Skill / Tool platform.
// Mirrors the JSON shapes stored under /mock-data.

export type OnboardingStage =
  | "first_day"
  | "first_week"
  | "first_month"
  | "probation"
  | "confirmed";

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  first_day: "入职首日",
  first_week: "入职第一周",
  first_month: "入职第一月",
  probation: "试用期",
  confirmed: "已转正",
};

export type Employee = {
  id: string;
  name: string;
  gender: "male" | "female";
  department: string;
  position: string;
  level: string;
  onboarding_stage: OnboardingStage;
  hire_date: string;
  manager: string;
  email: string;
  phone: string;
  location: string;
  employment_type: string;
  status: "active" | "inactive";
};

/** Desensitized view returned when one employee queries another's info. */
export type EmployeePublicView = Pick<
  Employee,
  "id" | "name" | "department" | "position" | "onboarding_stage" | "status"
>;

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskPriority = "high" | "medium" | "low";

export type OnboardingTask = {
  id: string;
  employee_id: string;
  name: string;
  category: string;
  description: string;
  priority: TaskPriority;
  required: boolean;
  due_date: string;
  status: TaskStatus;
  completed_at: string | null;
  depends_on: string[];
  owner_role: string;
};

export type Contact = {
  id: string;
  name: string;
  role: "HR" | "IT" | "行政" | "培训" | "财务" | "部门负责人";
  title: string;
  department: string;
  scope: string;
  email: string;
  phone: string;
  office_hours: string;
};

export type Policy = {
  id: string;
  name: string;
  version: string;
  effective_date: string;
  category: string;
  keywords: string[];
  summary: string;
};

export type Training = {
  id: string;
  name: string;
  category: "通用" | "岗位" | "信息安全" | "企业文化";
  target_department: string;
  target_position: string;
  format: "线上" | "线下";
  duration_hours: number;
  required: boolean;
  suggested_day_offset: number;
  description: string;
};

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export type ModelParams = {
  model: string;
  temperature: number;
  max_tokens: number;
};

export type SkillTest = {
  input: string;
  output: string;
  tested_at: string;
} | null;

export type Skill = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  model_params: ModelParams;
  enabled: boolean;
  last_test: SkillTest;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

export type Tool = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  data_source: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export type Agent = {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  model_id: string;
  bound_skill_ids: string[];
  bound_tool_ids: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Execution trace / logs
// ---------------------------------------------------------------------------

export type PlanStepType = "skill" | "tool";

export type PlanStep = {
  step: number;
  type: PlanStepType;
  capability_id: string;
  capability_name: string;
  purpose: string;
  /** true when the planner dropped this step because the capability was disabled/unknown */
  skipped?: boolean;
  skip_reason?: string;
};

export type ExecutionStepStatus = "success" | "error" | "skipped";

export type ExecutionStep = {
  step: number;
  type: PlanStepType;
  capability_id: string;
  capability_name: string;
  purpose: string;
  status: ExecutionStepStatus;
  input: unknown;
  output: unknown;
  /** set only on status "error" / "skipped" — a real failure or rejection */
  error?: string;
  /** informational note, e.g. why a Mock fallback was used — never an error */
  note?: string;
  mocked: boolean;
  duration_ms: number;
  /** marks steps appended dynamically by the compliance-retry loop */
  retry_of_step?: number;
};

export type RiskLevel = "low" | "medium" | "high";

export type ComplianceResult = {
  risk_level: RiskLevel;
  passed: boolean;
  issues: string[];
  suggestions: string[];
  final_reply: string;
};

export type RunStatus = "success" | "error" | "blocked";

export type AgentRunLog = {
  id: string;
  agent_id: string;
  agent_name: string;
  employee_id: string;
  employee_name: string;
  question: string;
  plan: PlanStep[];
  steps: ExecutionStep[];
  final_reply: string | null;
  compliance: ComplianceResult | null;
  status: RunStatus;
  error?: string;
  created_at: string;
  duration_ms: number;
};
