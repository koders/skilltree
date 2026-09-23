import type { Metadata } from "next";
import { Suspense } from "react";
import { TreeExplorer } from "@/components/tree/TreeExplorer";
import { getAppData } from "@/lib/data";
import { buildTreeData } from "@/lib/tree-data";

export const metadata: Metadata = { title: "Skill tree" };

export default async function TreePage() {
  const app = await getAppData();
  const data = buildTreeData(app);
  return (
    <div className="relative h-[calc(100dvh-var(--topbar-h))] overflow-hidden">
      {/* TreeExplorer reads the URL (useSearchParams), so it renders inside its own boundary. */}
      <Suspense fallback={<div className="starfield h-full w-full" />}>
        <TreeExplorer data={data} />
      </Suspense>
    </div>
  );
}
