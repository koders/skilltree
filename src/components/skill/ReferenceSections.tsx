"use client";

import { ChevronRight, ExternalLink } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { usePanel } from "./context";
import { SectionHeading } from "./parts";

/** Sources, then the review log and any extra sections, collapsed. */
export function ReferenceSections() {
  const { skill } = usePanel();
  const extraMeta = Object.entries(skill.extraMeta);
  const collapsed = [
    ...(skill.reviewLog ? [{ heading: "Review log", body: skill.reviewLog }] : []),
    ...skill.sections.map((s) => ({ heading: s.heading, body: s.body })),
  ];
  if (skill.sources.length === 0 && collapsed.length === 0 && extraMeta.length === 0) return null;

  return (
    <section aria-labelledby="sources-heading" className="space-y-3">
      {skill.sources.length > 0 && (
        <div>
          <SectionHeading id="sources-heading" title="Sources" meta={skill.sources.length} />
          <ul className="space-y-1.5">
            {skill.sources.map((s) => (
              <li key={`${s.url}-${s.line}`} className="text-[13px] leading-snug">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-baseline gap-1.5 text-parchment-dim hover:text-parchment"
                >
                  <ExternalLink className="h-3 w-3 shrink-0 translate-y-[1px] text-mist-dim group-hover:text-gold" />
                  <span className="underline decoration-ink-500 underline-offset-[3px] group-hover:decoration-gold">
                    {s.title}
                  </span>
                </a>
                {s.note && <span className="ml-1.5 font-mono text-[10.5px] text-mist-dim">{s.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {extraMeta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          {extraMeta.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-mist">{k}</dt>
              <dd className="text-parchment-dim">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {collapsed.map((s, i) => (
        <details key={`${s.heading}-${i}`} className="group rounded-lg border border-ink-600/80 bg-ink-850/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 text-mist transition-transform group-open:rotate-90" />
            <span className="hud-label">{s.heading}</span>
          </summary>
          <Markdown className="border-t border-ink-600/70 px-3 py-2.5 text-[12.5px]">{s.body}</Markdown>
        </details>
      ))}
    </section>
  );
}
