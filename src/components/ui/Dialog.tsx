"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Native <dialog> modal with the atlas look. Controlled by `open`.
 *
 * Children mount while the <dialog> is still closed, so React's `autoFocus`
 * misses on first open and showModal() then focuses the Close button. Mark
 * the field that should take focus with `data-autofocus` instead.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx(
        "panel m-auto max-h-[88vh] w-[min(92vw,560px)] overflow-hidden p-0 text-parchment backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm",
        wide && "w-[min(94vw,760px)]",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-ink-600/70 px-5 py-3.5">
            <h2 className="font-display text-[18px] font-medium">{title}</h2>
            <button onClick={onClose} className="rounded-md p-1 text-mist hover:bg-ink-700 hover:text-parchment" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
