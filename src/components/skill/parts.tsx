"use client";

// Small building blocks shared by the skill panel's sections.

import clsx from "clsx";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";

/** A four-point star: the panel's section glyph. */
export function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 16 16" className={clsx("h-2.5 w-2.5 shrink-0", className)} style={style} aria-hidden>
      <path
        d="M8 0C8.5 5.1 10.9 7.5 16 8C10.9 8.5 8.5 10.9 8 16C7.5 10.9 5.1 8.5 0 8C5.1 7.5 7.5 5.1 8 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Section header: glyph, engraved label, a count and an optional action on the right. */
export function SectionHeading({
  title,
  meta,
  action,
  id,
}: {
  title: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3 flex min-h-7 items-center gap-2.5">
      <Sparkle className="text-gold-deep" />
      <h3 id={id} className="hud-label !text-parchment-dim">
        {title}
      </h3>
      {meta != null && <span className="font-mono text-[11px] text-mist-dim">{meta}</span>}
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-ink-500 to-transparent" />
      {action}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-ink-500 bg-ink-850/80 px-2.5 py-1.5 text-[13px] text-parchment placeholder:text-mist-dim transition-colors hover:border-ink-400 focus:border-gold/60 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/25";

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-mist">
      {children}
    </label>
  );
}

/** Stops Escape from reaching the page (which closes the panel) and runs `onEscape` instead. */
export function escapeHandler(onEscape: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    onEscape();
  };
}

/** A pill-style radio group. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-ink-500 bg-ink-850/80 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={clsx(
              "relative inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
              on ? "bg-ink-600 text-parchment shadow-[0_0_0_1px_var(--ink-400)]" : "text-mist hover:text-parchment",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/**
 * A destructive action behind a second click: the first click arms it and
 * shows "confirm / cancel" in place.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  prompt,
  onConfirm,
  pending,
  icon,
  className,
}: {
  label: string;
  confirmLabel: string;
  prompt?: React.ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        aria-label={icon ? label : undefined}
        title={icon ? label : undefined}
        className={clsx(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-mist transition-colors hover:bg-ink-700/70 hover:text-danger",
          className,
        )}
      >
        {icon ?? label}
      </button>
    );
  }
  return (
    <span
      className={clsx("inline-flex flex-wrap items-center gap-1.5", className)}
      onKeyDown={escapeHandler(() => setArmed(false))}
    >
      {prompt && <span className="text-[12px] text-parchment-dim">{prompt}</span>}
      <Button
        size="sm"
        variant="danger"
        loading={pending}
        autoFocus
        onClick={() => {
          onConfirm();
          setArmed(false);
        }}
      >
        {confirmLabel}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}

/** Tiny inline tag used in item meta lines. */
export function Tag({
  children,
  color,
  title,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        "inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10.5px] uppercase tracking-[0.08em]",
        className,
      )}
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}
