import {
  AlertTriangle,
  CheckCircle2,
  ListTree,
  MessageCircle,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonBlock } from "@/components/ui/json-block";
import type {
  ComplianceResult,
  ExecutionStep,
  PlanStep,
  RiskLevel,
  RunStatus,
} from "@/lib/types";

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const RISK_STYLE: Record<RiskLevel, string> = {
  low: "border-status-live-border bg-status-live-bg text-status-live-text",
  medium: "border-status-wip-border bg-status-wip-bg text-status-wip-text",
  high: "border-red-200 bg-red-50 text-red-700",
};

const STEP_STATUS_LABEL: Record<ExecutionStep["status"], string> = {
  success: "成功",
  error: "失败",
  skipped: "已跳过",
};

const LLM_FAILURE_LABEL: Record<NonNullable<ExecutionStep["llm_failure_type"]>, string> = {
  not_configured: "LLM 未配置",
  http_error: "HTTP Error",
  timeout: "Timeout",
  network_error: "Network Error",
  response_json_error: "Response JSON Error",
  response_shape_error: "Response Shape Error",
  empty_content: "Empty Content",
  parse_error: "Parse Error",
  schema_validation_error: "Schema Validation Error",
  truncated_output: "Truncated Output",
};

export function RunStatusBanner({ status, error }: { status: RunStatus; error?: string }) {
  if (status === "success") return null;
  const isBlocked = status === "blocked";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border p-3",
        isBlocked
          ? "border-status-wip-border bg-status-wip-bg text-status-wip-text"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold">
          {isBlocked ? "已拦截 / 需要人工复核" : "运行出错"}
        </span>
        <span className="text-xs leading-relaxed">{error ?? "未知错误"}</span>
      </div>
    </div>
  );
}

