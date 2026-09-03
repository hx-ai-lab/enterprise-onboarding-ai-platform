"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import { buttonClass } from "@/lib/ui-variants";
import { parseJsonResponse } from "@/lib/fetch-json";
import type { Skill } from "@/lib/types";

type FormState = {
  name: string;
  description: string;
  prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  enabled: boolean;
};

export default function EditSkillPage() {
  const params = useParams<{ skillId: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/skills/${params.skillId}`)
      .then((r) => parseJsonResponse<{ skill: Skill }>(r))
      .then((data) => {
        const s: Skill = data.skill;
        setLoadError(null);
        setForm({
          name: s.name,
          description: s.description,
          prompt: s.prompt,
          model: s.model_params.model,
          temperature: s.model_params.temperature,
          max_tokens: s.model_params.max_tokens,
          enabled: s.enabled,
        });
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "加载失败,请重试"));
  }, [params.skillId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/skills/${params.skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          prompt: form.prompt,
          model_params: {
            model: form.model,
            temperature: form.temperature,
            max_tokens: form.max_tokens,
          },
          enabled: form.enabled,
        }),
      });
      await parseJsonResponse(res);
      setSaved(true);
      router.push(`/skills/${params.skillId}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="编辑 Skill" code="MODULE / SKILLS" />
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="编辑 Skill" code="MODULE / SKILLS" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label={`编辑「${form.name}」`}
        code="MODULE / SKILLS"
        actions={
          <Link href={`/skills/${params.skillId}`} className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回详情
          </Link>
        }
      />

      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">名称</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">描述</span>
          <textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">Prompt 模板</span>
          <textarea
            required
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            rows={8}
            className="rounded-md border border-card-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground outline-none focus:border-accent"
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">模型</span>
            <input
              required
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
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
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
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
              value={form.max_tokens}
              onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })}
              className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="size-4 rounded border-card-border"
          />
          <span className="font-medium text-foreground">启用该 Skill</span>
        </label>

        {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}

        <div className="flex items-center gap-2.5 pt-1">
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            <Save className="size-3.5" aria-hidden />
            {saving ? "保存中…" : "保存"}
          </button>
          {saved ? <span className="text-xs text-status-live-text">已保存</span> : null}
        </div>
      </form>
    </div>
  );
}
