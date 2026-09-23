// pnpm content:import <bundle.skilltree.md> [--force] [--dry-run] [--out content]
//
// Splits a bundle into the tree shape (docs/format-spec.md §8): generates
// missing item/recall ids, stamps the bundle's facts_as_of on skills with
// time-sensitive items, keeps the bundle's branch order, copies pack sources
// into the skills that link the same URL, and writes one file per unit.

import fs from "node:fs";
import path from "node:path";
import { assignMissingIds } from "@/lib/content/ids";
import { diskPath } from "@/lib/content/load";
import { parseBundle } from "@/lib/content/parse-bundle";
import { extractPackSources } from "@/lib/content/parse-pack";
import { type ContentFile, type ContentFileKind, classifyPath } from "@/lib/content/parse-tree";
import { extractLinks, normalizeUrl } from "@/lib/content/resources";
import { treeToFiles } from "@/lib/content/serialize";
import type { ContentTree, Diagnostic, Item, Skill, Source } from "@/lib/content/types";

export interface ImportReport {
  branches: number;
  skills: number;
  quests: number;
  items: number;
  recall: number;
  generatedItemIds: number;
  generatedRecallIds: number;
  factsAsOf: string | null;
  /** Skills that got the bundle's facts_as_of stamped. */
  stampedFactsAsOf: string[];
  /** Keys of time-sensitive quest habits that got the bundle's facts_as_of as their `As of:`. */
  stampedItemAsOf: string[];
  /** Branches that got `order` from their position in the bundle. */
  stampedOrder: { branchId: string; order: number }[];
  attachedSources: { skillId: string; title: string; url: string }[];
  unattachedSources: Source[];
  errors: Diagnostic[];
}

export interface ImportPlan {
  tree: ContentTree;
  files: ContentFile[];
  report: ImportReport;
}

/** Every URL a skill links to, anywhere in its text. */
function skillUrls(skill: Skill): Set<string> {
  const texts = [
    skill.why ?? "",
    skill.description ?? "",
    skill.reviewLog ?? "",
    ...skill.sections.map((s) => s.body),
    ...skill.recall.map((q) => q.text),
    ...skill.ranks.flatMap((r) => r.items.flatMap((it) => [it.title, ...it.fields.map((f) => f.text)])),
  ];
  const urls = texts.flatMap((t) => extractLinks(t).map((l) => normalizeUrl(l.url)));
  return new Set(urls);
}

function countItems(tree: ContentTree): { items: number; recall: number; missingItems: number; missingRecall: number } {
  const items = [
    ...tree.skills.flatMap((s) => s.ranks.flatMap((r) => r.items)),
    ...tree.quests.flatMap((q) => q.maintenance?.items ?? []),
  ];
  const recall = tree.skills.flatMap((s) => s.recall);
  return {
    items: items.length,
    recall: recall.length,
    missingItems: items.filter((i) => i.id === "").length,
    missingRecall: recall.filter((q) => q.id === "").length,
  };
}

/**
 * Quests have no facts_as_of, so a time-sensitive habit in a bundle quest
 * would lose its inherited date on import; it gets an explicit `As of:`.
 */
function stampItemAsOf(items: Item[], factsAsOf: string): string[] {
  const stamped: string[] = [];
  for (const item of items) {
    if (!item.timeSensitive || item.asOf !== null) continue;
    item.fields.push({ label: "As of", text: factsAsOf, line: 0 });
    item.asOf = factsAsOf;
    stamped.push(item.key);
  }
  return stamped;
}

interface PlannedFile {
  file: ContentFile;
  kind: ContentFileKind["kind"];
  /** The unit it holds, for the error message. */
  what: string;
  source: { file: string; line?: number; skillId?: string; questId?: string };
}

