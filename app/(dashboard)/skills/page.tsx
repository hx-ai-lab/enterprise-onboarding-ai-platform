"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FlaskConical, Pencil, Plus, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-states";
import { buttonClass } from "@/lib/ui-variants";
import type { Skill } from "@/lib/types";

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/skills")
      .then((r) => {
        if (!r.ok) throw new Error(`加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setError(null);
        setSkills(data.skills ?? []);
      })
      .catch(() => setError("Skill 列表加载失败,请重试"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(skill: Skill) {
    setTogglingId(skill.id);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !skill.enabled }),
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
        label="Skills"
        code="MODULE / SKILLS"
        actions={
          <Link href="/skills/new" className={buttonClass("primary")}>
            <Plus className="size-3.5" aria-hidden />
            新建 Skill
          </Link>
        }
      />

      {skills === null && !error ? <LoadingState label="Skill 列表加载中…" /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {skills && skills.length === 0 ? (
        <EmptyState
          title="暂无 Skill"
          description="点击右上角「新建 Skill」创建第一个可被 Agent 调用的技能。"
          action={
            <Link href="/skills/new" className={buttonClass("primary")}>
              <Plus className="size-3.5" aria-hidden />
              新建 Skill
            </Link>
          }
        />
      ) : null}

      {skills && skills.length > 0 ? (
        <div className="flex flex-col divide-y divide-card-border overflow-hidden rounded-lg border border-card-border bg-card">
          {skills.map((skill) => (
            <div key={skill.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/skills/${skill.id}`}
                    className="text-[13px] font-medium text-foreground hover:text-accent-hover"
                  >
                    {skill.name}
                  </Link>
                  <Badge status={skill.enabled ? "live" : "wip"}>
                    {skill.enabled ? "已启用" : "已禁用"}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{skill.description}</p>
                <span className="font-mono text-[10px] text-subtle-foreground">
                  {skill.model_params.model} · temperature {skill.model_params.temperature}
                  {skill.last_test ? ` · 最近测试于 ${new Date(skill.last_test.tested_at).toLocaleString("zh-CN")}` : " · 尚未测试"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link href={`/skills/${skill.id}/test`} className={buttonClass("secondary")}>
                  <FlaskConical className="size-3.5" aria-hidden />
                  测试
                </Link>
                <Link href={`/skills/${skill.id}/edit`} className={buttonClass("secondary")}>
                  <Pencil className="size-3.5" aria-hidden />
                  编辑
                </Link>
                <button
                  type="button"
                  disabled={togglingId === skill.id}
                  onClick={() => toggleEnabled(skill)}
                  className={buttonClass(skill.enabled ? "danger" : "secondary")}
                >
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
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
