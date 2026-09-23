// View model for /loot: every output/build item in content is a loot slot,
// collected once the item is done (or has an output note attached). Output
// notes that aren't attached to such an item are extra loot. Pure.

import type { ContentIndex, Skill } from "@/lib/content/types";
import type { PlanEntry, QuestView, TreeState } from "@/lib/engine/types";
import type { ItemStatus, NoteRow } from "@/lib/progress/types";
import { branchColor } from "@/components/ui/meta";
import { dayOf, plainText } from "@/components/journal/format";

export type LootType = "output" | "build";

export interface LootNote {
  id: string;
  title: string | null;
  body: string;
  url: string | null;
  createdOn: string;
}

export interface LootSlot {
  key: string;
  skillId: string;
  skillTitle: string;
  itemId: string;
  type: LootType;
  /** Inline markdown. */
  title: string;
  titlePlain: string;
  minutes: number | null;
  status: ItemStatus;
  collected: boolean;
  /** Local date it was completed, or the first output note's date. */
  collectedOn: string | null;
  notes: LootNote[];
}

export interface LootExtra extends LootNote {
  skillId: string | null;
  skillTitle: string | null;
}

export interface LootBranch {
  id: string;
  title: string;
  color: string;
  slots: LootSlot[];
  extras: LootExtra[];
  collected: number;
}

export interface LootModel {
  branches: LootBranch[];
  /** Output notes attached only to a quest. */
  questExtras: LootExtra[];
  collected: number;
  total: number;
  extras: number;
  /** Newest collected slot or extra, for the header. */
  latest: { title: string; on: string } | null;
  /** First output/build step on the quest that's still todo (empty-state pointer). */
  nextTarget: { entry: PlanEntry; questTitle: string; skillTitle: string } | null;
}

function isLootType(type: string | null): type is LootType {
  return type === "output" || type === "build";
}

function toNote(n: NoteRow): LootNote {
  return { id: n.id, title: n.title, body: n.body, url: n.url, createdOn: dayOf(n.createdAt) };
}

function slotsOf(skill: Skill, state: TreeState, notes: NoteRow[]): LootSlot[] {
  return skill.ranks.flatMap((rank) =>
    rank.items.flatMap((item): LootSlot[] => {
      if (!isLootType(item.type)) return [];
      const view = state.items[item.key];
      const attached = notes
        .filter((n) => n.skillId === skill.id && n.itemId === item.id)
        .map(toNote)
        .sort((a, b) => (a.createdOn < b.createdOn ? 1 : -1));
      const status = view?.status ?? "todo";
      const doneOn = status === "done" && view?.completedAt ? dayOf(view.completedAt) : null;
      const collected = status === "done" || attached.length > 0;
      return [
        {
          key: item.key,
          skillId: skill.id,
          skillTitle: skill.title,
          itemId: item.id,
          type: item.type,
          title: item.title,
          titlePlain: plainText(item.title),
          minutes: item.minutes,
          status,
          collected,
          collectedOn: doneOn ?? attached.at(-1)?.createdOn ?? null,
          notes: attached,
        },
      ];
    }),
  );
}

export function buildLoot(
  index: ContentIndex,
  state: TreeState,
  notes: NoteRow[],
  quests: QuestView[],
  activeQuest: QuestView | null,
): LootModel {
  const outputs = notes.filter((n) => n.kind === "output");
  const slotKeys = new Set<string>();

  const branches: LootBranch[] = index.tree.branches.map((branch, i) => {
    const skills = branch.skillIds.map((id) => index.skills[id]).filter((s): s is Skill => Boolean(s));
    const slots = skills.flatMap((s) => slotsOf(s, state, outputs));
    for (const s of slots) slotKeys.add(`${s.skillId}/${s.itemId}`);
    return {
      id: branch.id,
      title: branch.title,
      color: branchColor(branch, i),
      slots,
      extras: [],
      collected: slots.filter((s) => s.collected).length,
    };
  });

  const byBranch = new Map(branches.map((b) => [b.id, b]));
  const questExtras: LootExtra[] = [];
  for (const n of outputs) {
    if (n.skillId && n.itemId && slotKeys.has(`${n.skillId}/${n.itemId}`)) continue;
    const skill = n.skillId ? index.skills[n.skillId] : undefined;
    const extra: LootExtra = { ...toNote(n), skillId: n.skillId, skillTitle: skill?.title ?? n.skillId };
    const branch = skill ? byBranch.get(skill.branchId) : undefined;
    if (branch) branch.extras.push(extra);
    else questExtras.push(extra);
  }
  for (const b of branches) b.extras.sort((a, z) => (a.createdOn < z.createdOn ? 1 : -1));

  const allSlots = branches.flatMap((b) => b.slots);
  const allExtras = [...branches.flatMap((b) => b.extras), ...questExtras];
  const dated = [
    ...allSlots.filter((s) => s.collected && s.collectedOn).map((s) => ({ title: s.titlePlain, on: s.collectedOn! })),
    ...allExtras.map((e) => ({ title: e.title ?? plainText(e.body).slice(0, 60), on: e.createdOn })),
  ].sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));

  const quest = activeQuest ?? quests[0] ?? null;
  const entry = quest?.plan.find((e) => e.kind === "item" && isLootType(e.type) && e.status === "todo") ?? null;
  const nextTarget =
    quest && entry
      ? {
          entry,
          questTitle: index.quests[quest.questId]?.title ?? quest.questId,
          skillTitle: index.skills[entry.skillId]?.title ?? entry.skillId,
        }
      : null;

  return {
    branches: branches.filter((b) => b.slots.length > 0 || b.extras.length > 0),
    questExtras,
    collected: allSlots.filter((s) => s.collected).length,
    total: allSlots.length,
    extras: allExtras.length,
    latest: dated[0] ?? null,
    nextTarget,
  };
}
