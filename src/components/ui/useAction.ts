"use client";

import { useCallback, useTransition } from "react";
import type { ActionResult } from "@/app/actions";
import { useToast } from "./Toast";

/**
 * Runs a server action inside a transition: shows errors as toasts and an
 * optional success toast. The action itself calls refresh(), so server
 * components re-render with fresh data afterwards.
 *
 *   const { run, pending } = useAction();
 *   run(() => setItemStatus({ ... }), { success: "Done" });
 */
export function useAction() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      opts?: { success?: React.ReactNode | ((data: T) => React.ReactNode); tone?: "success" | "xp" | "info" },
    ) =>
      new Promise<ActionResult<T>>((resolve) => {
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action();
          } catch (err) {
            result = { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
          if (!result.ok) toast(result.error, "error");
          else if (opts?.success) {
            const text = typeof opts.success === "function" ? (opts.success as (d: T) => React.ReactNode)(result.data) : opts.success;
            if (text) toast(text, opts.tone ?? "success");
          }
          resolve(result);
        });
      }),
    [toast],
  );

  return { run, pending };
}
