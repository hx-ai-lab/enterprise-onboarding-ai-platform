"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FlaskConical, Pencil, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import { JsonBlock } from "@/components/ui/json-block";
import { buttonClass } from "@/lib/ui-variants";
import type { Skill } from "@/lib/types";

export default function SkillDetailPage() {
  const params = useParams<{ skillId: string }>();
  const router = useRouter();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/skills/${params.skillId}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "未找到该 Skill" : `加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setSkill(data.skill);
      })
      .catch((e) => setError(e.message));
  }, [params.skillId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled() {
    if (!skill) return;
    const res = await fetch(`/api/skills/${params.skillId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !skill.enabled }),
    });
    if (res.ok) load();
  }

  async function remove() {
    if (!confirm(`确认删除 Skill「${skill?.name}」吗?此操作不可撤销。`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/skills/${params.skillId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      router.push("/skills");
    } catch {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Skill 详情" code="MODULE / SKILLS" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="Skill 详情" code="MODULE / SKILLS" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label={skill.name}
        code="MODULE / SKILLS"
        actions={
          <>
            <Link href="/skills" className={buttonClass("ghost")}>
              <ArrowLeft className="size-3.5" aria-hidden />
              返回列表
            </Link>
            <Link href={`/skills/${skill.id}/test`} className={buttonClass("secondary")}>
              <FlaskConical className="size-3.5" aria-hidden />
              测试
            </Link>
            <Link href={`/skills/${skill.id}/edit`} className={buttonClass("secondary")}>
              <Pencil className="size-3.5" aria-hidden />
              编辑
            </Link>
            <button type="button" onClick={toggleEnabled} className={buttonClass(skill.enabled ? "danger" : "secondary")}>
              {skill.enabled ? (
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
        <Badge status={skill.enabled ? "live" : "wip"}>{skill.enabled ? "已启用" : "已禁用"}</Badge>
        <span className="text-xs text-subtle-foreground">
          禁用后,Planner 将不会在新生成的执行计划中包含该 Skill,手动调用也会被拒绝。
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-subtle-foreground">描述</span>
          <p className="text-[13px] text-foreground">{skill.description}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-subtle-foreground">Prompt 模板</span>
          <pre className="whitespace-pre-wrap rounded-md border border-card-border bg-muted px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground">
            {skill.prompt}
          </pre>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-subtle-foreground">模型</span>
            <span className="font-mono text-xs text-foreground">{skill.model_params.model}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-subtle-foreground">Temperature</span>
            <span className="font-mono text-xs text-foreground">{skill.model_params.temperature}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-subtle-foreground">Max Tokens</span>
            <span className="font-mono text-xs text-foreground">{skill.model_params.max_tokens}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-4">
        <span className="text-[11px] font-medium text-subtle-foreground">最近一次测试</span>
        {skill.last_test ? (
          <>
            <span className="text-xs text-muted-foreground">
              测试时间:{new Date(skill.last_test.tested_at).toLocaleString("zh-CN")}
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <JsonBlock label="输入 Input" data={skill.last_test.input} defaultOpen />
              <JsonBlock label="输出 Output" data={skill.last_test.output} defaultOpen />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">尚未测试过,点击右上角「测试」进行首次测试。</p>
        )}
      </div>
    </div>
  );
}
