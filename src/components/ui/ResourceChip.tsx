import { ExternalLink } from "lucide-react";
import { resourceTypeMeta } from "./meta";

/** A typed resource link, roadmap.sh-style. `@search@` links get a dashed "to resolve" look. */
export function ResourceChip({ type, title, url }: { type: string; title: string; url: string }) {
  const meta = resourceTypeMeta(type);
  const Icon = meta.icon;
  const unresolved = type === "search";
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={unresolved ? `${meta.label}: not yet resolved to an exact video` : `${meta.label}: ${url}`}
      className={
        "group/chip mx-0.5 inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-[1px] align-baseline text-[0.92em] !no-underline transition-colors " +
        (unresolved
          ? "border-dashed border-ink-400 text-parchment-dim hover:border-mist hover:text-parchment"
          : "border-ink-500 bg-ink-700/60 text-parchment hover:border-gold/70 hover:bg-ink-700")
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-mist group-hover/chip:text-gold" strokeWidth={1.8} />
      <span className="font-mono text-[0.78em] uppercase tracking-wider text-mist">{meta.label}</span>
      <span className="truncate">{title}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/chip:opacity-60" />
    </a>
  );
}
