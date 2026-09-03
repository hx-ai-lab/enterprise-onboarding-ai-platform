"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-states";
import {
  ComplianceCard,
  FinalReplyCard,
  PlanList,
  RunStatusBanner,
  StepList,
} from "@/components/agent-run/run-trace";
import { buttonClass } from "@/lib/ui-variants";
import type { AgentRunLog } from "@/lib/types";

const STATUS_LABEL: Record<AgentRunLog["status"], string> = {
  success: "成功",
  error: "出错",
  blocked: "已拦截",
};

export default function AgentLogsPage() {
  const params = useParams<{ agentId: string }>();
  const [logs, setLogs] = useState<AgentRunLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/agents/${params.agentId}/logs`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "未找到该 Agent" : `加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setLogs(data.logs ?? []);
      })
      .catch((e) => setError(e.message));
  }, [params.agentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto pb-4">
      <PageHeader
        label="执行日志"
        code="MODULE / AGENT-CONSOLE"
        actions={
          <Link href={`/agents/${params.agentId}`} className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回详情
          </Link>
        }
      />

      {logs === null && !error ? <LoadingState label="日志加载中…" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {logs && logs.length === 0 ? (
        <EmptyState title="暂无执行日志" description="在「运行测试」页面运行一次 Agent 后,日志会显示在这里。" />
      ) : null}

      {logs && logs.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {logs.map((log) => (
            <details key={log.id} className="group rounded-lg border border-card-border bg-card open:pb-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3.5 py-2.5 select-none">
                <span className="inline-block text-subtle-foreground transition-transform group-open:rotate-90">▸</span>
                <span
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                    log.status === "success" && "bg-status-live-bg text-status-live-text",
                    log.status === "error" && "bg-red-100 text-red-700",
                    log.status === "blocked" && "bg-status-wip-bg text-status-wip-text",
                  )}
                >
                  {log.status === "success" ? (
                    <CheckCircle2 className="size-3" aria-hidden />
                  ) : (
                    <XCircle className="size-3" aria-hidden />
                  )}
                  {STATUS_LABEL[log.status]}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{log.question}</span>
                <span className="shrink-0 text-[11px] text-subtle-foreground">{log.employee_name}</span>
                <span className="shrink-0 font-mono text-[10px] text-subtle-foreground">
                  {new Date(log.created_at).toLocaleString("zh-CN")} · {log.duration_ms}ms
                </span>
              </summary>

              <div className="flex flex-col gap-3 px-3.5 pt-1">
                <RunStatusBanner status={log.status} error={log.error} />
                <PlanList plan={log.plan} />
                <StepList steps={log.steps} />
                <FinalReplyCard reply={log.final_reply} />
                <ComplianceCard compliance={log.compliance} />
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </div>
  );
}
