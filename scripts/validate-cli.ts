// `pnpm validate [path] [--json] [--today YYYY-MM-DD] [--quiet]`, with its
// I/O injected so it can be tested without the parser or a real content dir.
// Exit codes: 0 = no errors, 1 = validation errors, 2 = bad usage or unreadable input.

import type { ContentTree } from "@/lib/content/types";
import { formatDiagnostics } from "@/lib/content/format-diagnostics";
import { summarize, validate } from "@/lib/content/validate";
import { isIsoDate } from "@/lib/engine/dates";

export interface ValidateCliDeps {
  loadTree(dir: string): ContentTree;
  parseBundleFile(path: string): ContentTree;
  stdout(s: string): void;
  stderr(s: string): void;
  isTTY: boolean;
}

export interface ValidateCliArgs {
  path: string;
  json: boolean;
  quiet: boolean;
  today: string | undefined;
  help: boolean;
}

export const DEFAULT_CONTENT_DIR = "content";

export const USAGE = `Usage: pnpm validate [path] [--json] [--today YYYY-MM-DD] [--quiet]

  path       content directory (default: ${DEFAULT_CONTENT_DIR}) or a *.skilltree.md bundle
  --json     print {"diagnostics", "summary"} as JSON
  --today    date for the freshness check (default: today in Europe/Riga)
  --quiet    print errors only (the summary still counts warnings)
`;

export function parseValidateArgs(argv: readonly string[]): ValidateCliArgs | { error: string } {
  const args: ValidateCliArgs = { path: DEFAULT_CONTENT_DIR, json: false, quiet: false, today: undefined, help: false };
  let pathSet = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue; // `pnpm validate -- --json` forwards the separator
    if (arg === "--json") args.json = true;
    else if (arg === "--quiet" || arg === "-q") args.quiet = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--today" || arg.startsWith("--today=")) {
      const value = arg === "--today" ? argv[++i] : arg.slice("--today=".length);
      if (value === undefined || !isIsoDate(value)) return { error: `--today needs a date as YYYY-MM-DD, got ${value ?? "nothing"}` };
      args.today = value;
    } else if (arg.startsWith("-")) return { error: `Unknown option ${arg}` };
    else if (pathSet) return { error: `Only one path can be validated at a time (got ${args.path} and ${arg})` };
    else {
      args.path = arg;
      pathSet = true;
    }
  }
  return args;
}

export function runValidateCli(argv: string[], deps: ValidateCliDeps): number {
  const args = parseValidateArgs(argv);
  if ("error" in args) {
    deps.stderr(`${args.error}\n\n${USAGE}`);
    return 2;
  }
  if (args.help) {
    deps.stdout(USAGE);
    return 0;
  }

  let tree: ContentTree;
  try {
    tree = isBundlePath(args.path) ? deps.parseBundleFile(args.path) : deps.loadTree(args.path);
  } catch (err) {
    deps.stderr(`Could not read ${args.path}: ${err instanceof Error ? err.message : String(err)}\n`);
    return 2;
  }

  const diagnostics = validate(tree, { today: args.today });
  const summary = summarize(diagnostics);
  if (args.json) {
    const shown = args.quiet ? diagnostics.filter((d) => d.severity === "error") : diagnostics;
    deps.stdout(`${JSON.stringify({ diagnostics: shown, summary }, null, 2)}\n`);
  } else {
    deps.stdout(`${formatDiagnostics(diagnostics, { color: deps.isTTY, quiet: args.quiet })}\n`);
  }
  return summary.errors > 0 ? 1 : 0;
}

function isBundlePath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}
