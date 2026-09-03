import { Clock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ComingSoonPageProps = {
  title: string;
  icon: LucideIcon;
  description?: string;
};

export function ComingSoonPage({
  title,
  icon: Icon,
  description = "该模块开发中,敬请期待。",
}: ComingSoonPageProps) {
  return (
    <div className="flex h-full flex-col">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      </div>

      <div className="mt-6 flex flex-1 items-center justify-center rounded-lg border border-border bg-card">
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
            <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-base text-foreground">{description}</p>
          <Badge icon={Clock}>规划中</Badge>
        </div>
      </div>
    </div>
  );
}
