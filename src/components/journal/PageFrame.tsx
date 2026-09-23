// Page scaffolding shared by the habits, loot, journal and data pages: the
// content column, an atlas-plate header, section headings and skill links.

import clsx from "clsx";
import Link from "next/link";

export function PageFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("relative mx-auto w-full max-w-[1100px] px-4 pb-28 pt-8 sm:px-6 sm:pt-12", className)}>
      {children}
    </div>
  );
}

/** Four-point star used as a bullet and divider ornament. */
export function StarGlyph({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 16 16" className={clsx("h-3 w-3 shrink-0", className)} style={style} aria-hidden>
      <path d="M8 0 L9.3 6.7 L16 8 L9.3 9.3 L8 16 L6.7 9.3 L0 8 L6.7 6.7 Z" fill="currentColor" />
    </svg>
  );
}

/** A hairline with graticule ticks, like the edge of a star chart. */
export function Graticule({ className }: { className?: string }) {
  return (
    <div className={clsx("relative h-2", className)} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--ink-500), var(--ink-500)), repeating-linear-gradient(90deg, var(--ink-500) 0 1px, transparent 1px 28px)",
          backgroundSize: "100% 1px, 100% 5px",
          backgroundPosition: "left bottom, left bottom",
          backgroundRepeat: "no-repeat, repeat-x",
          maskImage: "linear-gradient(90deg, black, black 70%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, black, black 70%, transparent)",
        }}
      />
      <span className="absolute -bottom-[3.5px] left-0 h-2 w-2 rotate-45 border border-gold bg-ink-900 shadow-[0_0_8px_var(--gold)]" />
    </div>
  );
}

export function PageHeader({
  plate,
  eyebrow,
  title,
  subtitle,
  aside,
  children,
}: {
  /** Atlas plate numeral, e.g. "III". */
  plate: string;
  eyebrow: string;
  title: string;
  subtitle: React.ReactNode;
  /** Small element beside the title (e.g. a primary action). */
  aside?: React.ReactNode;
  /** Rendered under the subtitle, e.g. a <HudStrip>. */
  children?: React.ReactNode;
}) {
  return (
    <header className="animate-rise">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="hud-label flex items-center gap-2">
            <span className="text-gold/90">Plate {plate}</span>
            <StarGlyph className="h-2 w-2 text-ink-400" />
            <span>{eyebrow}</span>
          </p>
          <h1 className="mt-3 font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-parchment [font-variation-settings:'SOFT'_60,'opsz'_144] sm:text-[52px]">
            {title}
          </h1>
          <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-parchment-dim">{subtitle}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children && <div className="mt-8">{children}</div>}
      <Graticule className="mt-8" />
    </header>
  );
}

/** A row of HUD readouts separated by hairlines; wraps cleanly on small screens. */
export function HudStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "grid gap-px overflow-hidden rounded-[var(--radius)] border border-ink-600/70 bg-ink-600/70 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  count,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  count?: React.ReactNode;
  /** Right-aligned extras. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="hud-label mb-1.5">{eyebrow}</p>}
        <h2 id={id} className="flex items-baseline gap-2.5 font-display text-[24px] font-normal leading-tight tracking-[-0.01em] text-parchment">
          {title}
          {count !== undefined && <span className="font-mono text-[12px] font-normal tracking-normal text-mist">{count}</span>}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** Link to a skill on the tree, with its branch colour as a small star. */
export function SkillLink({
  skillId,
  title,
  color,
  className,
}: {
  skillId: string;
  title: string;
  color: string;
  className?: string;
}) {
  return (
    <Link
      href={`/?skill=${encodeURIComponent(skillId)}`}
      className={clsx(
        "group/skill inline-flex max-w-full items-center gap-1.5 rounded-md border border-ink-500/70 bg-ink-800/50 px-1.5 py-[1px] text-[12.5px] text-parchment-dim transition-colors hover:border-[color:var(--skill)] hover:text-parchment",
        className,
      )}
      style={{ "--skill": `color-mix(in oklab, ${color} 70%, transparent)` } as React.CSSProperties}
    >
      <StarGlyph className="h-2.5 w-2.5 transition-transform group-hover/skill:rotate-45" style={{ color }} />
      <span className="truncate">{title}</span>
    </Link>
  );
}

/** Label + big value readout; inside a HudStrip it gets the strip's cell styling. */
export function HudStat({
  label,
  value,
  sub,
  children,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("min-w-0 bg-ink-900/90 px-4 py-3.5 sm:px-5 sm:py-4", className)}>
      <div className="hud-label">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5 font-mono text-[24px] leading-none tracking-[-0.02em] text-parchment">{value}</div>
      {sub && <div className="mt-2 text-[12px] leading-snug text-mist">{sub}</div>}
      {children}
    </div>
  );
}
