"use client";

import clsx from "clsx";
import { Flame } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";

export interface TopBarStats {
  level: number;
  totalXp: number;
  nextLevelAt: number;
  progressToNext: number;
  weeklyStreak: number;
  thisWeekMinutes: number;
  /** Weekly target from the active quest, if any. */
  weekTargetMinutes: { min: number; max: number } | null;
}

const NAV = [
  { href: "/", label: "Tree" },
  { href: "/quest", label: "Quest" },
  { href: "/habits", label: "Habits" },
  { href: "/loot", label: "Loot" },
  { href: "/journal", label: "Journal" },
  { href: "/data", label: "Data" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function hours(minutes: number): string {
  const h = minutes / 60;
  return h >= 10 || Number.isInteger(h) ? `${Math.round(h)}` : h.toFixed(1);
}

export function TopBar({ stats }: { stats: TopBarStats }) {
  const pathname = usePathname();
  const ring = 2 * Math.PI * 15;
  const target = stats.weekTargetMinutes;

  return (
    <header className="sticky top-0 z-40 h-[var(--topbar-h)] border-b border-ink-600/60 bg-ink-900/80 backdrop-blur-md">
      <div className="mx-auto flex h-full items-center gap-6 px-4 sm:px-5">
        <Wordmark />

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors",
                  active ? "text-parchment" : "text-mist hover:text-parchment",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-gold shadow-[0_0_12px_var(--gold)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <div
            className="hidden items-center gap-1.5 font-mono text-[12px] text-mist md:flex"
            title={target ? `This week: ${hours(stats.thisWeekMinutes)} h of ${hours(target.min)}–${hours(target.max)} h` : "Logged this week"}
          >
            <span className="text-parchment">{hours(stats.thisWeekMinutes)}</span>
            <span>{target ? `/ ${hours(target.min)}–${hours(target.max)} h` : "h this week"}</span>
          </div>

          <div
            className={clsx(
              "flex items-center gap-1 font-mono text-[12px]",
              stats.weeklyStreak > 0 ? "text-gold" : "text-mist-dim",
            )}
            title={`Weekly streak: ${stats.weeklyStreak} week${stats.weeklyStreak === 1 ? "" : "s"} with 2 h+ logged`}
          >
            <Flame className="h-4 w-4" strokeWidth={1.8} />
            <span>{stats.weeklyStreak}w</span>
          </div>

          <div
            className="flex items-center gap-2"
            title={`${stats.totalXp.toLocaleString("en")} XP · next level at ${stats.nextLevelAt.toLocaleString("en")}`}
          >
            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="var(--ink-800)" stroke="var(--ink-600)" strokeWidth="2.5" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="var(--gold)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${ring * stats.progressToNext} ${ring}`}
                className="drop-shadow-[0_0_4px_var(--gold)]"
              />
            </svg>
            <div className="-ml-[38px] flex w-9 justify-center font-display text-[14px] font-semibold text-gold-bright">
              {stats.level}
            </div>
            <div className="hidden leading-tight lg:block">
              <div className="hud-label !text-[9.5px]">Level</div>
              <div className="font-mono text-[11.5px] text-parchment-dim">
                {stats.totalXp.toLocaleString("en")} XP
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