export function PlanList({ plan }: { plan: PlanStep[] }) {
  if (plan.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-card-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle-foreground">
        <ListTree className="size-3.5" aria-hidden />
        Planner 执行计划
      </div>
      <ol className="flex flex-col gap-1">
        {plan.map((step) => (
          <li
            key={step.step}
            className="flex items-start gap-2 rounded-md px-1.5 py-1 text-xs text-foreground"
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-mono text-subtle-foreground">
              {step.step}
            </span>
            <span className="shrink-0 rounded border border-card-border px-1 font-mono text-[10px] text-subtle-foreground">
              {step.type === "skill" ? "Skill" : "Tool"}
            </span>
            <span className="font-medium">{step.capability_name}</span>
            <span className="text-subtle-foreground">— {step.purpose}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIcon({ type }: { type: "skill" | "tool" }) {
  return type === "skill" ? (
    <Sparkles className="size-3.5" aria-hidden />
  ) : (
    <Wrench className="size-3.5" aria-hidden />
  );
}

export function StepList({ steps }: { steps: ExecutionStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-medium text-subtle-foreground">调用明细</div>
      {steps.map((step, idx) => (
        <div
          key={`${step.step}-${step.retry_of_step ?? "base"}-${idx}`}
          className={cn(
            "flex flex-col gap-2 rounded-lg border p-3",
            step.status === "error"
              ? "border-red-200 bg-red-50/60"
              : "border-card-border bg-card",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-accent">
              <StepIcon type={step.type} />
            </span>
            <span className="text-[13px] font-medium text-foreground">{step.capability_name}</span>
            <span className="rounded border border-card-border px-1.5 py-0.5 font-mono text-[10px] text-subtle-foreground">
              {step.type === "skill" ? "Skill" : "Tool"}
            </span>
            {step.retry_of_step ? (
              <span className="rounded border border-accent-subtle-border bg-accent-subtle px-1.5 py-0.5 text-[10px] text-accent-hover">
                重试
              </span>
            ) : null}
            <span
              className={cn(
                "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                step.status === "success" && "bg-status-live-bg text-status-live-text",
                step.status === "error" && "bg-red-100 text-red-700",
                step.status === "skipped" && "bg-muted text-muted-foreground",
              )}
            >
              {step.status === "success" ? (
                <CheckCircle2 className="size-3" aria-hidden />
              ) : (
                <XCircle className="size-3" aria-hidden />
              )}
              {STEP_STATUS_LABEL[step.status]}
            </span>
            {step.mocked ? (
              <span className="rounded border border-accent-subtle-border bg-accent-subtle px-1.5 py-0.5 text-[10px] text-accent-hover">
                Mock 模式
              </span>
            ) : step.execution_mode === "llm" ? (
              <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] text-green-700">
                Real LLM
              </span>
            ) : null}
            <span className="ml-auto font-mono text-[10px] text-subtle-foreground">
              {step.duration_ms}ms
            </span>
          </div>

          <p className="text-xs text-muted-foreground">{step.purpose}</p>

          {step.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {step.error}
            </div>
          ) : null}
          {step.note ? (
            <div className="rounded-md border border-accent-subtle-border bg-accent-subtle px-2.5 py-1.5 text-xs text-accent-hover">
              {step.note}
            </div>
          ) : null}
          {step.llm_failure_type || step.llm_retry_attempted || step.model || step.usage ? (
            <div className="grid gap-1 rounded-md border border-card-border bg-muted/40 px-2.5 py-2 text-[11px] sm:grid-cols-2">
              {step.llm_failure_type ? (
                <span>失败类型: <strong>{LLM_FAILURE_LABEL[step.llm_failure_type]}</strong> <code>({step.llm_failure_type})</code></span>
              ) : null}
              {step.provider_status ? <span>HTTP: {step.provider_status}</span> : null}
              {step.response_content_type ? <span>Content: {step.response_content_type}</span> : null}
              {step.content_length !== undefined ? <span>Content Length: {step.content_length}</span> : null}
              {step.finish_reason ? <span>Finish: {step.finish_reason}</span> : null}
              {step.model ? <span>Model: <code>{step.model}</code></span> : null}
              {step.endpoint_host ? <span>Endpoint: <code>{step.endpoint_host}</code></span> : null}
              {step.provider_request_id ? <span>Request ID: <code>{step.provider_request_id}</code></span> : null}
              {step.usage ? (
                <span className="sm:col-span-2">
                  Tokens: prompt={step.usage.prompt_tokens ?? "-"} completion={step.usage.completion_tokens ?? "-"}
                  {step.usage.reasoning_tokens !== undefined ? ` reasoning=${step.usage.reasoning_tokens}` : ""} total=
                  {step.usage.total_tokens ?? "-"}
                </span>
              ) : null}
              {step.response_shape?.message_keys ? (
                <span className="sm:col-span-2">
                  message keys: <code>{step.response_shape.message_keys.join(", ")}</code>
                </span>
              ) : null}
              {step.llm_retry_attempted ? (
                <span className="sm:col-span-2">已触发截断重试(max_tokens 提升 + 严格 JSON 约束)</span>
              ) : null}
              {step.raw_response_sample ? (
                <span className="sm:col-span-2">
                  原始响应样本(已脱敏,前 500 字符): <code className="whitespace-pre-wrap break-all">{step.raw_response_sample}</code>
                </span>
              ) : null}
              {step.validation_error_summary ? (
                <span className="sm:col-span-2">校验: {step.validation_error_summary}</span>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <JsonBlock label="输入 Input" data={step.input} />
            <JsonBlock label="输出 Output" data={step.output} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinalReplyCard({ reply }: { reply: string | null }) {
  if (!reply) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle-foreground">
        <MessageCircle className="size-3.5" aria-hidden />
        最终回复
      </div>
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{reply}</p>
    </div>
  );
}

export function ComplianceCard({ compliance }: { compliance: ComplianceResult | null }) {
  if (!compliance) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-card-border bg-card p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-subtle-foreground">合规与风险审核结果</span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[11px] font-medium",
            RISK_STYLE[compliance.risk_level],
          )}
        >
          风险等级:{RISK_LABEL[compliance.risk_level]}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
            compliance.passed
              ? "bg-status-live-bg text-status-live-text"
              : "bg-status-wip-bg text-status-wip-text",
          )}
        >
          {compliance.passed ? (
            <CheckCircle2 className="size-3" aria-hidden />
          ) : (
            <AlertTriangle className="size-3" aria-hidden />
          )}
          {compliance.passed ? "审核通过" : "审核未通过,已使用安全兜底回复"}
        </span>
      </div>

      {compliance.issues.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-subtle-foreground">发现的问题</span>
          <ul className="flex flex-col gap-1">
            {compliance.issues.map((issue, i) => (
              <li key={i} className="text-xs text-foreground">
                · {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {compliance.suggestions.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-subtle-foreground">修改建议</span>
          <ul className="flex flex-col gap-1">
            {compliance.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-foreground">
                · {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
