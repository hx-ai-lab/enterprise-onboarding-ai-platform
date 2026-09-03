"use client";

import { useState } from "react";
import { Menu, User, X } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar-background md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <span className="text-base font-semibold text-foreground">
            OnboardOps
          </span>
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
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <span className="text-base font-semibold text-foreground">
                OnboardOps
              </span>
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <SidebarNav onNavigate={() => setIsDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border bg-sidebar-background px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="打开菜单"
              onClick={() => setIsDrawerOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
            <span className="text-base font-semibold text-foreground md:hidden">
              OnboardOps
            </span>
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted">
            <User className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
