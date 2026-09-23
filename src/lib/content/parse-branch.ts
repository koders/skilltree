// Branch header (spec §7.1): `_branch.md` in the tree, `# Branch: Title` in a bundle.

import { slugify } from "@/lib/content/ids";
import { type Block, readMeta } from "@/lib/content/parse-block";
import { type ParseContext, parseError } from "@/lib/content/parse-context";
import { joinLines, paragraphsOf } from "@/lib/content/markdown";
import type { Branch } from "@/lib/content/types";

export const BRANCH_META_KEYS = ["id", "note", "color", "order"] as const;

export function stripPrefix(title: string, prefix: "Branch" | "Quest"): string {
  return title.replace(new RegExp(`^${prefix}:\\s*`, "i"), "").trim();
}

/** Builds a Branch from its block (sections, i.e. bundle skills, are handled by the caller). */
export function parseBranchHeader(block: Block, fallbackId: string | null, ctx: ParseContext): Branch {
  const title = stripPrefix(block.title, "Branch");
  const { known, extra } = readMeta(block.meta, BRANCH_META_KEYS, ctx);

  let id = known.id?.value.trim() ?? "";
  if (id === "") {
    id = fallbackId ?? slugify(title);
    parseError(ctx, block.line, `Branch "${title}" has no "- id:" line (using "${id}").`);
  }

  let order: number | null = null;
  if (known.order) {
    const value = known.order.value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(value)) order = Number(value);
    else {
      parseError(ctx, known.order.line, `Branch order "${value}" is not a number.`);
      extra[known.order.key] = value;
    }
  }

  const paragraphs = paragraphsOf(block.preamble).map(joinLines);

  return {
    id,
    title,
    note: known.note ? known.note.value : null,
    description: paragraphs.length ? paragraphs.join("\n\n") : null,
    color: known.color ? known.color.value : null,
    order,
    skillIds: [],
    extraMeta: extra,
    file: ctx.file,
    line: block.line,
  };
}
