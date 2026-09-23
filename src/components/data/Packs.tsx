import { ChevronRight, Package } from "lucide-react";
import type { Pack } from "@/lib/content/types";
import { fmtDate } from "@/components/journal/format";
import { Markdown } from "@/components/ui/Markdown";

function field(pack: Pack, key: string): string | null {
  const v = pack.frontmatter[key];
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function asDate(v: string | null): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : v;
}

export function Packs({ packs }: { packs: Pack[] }) {
  if (packs.length === 0) {
    return <p className="text-[13.5px] text-mist">No content packs.</p>;
  }
  return (
    <ul className="space-y-3">
      {packs.map((pack) => {
        const facts: [string, string | null][] = [
          ["Created", asDate(field(pack, "created"))],
          ["Facts as of", asDate(pack.factsAsOf ?? field(pack, "facts_as_of"))],
          ["Review rounds", field(pack, "review_rounds")],
          ["Owner", field(pack, "owner")],
        ];
        return (
          <li key={pack.id} className="rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-gold/35 bg-gold/[0.07]" aria-hidden>
                <Package className="h-4.5 w-4.5 text-gold" strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[18px] font-normal leading-snug text-parchment">{pack.title}</h3>
                <p className="mt-0.5 truncate font-mono text-[11px] text-mist">{pack.file}</p>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                  {facts
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="hud-label !text-[9.5px]">{k}</dt>
                        <dd className="mt-0.5 font-mono text-[12.5px] text-parchment-dim">{v}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
            {pack.body.trim() && (
              <details className="group/pack border-t border-ink-600/70">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] text-parchment-dim hover:text-parchment [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 text-mist transition-transform group-open/pack:rotate-90" />
                  Review log, open questions and sources
                </summary>
                <div className="max-h-[560px] overflow-y-auto border-t border-ink-600/50 px-5 py-4 text-[13.5px]">
                  <Markdown>{pack.body}</Markdown>
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
