"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FlaskConical, Play } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/page-states";
import { JsonBlock } from "@/components/ui/json-block";
import { buttonClass } from "@/lib/ui-variants";
import { useCurrentEmployee } from "@/lib/hooks/use-current-employee";
import type { Skill } from "@/lib/types";

const TEST_CONFIG: Record<string, { needsText: boolean; label: string; placeholder: string }> = {
  "skill-question-structuring": {
    needsText: true,
    label: "员工问题",
    placeholder: "例如:我入职第一天需要做什么",
  },
  "skill-task-decision": {
    needsText: false,
    label: "",
    placeholder: "",
  },
  "skill-process-explain": {
    needsText: false,
    label: "",
    placeholder: "",
  },
  "skill-policy-qa": {
    needsText: true,
    label: "员工问题",
    placeholder: "例如:请假需要提前多久申请",
  },
  "skill-reply-generation": {
    needsText: true,
    label: "员工问题",
    placeholder: "例如:我什么时候能拿到工卡",
  },
  "skill-compliance-review": {
    needsText: true,
    label: "待审核的回复文本(草稿)",
    placeholder: "粘贴一段待审核的回复草稿,例如包含承诺性用语或联系方式的文本",
  },
};

const DEFAULT_CONFIG = { needsText: true, label: "测试输入", placeholder: "输入一段测试文本" };

type TestResult = {
  input: unknown;
  output: unknown;
  mocked: boolean;
  mock_reason?: string;
  tested_at: string;
};

export default function SkillTestPage() {
  const params = useParams<{ skillId: string }>();
  const skillId = params.skillId;
  const { employee, employees, setEmployeeId } = useCurrentEmployee();

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const load = useCallback(() => {
    fetch(`/api/skills/${skillId}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "未找到该 Skill" : `加载失败(状态码 ${r.status})`);
        return r.json();
      })
      .then((data) => {
        setLoadError(null);
        setSkill(data.skill);
      })
      .catch((e) => setLoadError(e.message));
  }, [skillId]);

  useEffect(() => {
    load();
  }, [load]);

  const config = TEST_CONFIG[skillId] ?? DEFAULT_CONFIG;

  async function runTest() {
    if (!employee) return;
    if (config.needsText && !question.trim()) {
      setRunError("请先填写测试输入");
      return;
    }
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/skills/${skillId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: config.needsText ? question : "(无文本输入,基于所选员工数据测试)",
          employee_id: employee.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "测试执行失败");
      setResult(data);
      load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "测试执行失败");
    } finally {
      setRunning(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="测试 Skill" code="MODULE / SKILLS" />
        <ErrorState message={loadError} onRetry={load} />
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex h-full flex-col gap-3.5">
        <PageHeader label="测试 Skill" code="MODULE / SKILLS" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label={`测试「${skill.name}」`}
        code="MODULE / SKILLS"
        actions={
          <Link href={`/skills/${skillId}`} className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回详情
          </Link>
        }
      />

      {!skill.enabled ? (
        <div className="rounded-lg border border-status-wip-border bg-status-wip-bg px-3.5 py-2.5 text-xs text-status-wip-text">
          该 Skill 当前已被禁用,运行测试会被系统拒绝。请先在详情页启用后再测试。
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">模拟员工身份</span>
          <select
            value={employee?.id ?? ""}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {e.department} / {e.position}
              </option>
            ))}
          </select>
        </label>

        {config.needsText ? (
          <label className="flex flex-col gap-1.5 text-xs">
            <span className="font-medium text-foreground">{config.label}</span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={config.placeholder}
              rows={3}
              className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
            />
          </label>
        ) : (
          <p className="text-xs text-muted-foreground">
            该 Skill 不需要额外文本输入,系统会基于所选员工的真实入职任务数据自动构建测试输入。
          </p>
        )}

        {runError ? <p className="text-xs text-red-600">{runError}</p> : null}

        <div>
          <button type="button" disabled={running || !employee} onClick={runTest} className={buttonClass("primary")}>
            <Play className="size-3.5" aria-hidden />
            {running ? "运行中…" : "运行测试"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-subtle-foreground">
            <FlaskConical className="size-3.5" aria-hidden />
            本次测试结果 · {new Date(result.tested_at).toLocaleString("zh-CN")}
          </div>
          {result.mocked ? (
            <div className="rounded-md border border-accent-subtle-border bg-accent-subtle px-2.5 py-1.5 text-xs text-accent-hover">
              {result.mock_reason ?? "已使用 Mock 模式"}
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <JsonBlock label="输入 Input" data={result.input} defaultOpen />
            <JsonBlock label="输出 Output" data={result.output} defaultOpen />
          </div>
        </div>
      ) : null}
    </div>
  );
}
