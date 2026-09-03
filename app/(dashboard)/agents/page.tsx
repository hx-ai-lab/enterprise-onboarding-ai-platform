"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileClock, Play, Plus, Settings2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-states";
import { buttonClass } from "@/lib/ui-variants";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error(`加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setAgents(data.agents ?? []);
      })
      .catch(() => setError("Agent 列表加载失败,请重试"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(agent: Agent) {
    setTogglingId(agent.id);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !agent.enabled }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      setError("更新启用状态失败,请重试");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label="Agent 控制台"
        code="MODULE / AGENT-CONSOLE"
        actions={
          <Link href="/agents/new" className={buttonClass("primary")}>
            <Plus className="size-3.5" aria-hidden />
            新建 Agent
          </Link>
        }
      />

      {agents === null && !error ? <LoadingState label="Agent 列表加载中…" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {agents && agents.length === 0 ? (
        <EmptyState
          title="暂无 Agent"
          description="点击右上角「新建 Agent」创建第一个可绑定 Skill / Tool 的 Agent。"
          action={
            <Link href="/agents/new" className={buttonClass("primary")}>
              <Plus className="size-3.5" aria-hidden />
              新建 Agent
            </Link>
          }
        />
      ) : null}

      {agents && agents.length > 0 ? (
        <div className="flex flex-col divide-y divide-card-border overflow-hidden rounded-lg border border-card-border bg-card">
          {agents.map((agent) => (
            <div key={agent.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="text-[13px] font-medium text-foreground hover:text-accent-hover"
                  >
                    {agent.name}
                  </Link>
                  <Badge status={agent.enabled ? "live" : "wip"}>
                    {agent.enabled ? "已启用" : "已禁用"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{agent.description}</p>
                <span className="font-mono text-[10px] text-subtle-foreground">
                  {agent.model_id} · {agent.bound_skill_ids.length} 个 Skill · {agent.bound_tool_ids.length} 个 Tool
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/agents/${agent.id}/run`} className={buttonClass("primary")}>
                  <Play className="size-3.5" aria-hidden />
                  运行测试
                </Link>
                <Link href={`/agents/${agent.id}/logs`} className={buttonClass("secondary")}>
                  <FileClock className="size-3.5" aria-hidden />
                  日志
                </Link>
                <Link href={`/agents/${agent.id}`} className={buttonClass("secondary")}>
                  <Settings2 className="size-3.5" aria-hidden />
                  配置
                </Link>
                <button
                  type="button"
                  disabled={togglingId === agent.id}
                  onClick={() => toggleEnabled(agent)}
                  className={buttonClass(agent.enabled ? "danger" : "secondary")}
                >
                  {agent.enabled ? (
                    <>
                      <XCircle className="size-3.5" aria-hidden />
                      禁用
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      启用
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
