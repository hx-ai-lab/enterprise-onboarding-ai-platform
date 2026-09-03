"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Save, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import { buttonClass } from "@/lib/ui-variants";
import type { Tool } from "@/lib/types";

export default function ToolDetailPage() {
  const params = useParams<{ toolId: string }>();
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [form, setForm] = useState<Pick<Tool, "name" | "description" | "data_source"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/tools/${params.toolId}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "未找到该 Tool" : `加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setTool(data.tool);
        setForm({ name: data.tool.name, description: data.tool.description, data_source: data.tool.data_source });
      })
      .catch((e) => setError(e.message));
  }, [params.toolId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tools/${params.toolId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "保存失败");
      }
      setFeedback("已保存,Agent 控制台将立即读取最新配置。");
      load();
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    if (!tool) return;
    const res = await fetch(`/api/tools/${params.toolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !tool.enabled }),
    });
    if (res.ok) load();
  }

  async function remove() {
    if (!confirm(`确认删除 Tool「${tool?.name}」吗?此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tools/${params.toolId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/tools");
    } catch {
      setFeedback("删除失败,请重试");
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Tool 详情" code="MODULE / TOOLS" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!tool || !form) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Tool 详情" code="MODULE / TOOLS" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label={tool.name}
        code="MODULE / TOOLS"
        actions={
          <>
            <Link href="/tools" className={buttonClass("ghost")}>
              <ArrowLeft className="size-3.5" aria-hidden />
              返回列表
            </Link>
            <button type="button" onClick={toggleEnabled} className={buttonClass(tool.enabled ? "danger" : "secondary")}>
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
            <button type="button" disabled={deleting} onClick={remove} className={buttonClass("danger")}>
              <Trash2 className="size-3.5" aria-hidden />
              删除
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <Badge status={tool.enabled ? "live" : "wip"}>{tool.enabled ? "已启用" : "已禁用"}</Badge>
        <span className="text-xs text-subtle-foreground">
          禁用后,Planner 将不会在新生成的执行计划中包含该 Tool,手动调用也会被拒绝。
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">名称</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">描述</span>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">对应数据源(mock-data 文件名)</span>
          <input
            value={form.data_source}
            onChange={(e) => setForm({ ...form, data_source: e.target.value })}
            className="h-9 rounded-md border border-card-border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
          />
        </label>

        <div className="flex items-center gap-2.5 pt-1">
          <button type="button" disabled={saving} onClick={save} className={buttonClass("primary")}>
            <Save className="size-3.5" aria-hidden />
            {saving ? "保存中…" : "保存"}
          </button>
          {feedback ? <span className="text-xs text-muted-foreground">{feedback}</span> : null}
        </div>
      </div>
    </div>
  );
}
