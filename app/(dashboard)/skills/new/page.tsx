"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/lib/ui-variants";

export default function NewSkillPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(800);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          prompt,
          model_params: { model, temperature, max_tokens: maxTokens },
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "创建失败");
      router.push(`/skills/${data.skill.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label="新建 Skill"
        code="MODULE / SKILLS"
        actions={
          <Link href="/skills" className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回列表
          </Link>
        }
      />

      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">名称</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如:入职问题结构化 Skill"
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
            placeholder="这个 Skill 用来做什么"
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">Prompt 模板</span>
          <textarea
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="描述该 Skill 的系统 Prompt,包括输入/输出 JSON 约定"
            className="rounded-md border border-card-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">模型</span>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 rounded-md border border-card-border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">Temperature</span>
            <input
              required
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">Max Tokens</span>
            <input
              required
              type="number"
              step="1"
              min={1}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          新建的 Skill 在 Mock 模式下会返回通用模拟输出(不报错),如需接入真实业务流程,请参考内置的 6
          个 Skill 实现方式扩展执行逻辑。
        </p>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="pt-1">
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            <Save className="size-3.5" aria-hidden />
            {saving ? "创建中…" : "创建 Skill"}
          </button>
        </div>
      </form>
    </div>
  );
}
