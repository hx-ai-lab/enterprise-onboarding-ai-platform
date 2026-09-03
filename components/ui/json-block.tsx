export function JsonBlock({
  label,
  data,
  defaultOpen = false,
}: {
  label: string;
  data: unknown;
  defaultOpen?: boolean;
}) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return (
    <details
      className="group rounded-md border border-card-border bg-muted/60 open:bg-muted"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-subtle-foreground select-none">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all border-t border-card-border px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground">
        {text}
      </pre>
    </details>
  );
}
