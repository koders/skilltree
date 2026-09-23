import Link from "next/link";

/** Constellation glyph + wordmark. */
export function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="skilltree home">
      <svg viewBox="0 0 64 64" className="h-7 w-7 shrink-0" aria-hidden>
        <g stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" opacity="0.8">
          <line x1="32" y1="34" x2="16" y2="18" />
          <line x1="32" y1="34" x2="48" y2="20" />
          <line x1="32" y1="34" x2="32" y2="52" />
          <line x1="48" y1="20" x2="52" y2="8" />
        </g>
        <circle cx="32" cy="34" r="6.5" fill="var(--gold-bright)" className="transition-[r] group-hover:[r:7.5]" />
        <circle cx="16" cy="18" r="4" fill="var(--branch-1)" />
        <circle cx="48" cy="20" r="4" fill="var(--branch-3)" />
        <circle cx="32" cy="52" r="4" fill="var(--branch-2)" />
        <circle cx="52" cy="8" r="2.6" fill="var(--branch-3)" />
      </svg>
      <span className="font-display text-[19px] font-medium tracking-tight text-parchment [font-variation-settings:'SOFT'_100,'WONK'_1]">
        skilltree
      </span>
    </Link>
  );
}
