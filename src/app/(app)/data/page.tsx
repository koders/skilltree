import { Download } from "lucide-react";
import type { Metadata } from "next";
import { Health } from "@/components/data/Health";
import { ImportPanel } from "@/components/data/ImportPanel";
import { Packs } from "@/components/data/Packs";
import { RustCalendar, type RustRow } from "@/components/data/RustCalendar";
import { TABLE_LABELS, TABLE_ORDER } from "@/components/data/tables";
import { dayOf, fmtHours, plainText } from "@/components/journal/format";
import { HudStat, HudStrip, PageFrame, PageHeader, SectionHeading } from "@/components/journal/PageFrame";
import { branchColor } from "@/components/ui/meta";
import { summarize, validate } from "@/lib/content/validate";
import { getAppData } from "@/lib/data";

export const metadata: Metadata = { title: "Data" };

const SAMPLE = `{
  "format": "skilltree-progress",
  "version": 1,
  "data": {
    "recallAttempts": [
      { "skillId": "crypto.consensus", "questionId": "q1",
        "mode": "review", "result": "pass", "source": "claude-review" }
    ]
  }
}`;

export default async function DataPage() {
  const { tree, index, snapshot, state, today } = await getAppData();
  const diagnostics = validate(tree, { today });
  const summary = summarize(diagnostics);
  const totalRows = TABLE_ORDER.reduce((s, t) => s + snapshot[t].length, 0);

  const colors = new Map(tree.branches.map((b, i) => [b.id, branchColor(b, i)]));
  const rust: RustRow[] = Object.values(state.items)
    .filter((v) => v.asOf !== null && v.staleOn !== null)
    .map((v) => {
      const skill = index.skills[v.ownerId];
      return {
        key: v.key,
        skillId: v.ownerId,
        skillTitle: skill?.title ?? v.ownerId,
        color: (skill && colors.get(skill.branchId)) ?? "var(--mist)",
        title: plainText(index.items[v.key]?.title ?? v.itemId),
        asOf: v.asOf!,
        staleOn: v.staleOn!,
        stale: v.stale,
        verified: v.lastVerifiedAt !== null && dayOf(v.lastVerifiedAt) >= v.asOf!,
      };
    })
    .sort((a, b) => (a.staleOn !== b.staleOn ? (a.staleOn < b.staleOn ? -1 : 1) : a.skillTitle.localeCompare(b.skillTitle)));

  const skillItems = tree.skills.flatMap((s) => s.ranks.flatMap((r) => r.items));
  const estimateHours = tree.skills.reduce((s, sk) => s + (sk.estimate?.hours ?? 0), 0);
  const itemMinutes = skillItems.filter((i) => !i.optional && i.type !== "habit").reduce((s, i) => s + (i.minutes ?? 0), 0);
  const recallCount = tree.skills.reduce((s, sk) => s + sk.recall.length, 0);

  return (
    <PageFrame>
      <PageHeader
        plate="VI"
        eyebrow="Archive & observatory"
        title="Data"
        subtitle="Carry my progress in and out, and keep an eye on the content: validator results, facts about to go stale, and the packs it came from."
      />

      {/* ------------------------------------------------------------ progress */}
      <section className="mt-12" aria-labelledby="data-progress">
        <SectionHeading id="data-progress" eyebrow="Supabase" title="Progress" count={`${totalRows} rows`} />
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-5 sm:p-6">
            <h3 className="font-display text-[19px] font-normal text-parchment">Export</h3>
            <p className="mt-1 text-[12.5px] text-mist">Every table as one versioned JSON file. Keep one before a replace.</p>
            <table className="mt-5 w-full text-[13px]">
              <caption className="sr-only">Rows per table</caption>
              <tbody>
                {TABLE_ORDER.map((t) => (
                  <tr key={t} className="border-b border-ink-600/50 last:border-0">
                    <th scope="row" className="py-2 text-left font-normal text-parchment-dim">
                      {TABLE_LABELS[t]}
                    </th>
                    <td className={`py-2 text-right font-mono text-[12.5px] ${snapshot[t].length > 0 ? "text-parchment" : "text-mist-dim"}`}>
                      {snapshot[t].length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <a
              href="/api/export"
              download
              className="mt-6 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-parchment px-3.5 text-[13.5px] font-medium text-ink-900 shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition-colors hover:bg-white"
            >
              <Download className="h-4 w-4" />
              Download export
            </a>
          </div>

          <div className="rounded-[var(--radius)] border border-ink-600/80 bg-ink-850/70 p-5 sm:p-6">
            <h3 className="font-display text-[19px] font-normal text-parchment">Import</h3>
            <p className="mb-5 mt-1 text-[12.5px] text-mist">
              Load an export, or a partial file from another tool. The future Claude Code review skill writes this same
              format.
            </p>
            <ImportPanel />
            <details className="group/fmt mt-5">
              <summary className="cursor-pointer list-none font-mono text-[11.5px] text-mist hover:text-parchment [&::-webkit-details-marker]:hidden">
                <span className="mr-1 inline-block transition-transform group-open/fmt:rotate-90">›</span> File format
              </summary>
              <div className="mt-3 space-y-2 text-[12.5px] text-mist">
                <p>
                  An envelope with <code className="font-mono text-parchment-dim">format</code>,{" "}
                  <code className="font-mono text-parchment-dim">version</code> and{" "}
                  <code className="font-mono text-parchment-dim">data</code>. In merge mode any table may be left out and
                  rows can skip fields with defaults (ids, timestamps). Include ids when a file may be imported twice.
                </p>
                <pre className="overflow-x-auto rounded-lg border border-ink-600 bg-ink-900/80 p-3 font-mono text-[11.5px] leading-relaxed text-parchment-dim">
                  {SAMPLE}
                </pre>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ content */}
      <section className="mt-16" aria-labelledby="data-content">
        <SectionHeading id="data-content" eyebrow="content/ in git" title="Content" />
        <HudStrip className="mt-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <HudStat label="Branches" value={tree.branches.length} />
          <HudStat label="Skills" value={tree.skills.length} />
          <HudStat label="Items" value={skillItems.length} sub={`${rust.length} time-sensitive`} />
          <HudStat label="Recall" value={recallCount} sub="questions" />
          <HudStat
            label="Estimated"
            value={
              <>
                {fmtHours(estimateHours * 60)}
                <span className="text-[13px] text-mist">h</span>
              </>
            }
            sub={`${fmtHours(itemMinutes)} h of required items`}
          />
          <HudStat label="Quests" value={tree.quests.length} sub={`${tree.packs.length} pack${tree.packs.length === 1 ? "" : "s"}`} />
        </HudStrip>
      </section>

      <section className="mt-12" aria-labelledby="data-health">
        <SectionHeading id="data-health" eyebrow="pnpm validate" title="Content health" className="mb-5" />
        <Health diagnostics={diagnostics} summary={summary} />
      </section>

      <section className="mt-12" aria-labelledby="data-rust">
        <SectionHeading id="data-rust" eyebrow="Time-sensitive facts" title="Rust calendar" className="mb-5" />
        <RustCalendar rows={rust} today={today} />
      </section>

      <section className="mt-12" aria-labelledby="data-packs">
        <SectionHeading id="data-packs" eyebrow="Provenance" title="Packs" count={tree.packs.length} className="mb-5" />
        <Packs packs={tree.packs} />
      </section>
    </PageFrame>
  );
}
