// Shown while any page in the app loads its progress: a quiet star field with
// the player's gold orb breathing in the middle.

export default function Loading() {
  return (
    <div
      className="starfield grid h-[calc(100dvh-var(--topbar-h))] place-items-center overflow-hidden"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-7">
        <div className="relative h-16 w-16">
          <div className="animate-glow-pulse absolute -inset-10 rounded-full bg-[radial-gradient(circle,rgba(233,196,106,0.32),transparent_66%)]" />
          <div className="absolute -inset-3 animate-[spin_9s_linear_infinite] rounded-full border border-dashed border-gold/35" />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_40%_32%,#fff4cf,var(--gold-bright)_38%,var(--gold)_72%,var(--gold-deep))] shadow-[0_0_40px_-6px_var(--gold)]" />
        </div>
        <p className="hud-label animate-twinkle">Reading the stars</p>
      </div>
    </div>
  );
}
