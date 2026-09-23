"use client";

import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteTimeLog } from "@/app/actions";
import { useAction } from "@/components/ui/useAction";

/** Two-step delete for a time log: first click arms, second click deletes. */
export function DeleteLogButton({ id, label }: { id: string; label: string }) {
  const { run, pending } = useAction();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="grid h-7 w-7 place-items-center rounded-md text-mist-dim opacity-60 transition-[color,background,opacity] hover:bg-ink-700 hover:text-danger hover:opacity-100 focus-visible:opacity-100 group-hover/entry:opacity-100"
        aria-label={`Delete time log: ${label}`}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setArmed(false)}>
      <button
        type="button"
        autoFocus
        disabled={pending}
        onClick={() => void run(() => deleteTimeLog({ id }), { success: "Time log deleted", tone: "info" })}
        className={clsx(
          "h-7 rounded-md border border-danger/45 px-2 font-mono text-[11px] text-danger transition-colors hover:bg-danger/10",
          pending && "animate-pulse",
        )}
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="h-7 rounded-md px-1.5 font-mono text-[11px] text-mist hover:text-parchment"
      >
        Keep
      </button>
    </span>
  );
}