function plannedFiles(tree: ContentTree, file: string): PlannedFile[] {
  // treeToFiles writes branches, skills, quests, then packs, one file each.
  const files = treeToFiles(tree, tree.packs);
  const units: Omit<PlannedFile, "file">[] = [
    ...tree.branches.map((b) => ({ kind: "branch" as const, what: `Branch "${b.id}"`, source: { file, line: b.line } })),
    ...tree.skills.map((s) => ({ kind: "skill" as const, what: `Skill "${s.id}"`, source: { file, line: s.line, skillId: s.id } })),
    ...tree.quests.map((q) => ({ kind: "quest" as const, what: `Quest "${q.id}"`, source: { file, line: q.line, questId: q.id } })),
    ...tree.packs.map((p) => ({ kind: "pack" as const, what: `Pack "${p.id}"`, source: { file } })),
  ];
  return files.map((f, i) => ({ file: f, ...units[i] }));
}

/**
 * Ids become file names. One that isn't a plain path segment could write
 * outside content/, overwrite another unit's file, or land where the loader
 * never looks (dot files, `_*.md`, nested folders), so the import refuses it.
 */
function unsafePaths(planned: PlannedFile[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const p of planned) {
    const segments = p.file.path.split("/");
    const badSegment = segments.some((seg) => seg === "" || seg.startsWith(".") || /[\\\0:]/.test(seg));
    const loadsAs = classifyPath(p.file.path)?.kind;
    const clash = seen.has(p.file.path);
    seen.add(p.file.path);
    if (!badSegment && loadsAs === p.kind && !clash) continue;
    const why = clash
      ? "another unit already uses that path (duplicate id?), so one would overwrite the other"
      : "the id isn't a plain file name; use a kebab-case id";
    out.push({ severity: "error", code: "path-mismatch", message: `${p.what} can't be written to ${p.file.path}: ${why}.`, ...p.source });
  }
  return out;
}

/** Pure part of the import: bundle text → tree-shape files and a report. */
export function planImport(text: string, file: string): ImportPlan {
  const parsed = parseBundle(text, file, { inheritFactsAsOf: false });
  const before = countItems(parsed);
  const tree = assignMissingIds(parsed);
  const pack = tree.packs[0];
  const factsAsOf = pack?.factsAsOf ?? null;

  const stampedFactsAsOf: string[] = [];
  for (const skill of tree.skills) {
    const timeSensitive = skill.ranks.some((r) => r.items.some((it) => it.timeSensitive));
    if (timeSensitive && skill.factsAsOf === null && factsAsOf !== null) {
      skill.factsAsOf = factsAsOf;
      stampedFactsAsOf.push(skill.id);
    }
  }

  const stampedItemAsOf =
    factsAsOf === null ? [] : tree.quests.flatMap((q) => stampItemAsOf(q.maintenance?.items ?? [], factsAsOf));

  // Files have no order, so the bundle's branch order is kept as `order`.
  const stampedOrder: { branchId: string; order: number }[] = [];
  tree.branches.forEach((branch, i) => {
    if (branch.order !== null) return;
    branch.order = i + 1;
    stampedOrder.push({ branchId: branch.id, order: i + 1 });
  });

  const packSources = pack ? extractPackSources(pack.body) : [];
  const attachedSources: ImportReport["attachedSources"] = [];
  const used = new Set<string>();
  for (const skill of tree.skills) {
    const urls = skillUrls(skill);
    const existing = new Set(skill.sources.map((s) => normalizeUrl(s.url)));
    for (const source of packSources) {
      const url = normalizeUrl(source.url);
      if (!urls.has(url) || existing.has(url)) continue;
      skill.sources.push({ ...source, line: 0 });
      existing.add(url);
      used.add(url);
      attachedSources.push({ skillId: skill.id, title: source.title, url: source.url });
    }
  }

  const planned = plannedFiles(tree, file);
  return {
    tree,
    files: planned.map((p) => p.file),
    report: {
      branches: tree.branches.length,
      skills: tree.skills.length,
      quests: tree.quests.length,
      items: before.items,
      recall: before.recall,
      generatedItemIds: before.missingItems,
      generatedRecallIds: before.missingRecall,
      factsAsOf,
      stampedFactsAsOf,
      stampedItemAsOf,
      stampedOrder,
      attachedSources,
      unattachedSources: packSources.filter((s) => !used.has(normalizeUrl(s.url))),
      errors: [...parsed.diagnostics.filter((d) => d.severity === "error"), ...unsafePaths(planned)],
    },
  };
}

