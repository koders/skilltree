import type { Metadata } from "next";
import { Uncharted } from "@/components/shell/Uncharted";

export const metadata: Metadata = { title: "Uncharted territory" };

/** notFound() inside the app shell (e.g. an unknown quest id): the top bar stays, so no second header. */
export default function NotFound() {
  return (
    <div className="starfield flex min-h-[calc(100dvh-var(--topbar-h))] items-center justify-center px-4 pb-16 pt-8">
      <Uncharted />
    </div>
  );
}
