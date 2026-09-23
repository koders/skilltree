// Content for the Next app (server only). Parsed once in production; re-read
// on every call in development so edits to content/ show up on refresh.

import "server-only";
import { loadContentTree } from "@/lib/content/load";
import { type ContentIndex, type ContentTree, indexContent } from "@/lib/content/types";

export interface LoadedContent {
  tree: ContentTree;
  index: ContentIndex;
}

let cached: LoadedContent | null = null;

function load(): LoadedContent {
  const tree = loadContentTree();
  return { tree, index: indexContent(tree) };
}

export function getContent(): LoadedContent {
  if (process.env.NODE_ENV !== "production") return load();
  cached ??= load();
  return cached;
}
