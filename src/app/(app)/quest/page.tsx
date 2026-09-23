import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { buildQuestContext } from "@/components/quest/context";
import { QuestActive } from "@/components/quest/QuestActive";
import { QuestNotStarted } from "@/components/quest/QuestNotStarted";
import { getAppData, type AppData } from "@/lib/data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * `?id=` picks a quest; otherwise the active one, then one with a paused or
 * completed run, then the first in content order.
 */
function pickQuestId(app: AppData, requested: string | undefined): string | null {
  if (requested) return Object.hasOwn(app.index.quests, requested) ? requested : null;
  return (
    app.activeQuest?.questId ??
    app.quests.find((q) => q.status !== "not-started")?.questId ??
    app.quests[0]?.questId ??
    null
  );
}

function idParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const [params, app] = await Promise.all([searchParams, getAppData()]);
  const id = pickQuestId(app, idParam(params.id));
  return { title: id ? (app.index.quests[id]?.title ?? "Quest") : "Quest" };
}

export default async function QuestPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, app] = await Promise.all([searchParams, getAppData()]);
  const requested = idParam(params.id);
  const questId = pickQuestId(app, requested);
  if (requested && !questId) notFound();

  const ctx = questId ? buildQuestContext(app, questId) : null;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
      {app.quests.length > 1 ? <QuestTabs app={app} currentId={questId} /> : null}
      {ctx ? (
        ctx.view.status === "not-started" ? (
          <QuestNotStarted ctx={ctx} />
        ) : (
          <QuestActive ctx={ctx} />
        )
      ) : (
        <div className="panel mx-auto mt-10 max-w-lg px-6 py-10 text-center">
          <h1 className="font-display text-[26px] font-medium">No quests yet</h1>
          <p className="mt-2 text-[14px] text-mist">
            Quests live in <code className="font-mono text-parchment-dim">content/quests/</code>. Add one and it shows up here.
          </p>
        </div>
      )}
    </div>
  );
}

function QuestTabs({ app, currentId }: { app: AppData; currentId: string | null }) {
  return (
    <nav aria-label="Quests" className="mb-5 flex gap-1 overflow-x-auto">
      {app.quests.map((q) => {
        const title = app.index.quests[q.questId]?.title ?? q.questId;
        const current = q.questId === currentId;
        return (
          <Link
            key={q.questId}
            href={`/quest?id=${encodeURIComponent(q.questId)}`}
            aria-current={current ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] transition-colors",
              current
                ? "border-gold/50 bg-gold/[0.06] text-parchment"
                : "border-ink-600 text-mist hover:border-ink-400 hover:text-parchment",
            )}
          >
            {q.status === "active" ? <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_var(--gold)]" aria-hidden /> : null}
            {title}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-mist-dim">{q.status.replace("-", " ")}</span>
          </Link>
        );
      })}
    </nav>
  );
}
