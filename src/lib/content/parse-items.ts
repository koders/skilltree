// Item lists (spec §2.4): used by skill ranks and quest maintenance sections.
//
//   - [ ] [type] [flag]… Title — ~time {#item-id}
//     - Label: text
//       continuation

import { inferCadenceFromTitle, parseCadence } from "@/lib/content/cadence";
import { parseDuration } from "@/lib/content/durations";
import { type SourceLine, bulletOf, dedent, indentOf, isBlank, splitList, stripTrailingId } from "@/lib/content/markdown";
import { type DiagnosticRef, type ParseContext, parseError } from "@/lib/content/parse-context";
import { extractResources } from "@/lib/content/resources";
import { isIsoDate } from "@/lib/engine/dates";
import { type Cadence, type Item, type ItemField, type ItemType, isItemType } from "@/lib/content/types";

export const ITEM_FLAGS = ["time-sensitive", "optional"] as const;
export type ItemFlag = (typeof ITEM_FLAGS)[number];

function isFlag(value: string): value is ItemFlag {
  return (ITEM_FLAGS as readonly string[]).includes(value);
}

export interface ItemHeader {
  checked: boolean;
  type: ItemType | null;
  rawType: string | null;
  timeSensitive: boolean;
  /** Set by the `[optional]` flag only (the "Optional …" title rule is applied later). */
  optionalFlag: boolean;
  title: string;
  timeText: string | null;
  minutes: number | null;
  id: string;
  problems: string[];
}

/** Where the time starts: after the last ` — ` (or ` – `, ` - `) followed by `~` or a duration. */
function splitTime(text: string): { title: string; timeText: string | null } {
  const re = /\s[—–-]\s+(?=[~\d])/g;
  let cut: { index: number; after: number } | null = null;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const after = text.slice(m.index + m[0].length);
    if (after.startsWith("~") || parseDuration(after) !== null) cut = { index: m.index, after: m.index + m[0].length };
  }
  if (!cut) return { title: text.trim(), timeText: null };
  return { title: text.slice(0, cut.index).trim(), timeText: text.slice(cut.after).trim() };
}

