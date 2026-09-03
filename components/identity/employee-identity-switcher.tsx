"use client";

import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentEmployee } from "@/lib/hooks/use-current-employee";
import { ONBOARDING_STAGE_LABELS } from "@/lib/types";

export function EmployeeIdentitySwitcher() {
  const [open, setOpen] = useState(false);
  const { employee, employees, loading, setEmployeeId } = useCurrentEmployee();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-muted pl-1 pr-2 text-xs text-foreground hover:border-accent-subtle-border"
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-card">
          <User className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
        <span className="hidden max-w-24 truncate font-medium sm:inline">
          {loading ? "加载中…" : employee ? employee.name : "选择身份"}
        </span>
        <ChevronDown className="size-3 shrink-0 text-subtle-foreground" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="关闭"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-card-border bg-card p-1.5 shadow-lg">
            <div className="px-2 py-1.5 text-[11px] font-medium text-subtle-foreground">
              切换模拟员工身份
            </div>
            <div className="max-h-72 overflow-y-auto">
              {employees.map((e) => {
                const isActive = e.id === employee?.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEmployeeId(e.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-xs",
                      isActive ? "bg-accent-subtle text-accent-hover" : "hover:bg-muted text-foreground",
                    )}
                  >
                    <span className="font-medium">
                      {e.name} · {e.department} / {e.position}
                    </span>
                    <span className="text-[11px] text-subtle-foreground">
                      {ONBOARDING_STAGE_LABELS[e.onboarding_stage]}
                    </span>
                  </button>
                );
              })}
              {!loading && employees.length === 0 ? (
                <div className="px-2 py-3 text-center text-[11px] text-subtle-foreground">
                  暂无可选员工数据
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
