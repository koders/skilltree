import type { Metadata } from "next";
import { Uncharted } from "@/components/shell/Uncharted";
import { Wordmark } from "@/components/shell/Wordmark";

export const metadata: Metadata = { title: "Uncharted territory" };

export default function NotFound() {
  return (
    <div className="starfield relative flex min-h-dvh flex-col">
      <header className="flex h-[var(--topbar-h)] items-center px-4 sm:px-5">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-24 pt-8">
        <Uncharted />
      </main>
    </div>
  );
}
