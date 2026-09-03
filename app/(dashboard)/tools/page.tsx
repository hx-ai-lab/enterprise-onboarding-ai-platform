"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-states";
import { buttonClass } from "@/lib/ui-variants";
import type { Tool } from "@/lib/types";

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/tools")
      .then((r) => {
        if (!r.ok) throw new Error(`加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setTools(data.tools ?? []);
      })
      .catch(() => setError("Tool 列表加载失败,请重试"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(tool: Tool) {
    setTogglingId(tool.id);
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !tool.enabled }),
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
        label="Tools"
        code="MODULE / TOOLS"
        actions={
          <Link href="/tools/new" className={buttonClass("primary")}>
            <Plus className="size-3.5" aria-hidden />
            新建 Tool
          </Link>
        }
      />

      {tools === null && !error ? <LoadingState label="Tool 列表加载中…" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {tools && tools.length === 0 ? (
        <EmptyState
          title="暂无 Tool"
          description="点击右上角「新建 Tool」创建第一个数据查询工具。"
          action={
            <Link href="/tools/new" className={buttonClass("primary")}>
              <Plus className="size-3.5" aria-hidden />
              新建 Tool
            </Link>
          }
        />
      ) : null}

      {tools && tools.length > 0 ? (
        <div className="flex flex-col divide-y divide-card-border overflow-hidden rounded-lg border border-card-border bg-card">
          {tools.map((tool) => (
            <div key={tool.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Link href={`/tools/${tool.id}`} className="text-[13px] font-medium text-foreground hover:text-accent-hover">
                    {tool.name}
                  </Link>
                  <Badge status={tool.enabled ? "live" : "wip"}>
                    {tool.enabled ? "已启用" : "已禁用"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{tool.description}</p>
                <span className="font-mono text-[10px] text-subtle-foreground">
                  数据源:{tool.data_source}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/tools/${tool.id}`} className={buttonClass("secondary")}>
                  编辑
                </Link>
                <button
                  type="button"
                  disabled={togglingId === tool.id}
                  onClick={() => toggleEnabled(tool)}
                  className={buttonClass(tool.enabled ? "danger" : "secondary")}
                >
                  {tool.enabled ? (
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
