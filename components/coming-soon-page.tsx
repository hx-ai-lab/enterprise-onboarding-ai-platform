import { Badge } from "@/components/ui/badge";
import type { NavItem } from "@/lib/nav-items";

type ComingSoonPageProps = {
  item: NavItem;
};

export function ComingSoonPage({ item }: ComingSoonPageProps) {
  const Icon = item.icon;

  return (
    <div className="flex h-full flex-col gap-3.5">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            {item.label}
          </h1>
          <span className="font-mono text-[11px] text-subtle-foreground">
            {item.code}
          </span>
        </div>
        <div className="flex-1" />
        <Badge status="wip">开发中</Badge>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg border border-card-border bg-card p-8">
        <div className="flex max-w-md flex-col items-center gap-3.5 text-center">
          <div className="flex size-13 items-center justify-center rounded-[11px] border border-accent-subtle-border bg-accent-subtle text-accent">
            <Icon className="size-6" aria-hidden />
          </div>
          <span className="text-[15px] font-semibold text-foreground">
            {item.label}
          </span>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {item.description}。该模块开发中,界面尚未接入。
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="flex h-[30px] items-center rounded-md border border-card-border bg-muted px-3.5 text-xs font-medium text-foreground">
              查看模块规划
            </span>
            <span className="flex h-[30px] items-center rounded-md px-3.5 text-xs text-subtle-foreground">
              反馈需求
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
