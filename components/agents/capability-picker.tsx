import { Badge } from "@/components/ui/badge";

type Item = { id: string; name: string; description: string; enabled: boolean };

export function CapabilityPicker({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: Item[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-subtle-foreground">{title}</span>
      <div className="flex flex-col divide-y divide-card-border rounded-md border border-card-border">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2.5 px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => onToggle(item.id)}
              className="mt-0.5 size-4 shrink-0 rounded border-card-border"
            />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium text-foreground">
                {item.name}
                <Badge status={item.enabled ? "live" : "wip"}>{item.enabled ? "已启用" : "已禁用"}</Badge>
              </span>
              <span className="text-subtle-foreground">{item.description}</span>
            </span>
          </label>
        ))}
        {items.length === 0 ? (
          <div className="px-3 py-3 text-center text-subtle-foreground">暂无数据</div>
        ) : null}
      </div>
    </div>
  );
}