interface Args {
  bundle: string | null;
  force: boolean;
  dryRun: boolean;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { bundle: null, force: false, dryRun: false, out: "content" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--out") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) throw new Error("--out needs a value");
      args.out = value;
    }
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else if (!a.startsWith("--")) args.bundle = a;
    else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

function log(line = ""): void {
  process.stderr.write(`${line}\n`);
}

/** Repo-relative when inside the repo, absolute otherwise. */
function display(p: string): string {
  const rel = path.relative(process.cwd(), p);
  return rel === "" ? "." : rel.startsWith("..") ? p : rel;
}

function isInside(dir: string, target: string): boolean {
  const rel = path.relative(dir, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function formatDiagnostic(d: Diagnostic): string {
  return `  ${d.file ?? ""}:${d.line ?? ""} ${d.message}`;
}

export function main(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    return 2;
  }
  if (!args.bundle) {
    log("Usage: pnpm content:import <bundle.skilltree.md> [--force] [--dry-run] [--out content]");
    return 2;
  }

  const bundlePath = path.resolve(args.bundle);
  const shownPath = display(bundlePath);
  const { files, report } = planImport(fs.readFileSync(bundlePath, "utf8"), shownPath);
  if (report.errors.length) {
    log(`${shownPath}: ${report.errors.length} parse error(s); nothing imported.`);
    report.errors.forEach((d) => log(formatDiagnostic(d)));
    return 1;
  }

  const outDir = path.resolve(args.out);
  const targets = files.map((f) => ({ ...f, target: diskPath(f.path, outDir) }));
  // planImport already refuses unsafe ids; this guards the write itself.
  const escaping = targets.filter((t) => !isInside(outDir, t.target));
  if (escaping.length) {
    log(`Refusing to write outside ${display(outDir)}/:`);
    escaping.forEach((t) => log(`  ${t.target}`));
    return 1;
  }
  const existing = targets.filter((t) => fs.existsSync(t.target));
  const verb = args.dryRun ? "Would import" : "Importing";
  log(`${verb} ${shownPath} → ${display(outDir)}/`);
  log(`  ${report.branches} branches, ${report.skills} skills, ${report.quests} quest(s), 1 pack`);
  log(`  ${report.items} items (${report.generatedItemIds} ids generated), ${report.recall} recall questions (${report.generatedRecallIds} ids generated)`);
  if (report.stampedFactsAsOf.length) {
    log(`  facts_as_of ${report.factsAsOf} stamped on ${report.stampedFactsAsOf.length} skill(s) with time-sensitive items`);
  }
  if (report.stampedItemAsOf.length) {
    log(`  As of ${report.factsAsOf} stamped on ${report.stampedItemAsOf.length} time-sensitive quest habit(s)`);
  }
  if (report.stampedOrder.length) {
    log(`  branch order kept: ${report.stampedOrder.map((o) => `${o.branchId}=${o.order}`).join(", ")}`);
  }
  log(`  ${report.attachedSources.length} pack source(s) attached to ${new Set(report.attachedSources.map((s) => s.skillId)).size} skill(s)`);
  if (report.unattachedSources.length) {
    log(`  ${report.unattachedSources.length} pack source(s) not linked from any skill (kept in the pack only):`);
    report.unattachedSources.forEach((s) => log(`    - ${s.title} <${s.url}>`));
  }

  if (existing.length && !args.force) {
    log(`Refusing to overwrite ${existing.length} existing file(s) (pass --force to overwrite):`);
    existing.forEach((t) => log(`  ${display(t.target)}`));
    return 1;
  }

  log(`  ${targets.length} file(s)${args.dryRun ? " would be written" : " written"}${existing.length ? ` (${existing.length} overwritten)` : ""}:`);
  for (const t of targets) {
    if (!args.dryRun) {
      fs.mkdirSync(path.dirname(t.target), { recursive: true });
      fs.writeFileSync(t.target, t.text);
    }
    log(`    ${display(t.target)}`);
  }
  if (!args.dryRun) log("Next: pnpm validate");
  return 0;
}

// Run only as a script (tsx scripts/import-bundle.ts), not when imported by tests.
if (process.argv[1] && /import-bundle\.ts$/.test(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