export function parseItemHeader(bulletText: string): ItemHeader {
  const problems: string[] = [];
  let rest = bulletText.trim();
  let checked = false;
  const box = /^\[([ xX]?)\](?!\()(?:\s+|$)/.exec(rest);
  if (box) {
    checked = box[1].toLowerCase() === "x";
    rest = rest.slice(box[0].length);
  }

  const tokens: string[] = [];
  for (let m = /^\[([A-Za-z][A-Za-z-]*)\](?!\()\s*/.exec(rest); m; m = /^\[([A-Za-z][A-Za-z-]*)\](?!\()\s*/.exec(rest)) {
    tokens.push(m[1]);
    rest = rest.slice(m[0].length);
  }

  let type: ItemType | null = null;
  let rawType: string | null = null;
  let timeSensitive = false;
  let optionalFlag = false;
  for (const [i, token] of tokens.entries()) {
    const lower = token.toLowerCase();
    if (type === null && rawType === null && isItemType(lower)) {
      type = lower;
      rawType = token;
    } else if (isFlag(lower)) {
      if (lower === "time-sensitive") timeSensitive = true;
      else optionalFlag = true;
    } else if (i === 0) {
      rawType = token;
      problems.push(`Unknown item type "[${token}]"; expected one of watch, read, do, build, output, habit.`);
    } else {
      problems.push(`Unknown item flag "[${token}]"; expected [time-sensitive] or [optional].`);
    }
  }
  if (rawType === null) problems.push("Item has no type; expected [watch], [read], [do], [build], [output] or [habit].");

  const trailing = stripTrailingId(rest);
  const split = splitTime(trailing.text);
  let { title } = split;
  let id = trailing.id;
  // `Title {#id} — ~1 h`: without this the id would silently become part of the title.
  if (id === null && split.timeText !== null) {
    const beforeTime = stripTrailingId(title);
    if (beforeTime.id !== null) {
      title = beforeTime.text.trim();
      id = beforeTime.id;
    }
  }
  const { timeText } = split;
  const minutes = timeText === null ? null : (parseDuration(timeText)?.minutes ?? null);
  if (timeText !== null && minutes === null) problems.push(`Unparseable time "${timeText}".`);

  return { checked, type, rawType, timeSensitive, optionalFlag, title, timeText, minutes, id: id ?? "", problems };
}

// Labels the spec defines; these count whatever their case ("done when:").
const KNOWN_LABELS = ["resource", "do", "skip", "done when", "if stuck", "fast track", "note", "verify", "as of", "cadence"];

/** `Label: text`: a label is the capitalised words before the first colon, at most 30 characters. */
export function splitLabel(text: string): { label: string; text: string } {
  const m = /^([A-Za-z][A-Za-z0-9 '’()/&-]{0,29}):(?:\s+([\s\S]*)|\s*)$/.exec(text);
  if (!m || m[1].trim() !== m[1]) return { label: "", text };
  const capitalised = /^[A-Z]/.test(m[1]);
  if (!capitalised && !KNOWN_LABELS.includes(normalizeLabel(m[1]))) return { label: "", text };
  return { label: m[1], text: (m[2] ?? "").trim() };
}

type ConvenienceKey = "do" | "skip" | "doneWhen" | "ifStuck" | "fastTrack" | "verify" | "asOf";

const CONVENIENCE_LABELS: Record<string, ConvenienceKey | undefined> = {
  do: "do",
  skip: "skip",
  "done when": "doneWhen",
  "if stuck": "ifStuck",
  "fast track": "fastTrack",
  verify: "verify",
  "as of": "asOf",
};

function normalizeLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface ItemContext {
  ownerId: string;
  /** Section default for habits (quest maintenance); null inside skills. */
  defaultCadence: Cadence | null;
  ref: DiagnosticRef;
}

interface DraftItem {
  header: ItemHeader;
  line: number;
  fields: ItemField[];
  subIndent: number | null;
}

function buildItem(draft: DraftItem, ictx: ItemContext, ctx: ParseContext): Item {
  const { header, fields } = draft;
  const ref: DiagnosticRef = { ...ictx.ref, itemId: header.id || undefined };
  for (const problem of header.problems) parseError(ctx, draft.line, problem, ref);

  const convenience: Record<ConvenienceKey, string | null> = {
    do: null,
    skip: null,
    doneWhen: null,
    ifStuck: null,
    fastTrack: null,
    verify: null,
    asOf: null,
  };
  let cadenceField: ItemField | null = null;
  for (const f of fields) {
    const label = normalizeLabel(f.label);
    const key = CONVENIENCE_LABELS[label];
    if (key && convenience[key] === null) convenience[key] = f.text;
    if (label === "cadence" && cadenceField === null) cadenceField = f;
    if (label === "as of" && !isIsoDate(f.text.trim())) {
      parseError(ctx, f.line, `Invalid date "${f.text}" in As of; expected YYYY-MM-DD.`, ref);
    }
  }

  let cadence: Cadence | null = null;
  if (header.type === "habit") {
    const explicit = cadenceField === null ? null : parseCadence(cadenceField.text);
    if (cadenceField !== null && explicit === null) {
      // Falling back quietly would turn e.g. "fortnightly" into the section's "weekly".
      parseError(
        ctx,
        cadenceField.line,
        `Unparseable cadence "${cadenceField.text}"; expected weekly, monthly, yearly, "2× week", "twice a month"…`,
        ref,
      );
    }
    const fallback = ictx.defaultCadence ? { ...ictx.defaultCadence } : null;
    cadence = explicit ?? inferCadenceFromTitle(header.title) ?? fallback;
  }

  return {
    id: header.id,
    key: `${ictx.ownerId}/${header.id}`,
    ownerId: ictx.ownerId,
    type: header.type,
    rawType: header.rawType,
    title: header.title,
    minutes: header.minutes,
    timeText: header.timeText,
    timeSensitive: header.timeSensitive,
    optional: header.optionalFlag || /^optional\b/i.test(header.title),
    checked: header.checked,
    fields,
    resources: [
      ...extractResources(header.title, "title"),
      ...fields.flatMap((f) => extractResources(f.text, f.label)),
    ],
    do: convenience.do,
    skip: convenience.skip,
    doneWhen: convenience.doneWhen,
    ifStuck: convenience.ifStuck,
    fastTrack: convenience.fastTrack,
    verify: convenience.verify,
    asOf: convenience.asOf === null ? null : convenience.asOf.trim(),
    cadence,
    line: draft.line,
  };
}

export interface ItemListOptions extends ItemContext {
  /** Ranks: a `- requires: …` bullet may open the list. */
  allowRequires: boolean;
  /** Maintenance: free paragraphs are kept as the section description. */
  allowParagraphs: boolean;
}

export interface ItemListResult {
  items: Item[];
  requires: string[];
  paragraphs: string[];
}

const META_BULLET_RE = /^([a-z][a-z0-9_-]*)\s*:(?:\s+(.*))?$/i;

export function parseItemList(lines: SourceLine[], opts: ItemListOptions, ctx: ParseContext): ItemListResult {
  const items: Item[] = [];
  const paragraphs: string[] = [];
  let requires: string[] = [];
  let draft: DraftItem | null = null;
  let paragraph: string[] = [];

  const finishItem = () => {
    if (draft) items.push(buildItem(draft, opts, ctx));
    draft = null;
  };
  const finishParagraph = () => {
    if (paragraph.length) paragraphs.push(paragraph.join("\n"));
    paragraph = [];
  };

  let blanks = 0;
  for (const l of lines) {
    if (isBlank(l)) {
      if (!l.fenced) finishParagraph();
      blanks += 1;
      continue;
    }
    const blanksBefore = blanks;
    blanks = 0;
    const indent = indentOf(l.text);
    const bullet = bulletOf(l);

    if (indent === 0 && bullet) {
      finishParagraph();
      const meta = META_BULLET_RE.exec(bullet.text);
      const key = meta?.[1].toLowerCase();
      if (meta && items.length === 0 && draft === null) {
        if (opts.allowRequires && key === "requires") requires = splitList(meta[2] ?? "");
        else {
          const hint = opts.allowRequires ? '; only "- requires:" may open a rank' : "";
          parseError(ctx, l.line, `Unexpected metadata bullet "${meta[1]}:"${hint}.`, opts.ref);
        }
        continue;
      }
      if (meta && opts.allowRequires && key === "requires") {
        parseError(ctx, l.line, `"- requires:" must come before the rank's first item.`, opts.ref);
        continue;
      }
      finishItem();
      draft = { header: parseItemHeader(bullet.text), line: l.line, fields: [], subIndent: null };
      continue;
    }

    if (indent === 0 || draft === null) {
      finishItem();
      if (opts.allowParagraphs && indent === 0) {
        paragraph.push(l.text);
      } else {
        parseError(ctx, l.line, `Expected an item bullet ("- [ ] [type] Title — ~time"), found "${l.text.trim()}".`, opts.ref);
      }
      continue;
    }

    const current: DraftItem = draft;
    if (bullet && (current.subIndent === null || indent <= current.subIndent)) {
      current.subIndent ??= indent;
      current.fields.push({ ...splitLabel(bullet.text), line: l.line });
    } else if (current.fields.length) {
      const last = current.fields[current.fields.length - 1];
      const text = dedent(l.text, (current.subIndent ?? 0) + 2);
      // Blank lines between continuation lines separate paragraphs; keep them.
      last.text = last.text === "" ? text : `${last.text}\n${"\n".repeat(blanksBefore)}${text}`;
    } else {
      parseError(ctx, l.line, `Expected a "- Label: text" sub-bullet under the item, found "${l.text.trim()}".`, {
        ...opts.ref,
        itemId: current.header.id || undefined,
      });
    }
  }
  finishItem();
  finishParagraph();
  return { items, requires, paragraphs };
}
