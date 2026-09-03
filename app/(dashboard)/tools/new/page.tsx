"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/lib/ui-variants";
import { parseJsonResponse } from "@/lib/fetch-json";

export default function NewToolPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dataSource, setDataSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, data_source: dataSource, enabled: true }),
      });
      const data = await parseJsonResponse<{ tool: { id: string } }>(res);
      router.push(`/tools/${data.tool.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3.5">
      <PageHeader
        label="新建 Tool"
        code="MODULE / TOOLS"
        actions={
          <Link href="/tools" className={buttonClass("ghost")}>
            <ArrowLeft className="size-3.5" aria-hidden />
            返回列表
          </Link>
        }
      />

      <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 rounded-lg border border-card-border bg-card p-4">
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">名称</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如:查询员工信息 Tool"
            className="h-9 rounded-md border border-card-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">描述</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="这个 Tool 用于查询什么数据、返回什么结果"
            className="rounded-md border border-card-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-medium text-foreground">对应数据源(mock-data 文件名)</span>
          <input
            required
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            placeholder="例如:employees.json"
            className="h-9 rounded-md border border-card-border bg-background px-3 font-mono text-[12px] text-foreground outline-none focus:border-accent"
          />
        </label>

        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="pt-1">
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            <Save className="size-3.5" aria-hidden />
            {saving ? "创建中…" : "创建 Tool"}
          </button>
        </div>
      </form>
    </div>
  );
}
