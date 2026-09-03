export function PageHeader({
  label,
  code,
  actions,
}: {
  label: string;
  code: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{label}</h1>
        <span className="font-mono text-[11px] text-subtle-foreground">{code}</span>
      </div>
      <div className="flex-1" />
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
