"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups, navItems } from "@/lib/nav-items";

type SidebarNavProps = {
  onNavigate?: () => void;
};

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-2">
      {navGroups.map((group) => (
        <div key={group} className="flex flex-col gap-0.5">
          <div className="px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-subtle-foreground">
            {group}
          </div>
          {navItems
            .filter((item) => item.group === group)
            .map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md py-1.5 pl-2.5 pr-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-accent-subtle font-semibold text-accent-hover"
                      : "font-normal text-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-sm",
                      isActive ? "bg-accent" : "bg-transparent",
                    )}
                    aria-hidden
                  />
                  <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {isActive ? (
                    <span className="shrink-0 rounded-sm border border-accent-subtle-border px-1 font-mono text-[9.5px] tracking-wide text-accent-hover">
                      WIP
                    </span>
                  ) : null}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
