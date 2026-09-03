"use client";

import { useState } from "react";
import { Bell, Menu, Search, User, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { navItems } from "@/lib/nav-items";

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-accent-foreground">
        O
      </div>
      <span className="text-[13.5px] font-semibold tracking-tight text-foreground">
        OnboardOps
      </span>
      <span className="rounded border border-sidebar-border font-mono text-[10px] text-subtle-foreground px-1.5 py-0.5">
        内部工具
      </span>
    </div>
  );
}

function SearchField() {
  return (
    <div className="flex h-[30px] items-center gap-2 rounded-md border border-sidebar-border bg-header-background px-2.5 text-subtle-foreground">
      <Search className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-xs">搜索模块、Skill、会话</span>
      <span className="font-mono text-[10px] text-subtle-foreground/80">
        ⌘K
      </span>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();
  const activeItem = navItems.find((item) => item.href === pathname);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background md:flex">
        <div className="flex flex-col gap-2.5 p-3.5 pb-2">
          <BrandMark />
          <SearchField />
        </div>
        <SidebarNav />
      </aside>

      {/* Mobile drawer */}
      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar-background shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3.5">
              <BrandMark />
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <SidebarNav onNavigate={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-header-border bg-header-background px-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="打开菜单"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <span className="hidden font-mono text-[11.5px] text-subtle-foreground md:inline">
              OnboardOps
            </span>
            <span className="hidden text-xs text-border md:inline">/</span>
            <span className="text-[13px] font-semibold text-foreground">
              {activeItem?.label ?? "OnboardOps"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-sidebar-border bg-header-background text-muted-foreground hover:border-border">
              <Bell className="size-[15px]" aria-hidden />
            </div>
            <div className="flex size-7 items-center justify-center rounded-full border border-border bg-muted">
              <User className="size-4 text-muted-foreground" aria-hidden />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
