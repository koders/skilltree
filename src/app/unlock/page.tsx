import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/Wordmark";
import { gatePassword, safeNextPath, SESSION_DAYS } from "@/lib/gate";
import { UnlockForm } from "./UnlockForm";

export const metadata: Metadata = { title: "Unlock" };

export default async function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  const next = safeNextPath(String((await searchParams).next ?? "/"));
  // Without a passphrase the app is local-only and there's nothing to unlock.
  if (!gatePassword()) redirect(next);

  return (
    <main className="starfield grid min-h-dvh place-items-center px-4">
      <div className="panel w-full max-w-[380px] animate-rise px-7 py-8">
        <Wordmark />
        <h1 className="mt-7 font-display text-[26px] font-medium leading-tight text-parchment">The atlas is sealed</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-mist">
          This skill tree belongs to one traveller. Enter the passphrase to open it on this device for{" "}
          {SESSION_DAYS} days.
        </p>
        <UnlockForm next={next} />
      </div>
    </main>
  );
}
