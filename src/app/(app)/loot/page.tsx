import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { fmtShort } from "@/components/journal/format";
import { HudStat, HudStrip, PageFrame, PageHeader, SectionHeading, SkillLink, StarGlyph } from "@/components/journal/PageFrame";
import { ExtraLootCard, LootCard, Relic } from "@/components/loot/LootCard";
import { buildLoot, type LootModel } from "@/components/loot/model";
import { Markdown } from "@/components/ui/Markdown";
import { formatMinutesShort, ITEM_TYPE_META } from "@/components/ui/meta";
import { ProgressBar } from "@/components/ui/Progress";
import { getAppData } from "@/lib/data";

export const metadata: Metadata = { title: "Loot" };

export default async function LootPage() {
  const { index, state, snapshot, quests, activeQuest, today } = await getAppData();
  const loot = buildLoot(index, state, snapshot.notes, quests, activeQuest);
  const empty = loot.collected === 0 && loot.extras === 0;

  return (
    <PageFrame>
      <PageHeader
        plate="IV"
        eyebrow="Trophy case"
        title="Loot"
        subtitle="Everything I've written or built along the way. Silhouettes mark the loot still out there."
      >
        <HudStrip className="grid-cols-2 md:grid-cols-[1.4fr_1fr_1.4fr]">
          <HudStat
            label="Loot collected"
            className="col-span-2 md:col-span-1"
            value={
              <>
                <span className={clsx(loot.collected > 0 && "text-gold-bright")}>{loot.collected}</span>
                <span className="text-[13px] text-mist">/ {loot.total}</span>
              </>
            }
          >
            <Segments total={loot.total} filled={loot.collected} />
          </HudStat>
          <HudStat
            label="Extra outputs"
            value={<span className={loot.extras > 0 ? "" : "text-mist-dim"}>{loot.extras}</span>}
            sub="Write-ups beyond the tree"
          />
          <HudStat
            label="Latest find"
            value={
              loot.latest ? (
                <span className="truncate font-display text-[17px] tracking-normal">{loot.latest.title}</span>
              ) : (
                <span className="text-mist-dim">—</span>
              )
            }
            sub={loot.latest ? fmtShort(loot.latest.on, today) : "Nothing collected yet"}
          />
        </HudStrip>
      </PageHeader>

      {empty && <FirstLoot loot={loot} />}

      <div className="mt-12 space-y-14">
        {loot.branches.map((branch) => (
          <section key={branch.id} aria-labelledby={`loot-${branch.id}`}>
            <SectionHeading
              id={`loot-${branch.id}`}
              title={
                <span className="flex items-center gap-2.5">
                  <StarGlyph className="h-3.5 w-3.5" style={{ color: branch.color, filter: `drop-shadow(0 0 6px ${branch.color})` }} />
                  {branch.title}
                </span>
              }
              count={`${branch.collected} / ${branch.slots.length}`}
            >
              <ProgressBar
                className="w-40"
                value={branch.slots.length > 0 ? branch.collected / branch.slots.length : 0}
                color={branch.color}
                label={`${branch.title} loot collected`}
              />
            </SectionHeading>
            <ul className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {branch.slots.map((slot, i) => (
                <li key={slot.key} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <LootCard slot={slot} color={branch.color} today={today} />
                </li>
              ))}
              {branch.extras.map((extra) => (
                <li key={extra.id} className="animate-rise">
                  <ExtraLootCard extra={extra} color={branch.color} today={today} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {loot.questExtras.length > 0 && (
          <section aria-labelledby="loot-quest">
            <SectionHeading id="loot-quest" title="Quest outputs" count={loot.questExtras.length} />
            <ul className="mt-5 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {loot.questExtras.map((extra) => (
                <li key={extra.id}>
                  <ExtraLootCard extra={extra} color="var(--gold)" today={today} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageFrame>
  );
}

/** One diamond per loot slot; falls back to a bar when there are too many to read. */
function Segments({ total, filled }: { total: number; filled: number }) {
  if (total > 36) {
    return <ProgressBar className="mt-3" value={total > 0 ? filled / total : 0} label="Loot collected" />;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-[5px]" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clsx(
            "h-2 w-2 rotate-45 rounded-[1.5px] border",
            i < filled ? "border-gold bg-gold shadow-[0_0_6px_var(--gold)]" : "border-ink-400",
          )}
        />
      ))}
    </div>
  );
}

function FirstLoot({ loot }: { loot: LootModel }) {
  const target = loot.nextTarget;
  if (!target) return null;
  const { entry } = target;
  const type = entry.type === "build" ? "build" : "output";
  const color = skillColor(loot, entry.skillId);
  return (
    <section
      className="relative mt-10 overflow-hidden rounded-[var(--radius)] border border-gold/35 bg-[radial-gradient(600px_220px_at_12%_0%,rgba(233,196,106,0.12),transparent_70%)] p-5 sm:p-7"
      aria-labelledby="first-loot"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Relic type={type} collected large className="animate-glow-pulse" />
        <div className="min-w-0 flex-1">
          <p className="hud-label !text-gold/90">Your first loot drop</p>
          <h2 id="first-loot" className="mt-2 font-display text-[22px] font-normal leading-snug text-parchment">
            <Markdown inline className="!leading-snug !text-parchment">
              {entry.title}
            </Markdown>
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-mist">
            <SkillLink skillId={entry.skillId} title={target.skillTitle} color={color} />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: ITEM_TYPE_META[type].color }}>
              {ITEM_TYPE_META[type].label} · ~{formatMinutesShort(entry.minutes)}
            </span>
            <span>
              Week {entry.week} of{" "}
              <Link href="/quest" className="text-parchment-dim underline decoration-ink-400 underline-offset-2 hover:decoration-gold">
                {target.questTitle}
              </Link>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function skillColor(loot: LootModel, skillId: string): string {
  return loot.branches.find((b) => b.slots.some((s) => s.skillId === skillId))?.color ?? "var(--gold)";
}
