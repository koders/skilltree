import clsx from "clsx";
import { ChevronRight, CircleCheck, CircleX, Search, TriangleAlert } from "lucide-react";
import type { Diagnostic } from "@/lib/content/types";
import type { ValidationSummary } from "@/lib/content/validate";

interface FileGroup {
  file: string;
  diags: Diagnostic[];
}

function groupByFile(diags: Diagnostic[]): FileGroup[] {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diags) {
    const file = d.file ?? "(no file)";
    map.set(file, [...(map.get(file) ?? []), d]);
  }
  return [...map].map(([file, list]) => ({ file, diags: list }));
}

function DiagList({ groups, tone }: { groups: FileGroup[]; tone: "error" | "warning" }) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.file}>
          <p className="truncate font-mono text-[11.5px] text-parchment-dim" title={g.file}>
            {g.file}
          </p>
          <ul className="mt-1.5 space-y-1">
            {g.diags.map((d, i) => (
              <li
                key={`${d.code}-${d.line ?? 0}-${i}`}
                className="grid grid-cols-[48px_1fr] gap-x-3 gap-y-0.5 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-ink-800/60 sm:grid-cols-[56px_150px_1fr]"
              >
                <span className="font-mono text-[11px] text-mist" title={d.line != null ? `${g.file}:${d.line}` : g.file}>
                  {d.line != null ? `:${d.line}` : "—"}
                </span>
                <span
                  className={clsx(
                    "truncate font-mono text-[11px]",
                    tone === "error" ? "text-danger" : "text-stale",
                  )}
                >
                  {d.code}
                </span>
                <span className="col-span-2 leading-snug text-parchment-dim sm:col-span-1">{d.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Health({ diagnostics, summary }: { diagnostics: Diagnostic[]; summary: ValidationSummary }) {
  const errors = groupByFile(diagnostics.filter((d) => d.severity === "error"));
  const warnings = groupByFile(diagnostics.filter((d) => d.severity === "warning"));
  const codes = Object.entries(summary.byCode).sort((a, b) => b[1] - a[1]);
  const clean = summary.errors === 0;

  return (
    <div className="rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink-600/70 px-5 py-4">
        <span className={clsx("flex items-center gap-2 text-[14px]", clean ? "text-ok" : "text-danger")}>
          {clean ? <CircleCheck className="h-4.5 w-4.5" strokeWidth={1.9} /> : <CircleX className="h-4.5 w-4.5" strokeWidth={1.9} />}
          {clean ? "Content passes every hard rule" : `${summary.errors} error${summary.errors === 1 ? "" : "s"} to fix`}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-stale">
          <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.9} />
          {summary.warnings} warnings
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-parchment-dim">
          <Search className="h-3.5 w-3.5 text-mist" strokeWidth={1.9} />
          {summary.searchLinks} @search@ links to resolve
        </span>
      </div>

      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-ink-600/70 px-5 py-3">
          {codes.map(([code, n]) => (
            <span key={code} className="rounded-md border border-ink-600 bg-ink-800/60 px-1.5 py-[1px] font-mono text-[11px] text-mist">
              {code} <span className="text-parchment-dim">{n}</span>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-5 px-5 py-4">
        {errors.length > 0 && (
          <div>
            <p className="hud-label mb-3 !text-danger">Errors</p>
            <DiagList groups={errors} tone="error" />
          </div>
        )}
        {warnings.length > 0 ? (
          <details className="group/warn">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 text-[13px] text-parchment-dim hover:text-parchment [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 text-mist transition-transform group-open/warn:rotate-90" />
              {summary.warnings} warnings in {warnings.length} files
              <span className="text-[12px] text-mist">· quality checks, not blockers</span>
            </summary>
            <div className="mt-3">
              <DiagList groups={warnings} tone="warning" />
            </div>
          </details>
        ) : (
          errors.length === 0 && <p className="text-[13px] text-mist">No warnings either. Spotless.</p>
        )}
      </div>
    </div>
  );
}
