import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border border-card-border bg-card text-foreground hover:bg-muted",
  ghost: "text-subtle-foreground hover:bg-muted hover:text-foreground",
  danger: "border border-status-wip-border bg-status-wip-bg text-status-wip-text hover:brightness-95",
};

export function buttonClass(variant: ButtonVariant = "secondary", className?: string) {
  return cn(BASE, VARIANTS[variant], className);
}
