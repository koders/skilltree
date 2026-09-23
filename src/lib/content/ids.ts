// Stable id generation for items and recall questions (spec §2.4, §2.6).
// Existing ids are never touched: progress is stored against them.

import type { ContentTree, Item, RecallQuestion } from "@/lib/content/types";
import { stripLinks } from "@/lib/content/resources";

export const ITEM_ID_MAX_WORDS = 6;
export const ITEM_ID_MAX_LENGTH = 40;

function words(text: string): string[] {
  return stripLinks(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // "Unchained's" → "unchaineds", not "unchained-s".
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Cuts a slug to `maxLength`, at a word (dash) boundary when there is one. */
function truncateSlug(slug: string, maxLength: number): string {
  if (slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1);
  const dash = cut.lastIndexOf("-");
  return (dash > 0 ? cut.slice(0, dash) : slug.slice(0, maxLength)).replace(/-+$/, "");
}

/** Kebab-case slug; markdown links keep only their text, `@type@` tags are dropped. */
export function slugify(text: string, maxLength?: number): string {
  const slug = words(text).join("-");
  return maxLength === undefined ? slug : truncateSlug(slug, maxLength);
}

/** Item id from its title: the first ~6 words, at most 40 characters. */
export function itemIdFromTitle(title: string): string {
  const slug = truncateSlug(words(title).slice(0, ITEM_ID_MAX_WORDS).join("-"), ITEM_ID_MAX_LENGTH);
  return slug === "" ? "item" : slug;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}

function fillItemIds(items: Item[]): void {
  const used = new Set(items.map((it) => it.id).filter(Boolean));
  for (const it of items) {
    if (it.id !== "") continue;
    it.id = uniqueId(itemIdFromTitle(it.title), used);
    it.key = `${it.ownerId}/${it.id}`;
  }
}

// A new question gets the next number after the highest one, so a deleted
// question's id is never reused for a different question.
function fillRecallIds(recall: RecallQuestion[]): void {
  const used = new Set(recall.map((q) => q.id).filter(Boolean));
  let next = 1 + Math.max(0, ...recall.map((q) => /^q(\d+)$/.exec(q.id)).map((m) => (m ? Number(m[1]) : 0)));
  for (const q of recall) {
    if (q.id !== "") continue;
    while (used.has(`q${next}`)) next += 1;
    q.id = `q${next}`;
    used.add(q.id);
    next += 1;
  }
}

/** Returns a copy of `tree` with every missing item and recall id filled in. */
export function assignMissingIds(tree: ContentTree): ContentTree {
  const out = structuredClone(tree);
  for (const skill of out.skills) {
    fillItemIds(skill.ranks.flatMap((r) => r.items));
    fillRecallIds(skill.recall);
  }
  for (const quest of out.quests) {
    if (quest.maintenance) fillItemIds(quest.maintenance.items);
  }
  return out;
}
