"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState } from "@/components/ui/page-states";
import { CapabilityPicker } from "@/components/agents/capability-picker";
import { buttonClass } from "@/lib/ui-variants";
import type { Skill, Tool } from "@/lib/types";

export default function NewAgentPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [tools, setTools] = useState<Tool[] | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [boundSkills, setBoundSkills] = useState<Set<string>>(new Set());
  const [boundTools, setBoundTools] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/skills").then((r) => r.json()), fetch("/api/tools").then((r) => r.json())]).then(
      ([skillData, toolData]) => {
        setSkills(skillData.skills ?? []);
        setTools(toolData.tools ?? []);
      },
    );
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          system_prompt: systemPrompt,
          model_id: modelId,
          bound_skill_ids: Array.from(boundSkills),
          bound_tool_ids: Array.from(boundTools),
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "创建失败");
      router.push(`/agents/${data.agent.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label="新建 Agent"
        code="MODULE / AGENT-CONSOLE"
        actions={
          <Link href="/agents" className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回列表
          </Link>
        }
      />

      {!skills || !tools ? (
        <LoadingState label="加载可绑定的 Skill / Tool 列表…" />
      ) : (
        <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">名称</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:入职助手 Agent"
              className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">描述</span>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">System Prompt</span>
            <textarea
              required
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">模型 ID</span>
            <input
              required
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="h-9 max-w-xs rounded-md border border-card-border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
            />
          </label>

          <CapabilityPicker
            title="绑定 Skill"
            items={skills}
            selected={boundSkills}
            onToggle={(id) =>
              setBoundSkills((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />

          <CapabilityPicker
            title="绑定 Tool"
            items={tools}
            selected={boundTools}
            onToggle={(id) =>
              setBoundTools((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <div className="pt-1">
            <button type="submit" disabled={saving} className={buttonClass("primary")}>
              <Save className="size-3.5" aria-hidden />
              {saving ? "创建中…" : "创建 Agent"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
