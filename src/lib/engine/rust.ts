// Rust: time-sensitive facts past the freshness window, and failed recall
// reviews (docs/decisions.md D6, guide §5 and §7). Pure: `today` is passed in.

import type { Item, Skill } from "@/lib/content/types";
import { FRESHNESS_DAYS } from "@/lib/config";
import { addDays, diffDays, isIsoDate, localDate } from "@/lib/engine/dates";
import type { RustInfo, StaleItem } from "@/lib/engine/types";
import type { RecallAttemptRow, VerificationRow } from "@/lib/progress/types";

/** Freshness of one item. All null/false for items that aren't time-sensitive. */
export interface ItemFreshness {
  /** Effective as-of date: the later of the content date and the last re-verification. */
  asOf: string | null;
  /** Local date of the latest re-verification. */
  lastVerifiedAt: string | null;
  staleOn: string | null;
  stale: boolean;
}

export interface SkillRust {
  rust: RustInfo;
  /** Keyed by item id (local to the skill). */
  items: Record<string, ItemFreshness>;
}

const NOT_TIME_SENSITIVE: ItemFreshness = { asOf: null, lastVerifiedAt: null, staleOn: null, stale: false };

export function computeRust(
  skill: Skill,
  verifications: VerificationRow[],
  recallAttempts: RecallAttemptRow[],
  learned: { learned: boolean; learnedAt: string | null },
  today: string,
  freshnessDays: number = FRESHNESS_DAYS,
): SkillRust {
  const skillItems = skill.ranks.flatMap((rank) => rank.items);
  const items = computeFreshness(skill.id, skillItems, skill.factsAsOf, verifications, today, freshnessDays);
  const stale: StaleItem[] = [];
  let nextStaleOn: string | null = null;

  for (const item of skillItems) {
    const fresh = items[item.id];
    if (fresh.asOf === null || fresh.staleOn === null) continue;
    if (fresh.stale) {
      stale.push({
        itemId: item.id,
        itemKey: item.key,
        asOf: fresh.asOf,
        staleSince: fresh.staleOn,
        daysStale: diffDays(fresh.staleOn, today),
      });
    } else if (nextStaleOn === null || fresh.staleOn < nextStaleOn) {
      nextStaleOn = fresh.staleOn;
    }
  }

  const failedReview = hasFailedReview(skill, recallAttempts, learned.learnedAt);
  return {
    rust: {
      stale,
      failedReview,
      isRusty: learned.learned && (stale.length > 0 || failedReview),
      nextStaleOn,
    },
    items,
  };
}

/**
 * Freshness of each item of one owner (a skill, or a quest's maintenance
 * section, whose verifications carry the quest id), keyed by item id.
 * `factsAsOf` is the owner's fallback date; quests have none.
 */
export function computeFreshness(
  ownerId: string,
  items: Item[],
  factsAsOf: string | null,
  verifications: VerificationRow[],
  today: string,
  freshnessDays: number = FRESHNESS_DAYS,
): Record<string, ItemFreshness> {
  const verifiedOn = latestVerificationDates(ownerId, verifications);
  const out: Record<string, ItemFreshness> = {};
  for (const item of items) {
    out[item.id] = itemFreshness(item, factsAsOf, verifiedOn.get(item.id) ?? null, today, freshnessDays);
  }
  return out;
}

function itemFreshness(
  item: Item,
  skillFactsAsOf: string | null,
  lastVerifiedAt: string | null,
  today: string,
  freshnessDays: number,
): ItemFreshness {
  if (!item.timeSensitive) return NOT_TIME_SENSITIVE;
  // A malformed date is a validator error; skip it (falling back to the skill's) rather than crash the page.
  const contentAsOf = [item.asOf, skillFactsAsOf].find((d) => d !== null && isIsoDate(d)) ?? null;
  const asOf = laterDate(contentAsOf, lastVerifiedAt);
  if (asOf === null) return { ...NOT_TIME_SENSITIVE, lastVerifiedAt };
  const staleOn = addDays(asOf, freshnessDays);
  return { asOf, lastVerifiedAt, staleOn, stale: today >= staleOn };
}

/** Latest re-verification per item id, as a local date. */
function latestVerificationDates(ownerId: string, verifications: VerificationRow[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const v of verifications) {
    if (v.skillId !== ownerId || v.itemId === "" || !isValidInstant(v.verifiedAt)) continue;
    const date = localDate(v.verifiedAt);
    const prev = latest.get(v.itemId);
    if (prev === undefined || date > prev) latest.set(v.itemId, date);
  }
  return latest;
}

/**
 * True when, for any of the skill's current Recall questions, the latest
 * review attempt (since learning, when that time is known) failed. Attempts
 * for questions no longer in content are ignored. At the same instant a fail
 * beats a pass: rows arrive in uuid order, so position can't break the tie.
 */
function hasFailedReview(skill: Skill, attempts: RecallAttemptRow[], learnedAt: string | null): boolean {
  const questionIds = new Set(skill.recall.map((q) => q.id).filter((id) => id !== ""));
  const since = learnedAt === null ? null : Date.parse(learnedAt);
  const latest = new Map<string, { at: number; failed: boolean }>();
  for (const a of attempts) {
    if (a.skillId !== skill.id || a.mode !== "review" || !questionIds.has(a.questionId)) continue;
    const at = Date.parse(a.createdAt);
    if (Number.isNaN(at)) continue;
    if (since !== null && !Number.isNaN(since) && at < since) continue;
    const prev = latest.get(a.questionId);
    const failed = a.result === "fail";
    if (prev === undefined || at > prev.at || (at === prev.at && failed)) latest.set(a.questionId, { at, failed });
  }
  for (const entry of latest.values()) if (entry.failed) return true;
  return false;
}

function laterDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

function isValidInstant(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
