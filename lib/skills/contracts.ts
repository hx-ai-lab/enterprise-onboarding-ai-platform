export type ValidationResult =
  | { ok: true }
  | { ok: false; summary: string };

type Validator = (value: unknown) => string[];

function objectValue(value: unknown, path: string, errors: string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${path} 必须是对象`);
    return null;
  }
  return value as Record<string, unknown>;
}

function stringField(object: Record<string, unknown>, key: string, errors: string[], nonEmpty = true) {
  const value = object[key];
  if (typeof value !== "string" || (nonEmpty && !value.trim())) errors.push(`${key} 必须是非空字符串`);
}

function booleanField(object: Record<string, unknown>, key: string, errors: string[]) {
  if (typeof object[key] !== "boolean") errors.push(`${key} 必须是布尔值`);
}

function stringArray(object: Record<string, unknown>, key: string, errors: string[]) {
  const value = object[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${key} 必须是字符串数组`);
  }
}

function enumField(
  object: Record<string, unknown>,
  key: string,
  values: readonly string[],
  errors: string[],
) {
  if (typeof object[key] !== "string" || !values.includes(object[key] as string)) {
    errors.push(`${key} 必须是 ${values.join("/")} 之一`);
  }
}

function objectArray(
  object: Record<string, unknown>,
  key: string,
  errors: string[],
  validateItem: (item: Record<string, unknown>, itemErrors: string[]) => void,
) {
  const value = object[key];
  if (!Array.isArray(value)) {
    errors.push(`${key} 必须是数组`);
    return;
  }
  value.forEach((item, index) => {
    const itemErrors: string[] = [];
    const parsed = objectValue(item, `${key}[${index}]`, itemErrors);
    if (parsed) validateItem(parsed, itemErrors);
    errors.push(...itemErrors.map((error) => `${key}[${index}]: ${error}`));
  });
}

const structuring: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (!object) return errors;
  stringField(object, "intent", errors);
  enumField(object, "question_type", ["task", "process", "policy", "contact", "training", "other"], errors);
  stringField(object, "department", errors, false);
  stringField(object, "position", errors, false);
  stringField(object, "onboarding_stage", errors);
  stringArray(object, "keywords", errors);
  return errors;
};

const taskDecision: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (!object) return errors;
  stringField(object, "summary", errors);
  objectArray(object, "recommended_tasks", errors, (item, itemErrors) => {
    stringField(item, "task_id", itemErrors);
    stringField(item, "name", itemErrors);
    enumField(item, "priority", ["high", "medium", "low"], itemErrors);
    stringField(item, "suggested_time", itemErrors);
    booleanField(item, "required", itemErrors);
    stringArray(item, "depends_on", itemErrors);
    stringField(item, "owner", itemErrors);
  });
  return errors;
};

const processExplain: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (!object) return errors;
  stringField(object, "notes", errors);
  objectArray(object, "steps", errors, (item, itemErrors) => {
    if (!Number.isInteger(item.step) || (item.step as number) < 1) itemErrors.push("step 必须是正整数");
    stringField(item, "title", itemErrors);
    stringField(item, "description", itemErrors);
  });
  return errors;
};

const policyQa: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (!object) return errors;
  stringField(object, "answer", errors);
  booleanField(object, "found", errors);
  objectArray(object, "matched_policies", errors, (item, itemErrors) => {
    stringField(item, "name", itemErrors);
    stringField(item, "version", itemErrors);
    stringField(item, "effective_date", itemErrors);
  });
  return errors;
};

const replyGeneration: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (object) stringField(object, "reply", errors);
  return errors;
};

const complianceReview: Validator = (value) => {
  const errors: string[] = [];
  const object = objectValue(value, "output", errors);
  if (!object) return errors;
  enumField(object, "risk_level", ["low", "medium", "high"], errors);
  booleanField(object, "passed", errors);
  stringArray(object, "issues", errors);
  stringArray(object, "suggestions", errors);
  stringField(object, "final_reply", errors);
  return errors;
};

const VALIDATORS: Record<string, Validator> = {
  "skill-question-structuring": structuring,
  "skill-task-decision": taskDecision,
  "skill-process-explain": processExplain,
  "skill-policy-qa": policyQa,
  "skill-reply-generation": replyGeneration,
  "skill-compliance-review": complianceReview,
};

export function validateSkillOutput(skillId: string, value: unknown): ValidationResult {
  const validator = VALIDATORS[skillId];
  if (!validator) {
    const errors: string[] = [];
    objectValue(value, "output", errors);
    return errors.length === 0 ? { ok: true } : { ok: false, summary: errors.join("; ") };
  }
  const errors = validator(value);
  return errors.length === 0
    ? { ok: true }
    : { ok: false, summary: errors.slice(0, 8).join("; ") };
}
