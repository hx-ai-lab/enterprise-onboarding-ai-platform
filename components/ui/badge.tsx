import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeProps = {
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ icon: Icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-medium text-muted-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}
