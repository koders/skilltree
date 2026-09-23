"use client";

import clsx from "clsx";
import { Flag } from "lucide-react";
import { useState } from "react";
import { startQuest } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/ui/useAction";
import { formatDay } from "./format";

/** Pick week 1 (this Monday or next) and an optional hours/week override, then start. */
export function StartQuestForm({
  questId,
  thisMonday,
  nextMonday,
  defaultHours,
}: {
  questId: string;
  thisMonday: string;
  nextMonday: string;
  /** The quest's target, e.g. "4–5"; null when it sets none. */
  defaultHours: string | null;
}) {
  const { run, pending } = useAction();
  const [start, setStart] = useState<"this" | "next">("this");
  const [hours, setHours] = useState("");
  const parsedHours = hours.trim() === "" ? null : Number(hours);
  const hoursValid = parsedHours === null || (Number.isFinite(parsedHours) && parsedHours > 0 && parsedHours <= 168);

  const options = [
    { value: "this" as const, label: "This week", date: thisMonday, note: "Week 1 is now" },
    { value: "next" as const, label: "Next week", date: nextMonday, note: "A clean start on Monday" },
  ];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hoursValid) return;
        const startedOn = start === "this" ? thisMonday : nextMonday;
        void run(() => startQuest({ questId, startedOn, hoursPerWeek: parsedHours }), {
          success: start === "this" ? "Quest started · week 1 is live" : `Quest set · week 1 starts ${formatDay(nextMonday)}`,
        });
      }}
    >
      <fieldset>
        <legend className="hud-label">Week 1 starts</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {options.map((o) => {
            const checked = start === o.value;
            return (
              <label
                key={o.value}
                className={clsx(
                  "relative cursor-pointer rounded-xl border px-3 py-3 transition-[border-color,background,box-shadow] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold",
                  checked
                    ? "border-gold/60 bg-gold/[0.07] shadow-[0_0_24px_-10px_var(--gold)]"
                    : "border-ink-500 bg-ink-850/60 hover:border-ink-400",
                )}
              >
                <input
                  type="radio"
                  name="start"
                  value={o.value}
                  checked={checked}
                  onChange={() => setStart(o.value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between gap-2">
                  <span className={clsx("text-[13.5px] font-medium", checked ? "text-parchment" : "text-parchment-dim")}>{o.label}</span>
                  <span
                    aria-hidden
                    className={clsx(
                      "h-2.5 w-2.5 rotate-45 rounded-[2px] border transition-colors",
                      checked ? "border-gold-bright bg-gold shadow-[0_0_8px_var(--gold)]" : "border-ink-400",
                    )}
                  />
                </span>
                <span className={clsx("mt-1 block font-mono text-[12px]", checked ? "text-gold-bright" : "text-mist")}>
                  {formatDay(o.date)}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-mist-dim">{o.note}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="hud-label">Hours per week</span>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={168}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder={defaultHours ?? "5"}
            aria-describedby="start-hours-help"
            className="h-10 w-24 rounded-lg border border-ink-500 bg-ink-900 px-3 text-right font-mono text-[14px] text-parchment outline-none placeholder:text-mist-dim focus:border-gold/70"
          />
          <span className="font-mono text-[12px] text-mist">h / week</span>
        </div>
        <span id="start-hours-help" className={clsx("mt-1.5 block text-[12px]", hoursValid ? "text-mist" : "text-danger")}>
          {hoursValid
            ? defaultHours
              ? `Optional. Leave blank for the quest's ${defaultHours} h target.`
              : "Optional. Leave blank for the default."
            : "Enter 0.5–168 hours"}
        </span>
      </label>

      <Button type="submit" variant="gold" className="h-11 w-full text-[14.5px]" loading={pending} disabled={!hoursValid}>
        <Flag className="h-4 w-4" strokeWidth={2} />
        Start quest
      </Button>
    </form>
  );
}
