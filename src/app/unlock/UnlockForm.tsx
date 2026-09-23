"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { unlock, type UnlockState } from "./actions";

export function UnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlock, { error: null });
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="password" className="hud-label">
        Passphrase
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        className="h-11 rounded-lg border border-ink-500 bg-ink-800/80 px-3.5 font-mono text-[14px] text-parchment outline-none transition-colors placeholder:text-mist-dim focus:border-gold/70"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "unlock-error" : undefined}
      />
      {state.error && (
        <p id="unlock-error" role="alert" className="text-[13px] text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="gold" loading={pending} className="mt-2 h-11">
        <KeyRound className="h-4 w-4" strokeWidth={1.9} />
        Unlock the atlas
      </Button>
    </form>
  );
}
