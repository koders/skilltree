"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Error boundary for every page under the app shell. `retry` re-fetches the
 * segment's server components (Next 16.2+); `reset` only re-renders, so it's
 * the fallback.
 */
export default function AppError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const looksLikeData = /supabase|progress|fetch|jwt|relation|migrat|ECONN|network/i.test(error.message);

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-var(--topbar-h))] w-full max-w-[720px] flex-col justify-center px-4 py-16 sm:px-6">
      <BrokenConstellation />

      <p className="hud-label mt-8 !text-rust-bright">Signal lost</p>
      <h1 className="mt-3 font-display text-[36px] font-light leading-[1.05] tracking-[-0.02em] text-parchment sm:text-[46px]">
        This part of the chart went dark
      </h1>
      <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-parchment-dim">
        Something failed while drawing the page. Your progress is safe: nothing is written unless an action succeeds.
      </p>

      <div className="mt-6 rounded-[var(--radius)] border border-rust/40 bg-rust/[0.06] p-4">
        <p className="hud-label !text-[9.5px]">Message</p>
        <p className="mt-1.5 break-words font-mono text-[12.5px] leading-relaxed text-parchment">
          {error.message || "Unknown error"}
        </p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-mist">digest {error.digest}</p>}
      </div>

      <div className="mt-5 rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-4 text-[13px] leading-relaxed text-parchment-dim">
        <p className="text-parchment">{looksLikeData ? "Looks like the progress database." : "If it's the progress database:"}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 marker:font-mono marker:text-[11px] marker:text-mist">
          <li>
            Check <code className="font-mono text-[12px] text-gold-bright">.env.local</code> has{" "}
            <code className="font-mono text-[12px] text-parchment">SUPABASE_PROJECT_URL</code> and{" "}
            <code className="font-mono text-[12px] text-parchment">SUPABASE_SECRET_KEY</code>.
          </li>
          <li>
            Run <code className="font-mono text-[12px] text-gold-bright">pnpm db:migrate</code> so every table exists.
          </li>
          <li>Restart the dev server after changing env vars.</li>
        </ol>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button variant="gold" onClick={() => (retry ?? reset)()}>
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Link href="/" className="rounded-lg px-3 py-2 text-[13.5px] text-mist transition-colors hover:bg-ink-700/70 hover:text-parchment">
          Back to the tree
        </Link>
      </div>
    </div>
  );
}

function BrokenConstellation() {
  return (
    <svg viewBox="0 0 220 90" className="h-[90px] w-[220px]" aria-hidden>
      <g stroke="var(--ink-400)" strokeWidth="1.2" strokeLinecap="round">
        <line x1="14" y1="62" x2="60" y2="30" />
        <line x1="60" y1="30" x2="108" y2="48" />
        <line x1="108" y1="48" x2="136" y2="42" strokeDasharray="2 5" stroke="var(--rust)" />
        <line x1="160" y1="38" x2="206" y2="16" strokeDasharray="2 5" />
      </g>
      <circle cx="14" cy="62" r="3" fill="var(--branch-1)" />
      <circle cx="60" cy="30" r="4.5" fill="var(--gold-bright)" className="animate-twinkle" />
      <circle cx="108" cy="48" r="3.5" fill="var(--branch-3)" />
      <circle cx="160" cy="38" r="6" fill="none" stroke="var(--rust-bright)" strokeWidth="1.5" className="animate-glow-pulse" />
      <circle cx="160" cy="38" r="2" fill="var(--rust-bright)" />
      <circle cx="206" cy="16" r="2.5" fill="var(--ink-400)" />
    </svg>
  );
}
