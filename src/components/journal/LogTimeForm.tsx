"use client";

import clsx from "clsx";
import { Brain, ChevronDown, Clock, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { logTime } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { ITEM_TYPE_META, formatMinutesShort } from "@/components/ui/meta";
import { useAction } from "@/components/ui/useAction";
import { xpForLog } from "@/lib/engine/xp";
import type { Activity } from "@/lib/progress/types";
import { fieldClass } from "./styles";

export interface SkillOptionGroup {
  branch: string;
  skills: { id: string; title: string }[];
}

const ACTIVITIES: { value: Activity; label: string; color: string; icon: LucideIcon }[] = [
  { value: "watch", ...ITEM_TYPE_META.watch },
  { value: "read", ...ITEM_TYPE_META.read },
  { value: "do", ...ITEM_TYPE_META.do },
  { value: "build", ...ITEM_TYPE_META.build },
  { value: "output", ...ITEM_TYPE_META.output },
  { value: "habit", ...ITEM_TYPE_META.habit },
  { value: "review", label: "Review", color: "var(--type-recall)", icon: Brain },
  { value: "other", label: "Other", color: "var(--mist)", icon: Clock },
];

const PRESETS = [15, 30, 45, 60, 90];

export function LogTimeForm({ groups, today }: { groups: SkillOptionGroup[]; today: string }) {
  const { run, pending } = useAction();
  const id = useId();
  const [skillId, setSkillId] = useState("");
  const [activity, setActivity] = useState<Activity>("watch");
  const [minutes, setMinutes] = useState(30);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const xp = xpForLog(activity, minutes);
  const valid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && date <= today;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    void run(
      () => logTime({ skillId: skillId || null, activity, minutes, loggedOn: date, note: note.trim() || null }),
      { success: `+${xp} XP · ${formatMinutesShort(minutes)} logged`, tone: "xp" },
    ).then((result) => {
      if (result.ok) {
        setNote("");
        setDate(today);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Log time">
      <div>
        <label htmlFor={`${id}-skill`} className="hud-label mb-1.5 block">
          Skill <span className="normal-case tracking-normal text-mist-dim">(optional)</span>
        </label>
        <div className="relative">
          <select
            id={`${id}-skill`}
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className={clsx(fieldClass, "appearance-none pr-8", !skillId && "text-mist")}
          >
            <option value="">No particular skill</option>
            {groups.map((g) => (
              <optgroup key={g.branch} label={g.branch}>
                {g.skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
        </div>
      </div>

      <fieldset>
        <legend className="hud-label mb-1.5">Activity</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {ACTIVITIES.map((a) => {
            const Icon = a.icon;
            const checked = activity === a.value;
            return (
              <label
                key={a.value}
                className={clsx(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] transition-[border-color,background,color] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
                  checked ? "text-parchment" : "border-ink-600 text-mist hover:border-ink-500 hover:text-parchment-dim",
                )}
                style={
                  checked
                    ? {
                        borderColor: `color-mix(in oklab, ${a.color} 65%, transparent)`,
                        background: `color-mix(in oklab, ${a.color} 12%, transparent)`,
                      }
                    : undefined
                }
              >
                <input
                  type="radio"
                  name={`${id}-activity`}
                  value={a.value}
                  checked={checked}
                  onChange={() => setActivity(a.value)}
                  className="sr-only"
                />
                <Icon className="h-4 w-4" strokeWidth={1.8} style={{ color: checked ? a.color : undefined }} />
                {a.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-minutes`} className="hud-label mb-1.5 block">
          Minutes
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-minutes`}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            step={1}
            required
            value={Number.isFinite(minutes) ? minutes : ""}
            onChange={(e) => setMinutes(Math.round(Number(e.target.value)))}
            className={clsx(fieldClass, "!w-20 shrink-0 font-mono")}
          />
          <div className="flex flex-1 flex-wrap gap-1" role="group" aria-label="Quick minutes">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMinutes(p)}
                className={clsx(
                  "h-9 min-w-9 flex-1 rounded-lg border font-mono text-[11.5px] transition-colors",
                  minutes === p ? "border-gold/60 bg-gold/10 text-gold-bright" : "border-ink-600 text-mist hover:border-ink-500 hover:text-parchment",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-date`} className="hud-label mb-1.5 block">
          Date
        </label>
        <input
          id={`${id}-date`}
          type="date"
          value={date}
          max={today}
          required
          onChange={(e) => setDate(e.target.value)}
          className={clsx(fieldClass, "font-mono")}
        />
      </div>

      <div>
        <label htmlFor={`${id}-note`} className="hud-label mb-1.5 block">
          Note <span className="normal-case tracking-normal text-mist-dim">(optional)</span>
        </label>
        <textarea
          id={`${id}-note`}
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you work on?"
          className={clsx(fieldClass, "h-auto resize-y py-2 leading-snug")}
        />
      </div>

      <Button type="submit" variant="gold" className="w-full" loading={pending} disabled={!valid}>
        Log {valid ? formatMinutesShort(minutes) : "time"}
        {valid && <span className="font-mono text-[12px] opacity-75">· +{xp} XP</span>}
      </Button>
    </form>
  );
}
