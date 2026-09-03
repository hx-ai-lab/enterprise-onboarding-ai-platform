import { AlertTriangle, Inbox, Loader2, type LucideIcon } from "lucide-react";
import { buttonClass } from "@/lib/ui-variants";

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-card-border bg-card p-10 text-[13px] text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-status-wip-border bg-status-wip-bg p-10 text-center">
      <AlertTriangle className="size-6 text-status-wip-text" aria-hidden />
      <p className="text-[13px] font-semibold text-status-wip-text">出错了</p>
      <p className="max-w-md text-xs leading-relaxed text-status-wip-text/85">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
          重试
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-lg border border-card-border bg-card p-10 text-center">
      <div className="flex size-11 items-center justify-center rounded-[10px] border border-accent-subtle-border bg-accent-subtle text-accent">
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="text-[13px] font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
