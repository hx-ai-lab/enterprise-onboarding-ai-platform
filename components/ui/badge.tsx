import { cn } from "@/lib/utils";

type BadgeStatus = "live" | "wip";

type BadgeProps = {
  status?: BadgeStatus;
  children: React.ReactNode;
  className?: string;
};

const STATUS_STYLES: Record<BadgeStatus, { chip: string; dot: string }> = {
  live: {
    chip: "border-status-live-border bg-status-live-bg text-status-live-text",
    dot: "bg-status-live-dot",
  },
  wip: {
    chip: "border-status-wip-border bg-status-wip-bg text-status-wip-text",
    dot: "bg-accent",
  },
};

export function Badge({ status = "wip", children, className }: BadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium tracking-wide",
        styles.chip,
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)}
        aria-hidden
      />
      {children}
    </span>
  );
}
