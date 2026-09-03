"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Play, Sparkles, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import {
  ComplianceCard,
  FinalReplyCard,
  PlanList,
  RunStatusBanner,
  StepList,
} from "@/components/agent-run/run-trace";
import { buttonClass } from "@/lib/ui-variants";
import { parseJsonResponse } from "@/lib/fetch-json";
import { useCurrentEmployee } from "@/lib/hooks/use-current-employee";
import { ONBOARDING_STAGE_LABELS } from "@/lib/types";
import type { Agent, ComplianceResult, ExecutionStep, PlanStep, RunStatus, Skill, Tool } from "@/lib/types";

type AgentDetail = { agent: Agent; bound_skills: Skill[]; bound_tools: Tool[] };

type RunResponse = {
  plan: PlanStep[];
  steps: ExecutionStep[];
  final_reply: string | null;
  compliance: ComplianceResult | null;
  status: RunStatus;
  error?: string;
  duration_ms: number;
};

const SAMPLE_QUESTIONS = [
  "我入职第一天需要做什么",
  "请假需要提前多久申请,走什么流程",
  "我的入职任务完成得怎么样了,还有哪些没做",
  "IT 支持的联系方式是什么",
];

export default function AgentRunPage() {
  const params = useParams<{ agentId: string }>();
  const { employee, employees, setEmployeeId } = useCurrentEmployee();

  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);

  const load = useCallback(() => {
    fetch(`/api/agents/${params.agentId}`)
      .then((r) => parseJsonResponse<AgentDetail>(r))
      .then((data) => {
        setLoadError(null);
        setDetail(data);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "加载失败,请重试"));
  }, [params.agentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    if (!employee || !question.trim()) {
      setRunError("请先选择模拟员工身份并输入问题");
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/agents/${params.agentId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employee.id, question }),
      });
      const data = await parseJsonResponse<RunResponse>(res);
      setResult(data);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "运行失败,请重试");
    } finally {
      setRunning(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="测试运行" code="MODULE / AGENT-CONSOLE" />
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="测试运行" code="MODULE / AGENT-CONSOLE" />
        <LoadingState />
      </div>
    );
  }

  const { agent, bound_skills, bound_tools } = detail;

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto pb-4">
      <PageHeader
        label={`测试运行 · ${agent.name}`}
        code="MODULE / AGENT-CONSOLE"
        actions={
          <Link href={`/agents/${agent.id}`} className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回详情
          </Link>
        }
      />

      {!agent.enabled ? (
        <div className="rounded-lg border border-status-wip-border bg-status-wip-bg px-3.5 py-2.5 text-xs text-status-wip-text">
          该 Agent 当前已被禁用,运行请求会被系统拒绝。请先在详情页启用后再运行。
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle-foreground">
            <User className="size-3.5" aria-hidden />
            当前模拟员工身份
          </div>
          <select
            value={employee?.id ?? ""}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.department} / {e.position}
              </option>
            ))}
          </select>
          {employee ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>入职日期:{employee.hire_date}</span>
              <span>入职阶段:{ONBOARDING_STAGE_LABELS[employee.onboarding_stage]}</span>
              <span>直属上级:{employee.manager}</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle-foreground">
            当前可调用的 Skill / Tool
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bound_skills.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1 rounded border border-card-border px-1.5 py-0.5 text-[11px] text-foreground"
              >
                <Sparkles className="size-3 text-accent" aria-hidden />
                {s.name}
                <Badge status={s.enabled ? "live" : "wip"} className="h-4 px-1 text-[9px]">
                  {s.enabled ? "启用" : "禁用"}
                </Badge>
              </span>
            ))}
            {bound_tools.map((t) => (
              <span
                key={t.id}
                className="flex items-center gap-1 rounded border border-card-border px-1.5 py-0.5 text-[11px] text-foreground"
              >
                <Wrench className="size-3 text-accent" aria-hidden />
                {t.name}
                <Badge status={t.enabled ? "live" : "wip"} className="h-4 px-1 text-[9px]">
                  {t.enabled ? "启用" : "禁用"}
                </Badge>
              </span>
            ))}
            {bound_skills.length === 0 && bound_tools.length === 0 ? (
              <span className="text-xs text-subtle-foreground">该 Agent 尚未绑定任何 Skill / Tool</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-lg border border-card-border bg-card p-3.5">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">输入问题</span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如:我入职第一天需要做什么"
            rows={2}
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuestion(q)}
              className="rounded-full border border-card-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-accent-subtle-border hover:text-accent-hover"
            >
              {q}
            </button>
          ))}
        </div>
        {runError ? <p className="text-xs text-red-600">{runError}</p> : null}
        <div>
          <button type="button" disabled={running} onClick={run} className={buttonClass("primary")}>
            <Play className="size-3.5" aria-hidden />
            {running ? "运行中…" : "运行"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="flex flex-col gap-3">
          <RunStatusBanner status={result.status} error={result.error} />
          <PlanList plan={result.plan} />
          <StepList steps={result.steps} />
          <FinalReplyCard reply={result.final_reply} />
          <ComplianceCard compliance={result.compliance} />
        </div>
      ) : null}
    </div>
  );
}
