import Link from "next/link";

/** Stars scattered around the empty region; fixed so the page renders the same every time. */
const STARS: [number, number, number][] = [
  [42, 60, 1.4],
  [88, 170, 1],
  [150, 40, 1.8],
  [230, 210, 1.1],
  [300, 90, 1.3],
  [372, 188, 0.9],
  [410, 52, 1.6],
  [470, 140, 1],
  [520, 230, 1.4],
  [36, 250, 1.1],
  [260, 20, 0.9],
  [498, 18, 1.2],
];

/** The 404 chart, headline and links. The root not-found page adds its own header; inside the app shell the top bar is already there. */
export function Uncharted() {
  return (
    <div className="w-full max-w-[560px] text-center">
      <svg viewBox="0 0 560 260" className="mx-auto h-auto w-full max-w-[520px]" aria-hidden>
        {STARS.map(([x, y, r], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={r}
            fill="var(--parchment)"
            opacity={0.55}
            className="animate-twinkle"
            style={{ animationDelay: `${(i % 5) * 0.7}s` }}
          />
        ))}
        {/* the blank region of the chart */}
        <circle cx="280" cy="130" r="92" fill="none" stroke="var(--ink-500)" strokeDasharray="3 7" />
        <circle cx="280" cy="130" r="58" fill="none" stroke="var(--ink-600)" strokeDasharray="2 6" />
        <line x1="160" y1="130" x2="400" y2="130" stroke="var(--ink-600)" strokeDasharray="2 6" />
        <line x1="280" y1="10" x2="280" y2="250" stroke="var(--ink-600)" strokeDasharray="2 6" />
        <g transform="translate(280 130)">
          <path d="M0 -14 L3 -3 L14 0 L3 3 L0 14 L-3 3 L-14 0 L-3 -3 Z" fill="var(--gold)" opacity="0.9" className="animate-glow-pulse" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
        </g>
        <text x="280" y="232" textAnchor="middle" fill="var(--mist-dim)" fontFamily="var(--font-mono)" fontSize="10" letterSpacing="2">
          RA 04h 04m · DEC −04° 04′
        </text>
      </svg>

      <p className="hud-label mt-6 !text-gold/90">404 · Here be dragons</p>
      <h1 className="mt-3 font-display text-[40px] font-light leading-[1.05] tracking-[-0.02em] text-parchment sm:text-[52px]">
        Uncharted territory
      </h1>
      <p className="mx-auto mt-3 max-w-[44ch] text-[15px] leading-relaxed text-parchment-dim">
        Nothing has been mapped at this address. The skill may have been renamed, or the link was never on the chart.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-[13.5px] font-medium text-ink-900 shadow-[0_0_24px_-6px_var(--gold)] transition-colors hover:from-white hover:to-gold-bright"
        >
          Return to the tree
        </Link>
        <Link href="/journal" className="rounded-lg px-3 py-2 text-[13.5px] text-mist transition-colors hover:bg-ink-700/70 hover:text-parchment">
          Open the journal
        </Link>
      </div>
    </div>
  );
}
