"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileClock,
  Play,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import { CapabilityPicker } from "@/components/agents/capability-picker";
import { buttonClass } from "@/lib/ui-variants";
import type { Agent, Skill, Tool } from "@/lib/types";

type FormState = {
  name: string;
  description: string;
  system_prompt: string;
  model_id: string;
  bound_skill_ids: Set<string>;
  bound_tool_ids: Set<string>;
};

export default function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [tools, setTools] = useState<Tool[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/agents/${params.agentId}`).then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "未找到该 Agent" : `加载失败(状态码 ${r.status})`);
        return r.json();
      }),
      fetch("/api/skills").then((r) => r.json()),
      fetch("/api/tools").then((r) => r.json()),
    ])
      .then(([agentData, skillData, toolData]) => {
        const a: Agent = agentData.agent;
        setError(null);
        setAgent(a);
        setSkills(skillData.skills ?? []);
        setTools(toolData.tools ?? []);
        setForm({
          name: a.name,
          description: a.description,
          system_prompt: a.system_prompt,
          model_id: a.model_id,
          bound_skill_ids: new Set(a.bound_skill_ids),
          bound_tool_ids: new Set(a.bound_tool_ids),
        });
      })
      .catch((e) => setError(e.message));
  }, [params.agentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/agents/${params.agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          system_prompt: form.system_prompt,
          model_id: form.model_id,
          bound_skill_ids: Array.from(form.bound_skill_ids),
          bound_tool_ids: Array.from(form.bound_tool_ids),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "保存失败");
      setSaved(true);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    if (!agent) return;
    const res = await fetch(`/api/agents/${params.agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });
    if (res.ok) load();
  }

  async function remove() {
    if (!confirm(`确认删除 Agent「${agent?.name}」吗?此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents/${params.agentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/agents");
    } catch {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Agent 详情" code="MODULE / AGENT-CONSOLE" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!agent || !form || !skills || !tools) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Agent 详情" code="MODULE / AGENT-CONSOLE" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label={agent.name}
        code="MODULE / AGENT-CONSOLE"
        actions={
          <>
            <Link href="/agents" className={buttonClass("ghost")}>
              <ArrowLeft className="size-3.5" aria-hidden />
              返回列表
            </Link>
            <Link href={`/agents/${agent.id}/run`} className={buttonClass("primary")}>
              <Play className="size-3.5" aria-hidden />
              运行测试
            </Link>
            <Link href={`/agents/${agent.id}/logs`} className={buttonClass("secondary")}>
              <FileClock className="size-3.5" aria-hidden />
              执行日志
            </Link>
            <button type="button" onClick={toggleEnabled} className={buttonClass(agent.enabled ? "danger" : "secondary")}>
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
            <button type="button" disabled={deleting} onClick={remove} className={buttonClass("danger")}>
              <Trash2 className="size-3.5" aria-hidden />
              删除
            </button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <Badge status={agent.enabled ? "live" : "wip"}>{agent.enabled ? "已启用" : "已禁用"}</Badge>
        <span className="text-xs text-subtle-foreground">禁用后该 Agent 将拒绝运行测试请求。</span>
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
            rows={2}
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">System Prompt</span>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
            rows={4}
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">模型 ID</span>
          <input
            value={form.model_id}
            onChange={(e) => setForm({ ...form, model_id: e.target.value })}
            className="h-9 max-w-xs rounded-md border border-card-border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
          />
        </label>

        <CapabilityPicker
          title="绑定 Skill"
          items={skills}
          selected={form.bound_skill_ids}
          onToggle={(id) =>
            setForm((prev) => {
              if (!prev) return prev;
              const next = new Set(prev.bound_skill_ids);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return { ...prev, bound_skill_ids: next };
            })
          }
        />
        <CapabilityPicker
          title="绑定 Tool"
          items={tools}
          selected={form.bound_tool_ids}
          onToggle={(id) =>
            setForm((prev) => {
              if (!prev) return prev;
              const next = new Set(prev.bound_tool_ids);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return { ...prev, bound_tool_ids: next };
            })
          }
        />

        <div className="flex items-center gap-2.5 pt-1">
          <button type="button" disabled={saving} onClick={save} className={buttonClass("primary")}>
            <Save className="size-3.5" aria-hidden />
            {saving ? "保存中…" : "保存"}
          </button>
          {saved ? <span className="text-xs text-status-live-text">已保存,Agent 控制台将立即读取最新配置</span> : null}
        </div>
      </div>
    </div>
  );
}
