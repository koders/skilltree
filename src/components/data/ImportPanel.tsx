"use client";

import clsx from "clsx";
import { FileUp, TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
import { importProgress } from "@/app/actions";
import { fieldClass } from "@/components/journal/styles";
import { Button } from "@/components/ui/Button";
import { useAction } from "@/components/ui/useAction";
import { IMPORT_MAX_CHARS } from "@/lib/config";
import type { ImportCounts } from "@/lib/progress/export";
import { previewImport } from "./import-preview";
import { TABLE_LABELS, TABLE_ORDER } from "./tables";

type Mode = "merge" | "replace";

export function ImportPanel() {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, pending } = useAction();
  const [json, setJson] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<{ ok: true; counts: ImportCounts } | { ok: false; error: string } | null>(null);

  const look = previewImport(json);
  const payload = look?.payload ?? null;
  const armed = mode === "merge" || confirm === "REPLACE";
  const canSubmit = payload !== null && armed && !pending;

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setJson(await file.text());
    setFileName(file.name);
    setResult(null);
  };

  const submit = () => {
    if (payload === null) return;
    void run(() => importProgress({ json: payload, mode }), { success: "Progress imported" }).then((r) => {
      setResult(r.ok ? { ok: true, counts: r.data } : { ok: false, error: r.error });
      if (r.ok) setConfirm("");
    });
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col gap-3 rounded-lg border border-dashed border-ink-500 bg-ink-900/40 p-3 sm:flex-row sm:items-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void loadFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={fileRef}
          id={`${id}-file`}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => void loadFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" onClick={() => fileRef.current?.click()}>
          <FileUp className="h-3.5 w-3.5" />
          Choose file
        </Button>
        <span className="min-w-0 truncate font-mono text-[11.5px] text-mist">
          {fileName ?? "…or drop a .json export here, or paste below"}
        </span>
      </div>

      <div>
        <label htmlFor={`${id}-json`} className="hud-label mb-1.5 block">
          JSON <span className="normal-case tracking-normal text-mist">· up to {IMPORT_MAX_CHARS / 1_000_000} MB</span>
        </label>
        <textarea
          id={`${id}-json`}
          value={json}
          onChange={(e) => {
            setJson(e.target.value);
            setFileName(null);
            setResult(null);
          }}
          rows={6}
          spellCheck={false}
          placeholder={'{ "format": "skilltree-progress", "version": 1, "data": { … } }'}
          className={clsx(fieldClass, "h-auto resize-y py-2 font-mono text-[12px] leading-relaxed")}
        />
        {look && (
          <p className={clsx("mt-1.5 font-mono text-[11px]", look.error ? "text-danger" : "text-mist")} aria-live="polite">
            {look.error
              ? look.error
              : look.tables.length === 0
                ? "No tables in data"
                : look.tables.map(([t, n]) => `${n} ${TABLE_LABELS[t].toLowerCase()}`).join(" · ")}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="hud-label mb-1.5">Mode</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["merge", "Merge", "Add and update rows; keep the rest. Partial files are fine."],
              ["replace", "Replace", "Delete all progress, then load the file. Needs a full export."],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={clsx(
                "cursor-pointer rounded-lg border px-3 py-2.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold",
                mode === value
                  ? value === "replace"
                    ? "border-danger/55 bg-danger/[0.07]"
                    : "border-gold/55 bg-gold/[0.07]"
                  : "border-ink-600 hover:border-ink-500",
              )}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                value={value}
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  setConfirm("");
                }}
                className="sr-only"
              />
              <span className={clsx("block text-[13px] font-medium", mode === value ? "text-parchment" : "text-parchment-dim")}>
                {label}
                {value === "merge" && <span className="ml-1.5 font-mono text-[10px] text-mist">default</span>}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-mist">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "replace" && (
        <div className="rounded-lg border border-danger/40 bg-danger/[0.06] p-3">
          <p className="flex items-start gap-2 text-[12.5px] text-parchment-dim">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            Replace wipes every progress row first. Download an export before you do this.
          </p>
          <label htmlFor={`${id}-confirm`} className="mt-3 block text-[12px] text-mist">
            Type <span className="font-mono text-danger">REPLACE</span> to confirm
          </label>
          <input
            id={`${id}-confirm`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className={clsx(fieldClass, "mt-1.5 font-mono")}
          />
        </div>
      )}

      <Button
        type="button"
        variant={mode === "replace" ? "danger" : "gold"}
        className="w-full"
        onClick={submit}
        disabled={!canSubmit}
        loading={pending}
      >
        {mode === "replace" ? "Replace all progress" : "Merge into progress"}
      </Button>

      {result &&
        (result.ok ? (
          <ImportResult counts={result.counts} />
        ) : (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-danger/40 bg-danger/[0.06] p-3 font-mono text-[11.5px] text-danger">
            {result.error}
          </pre>
        ))}
    </div>
  );
}

function ImportResult({ counts }: { counts: ImportCounts }) {
  const rows = TABLE_ORDER.map((t) => ({ t, c: counts[t] })).filter(
    ({ c }) => c && c.inserted + c.updated + c.unchanged + c.deleted > 0,
  );
  return (
    <div className="animate-rise rounded-lg border border-ok/35 bg-ok/[0.05] p-3" aria-live="polite">
      <p className="text-[12.5px] text-ok">Import complete</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-[12px] text-mist">Nothing changed.</p>
      ) : (
        <table className="mt-2 w-full font-mono text-[11.5px]">
          <thead>
            <tr className="text-left text-mist-dim">
              <th className="py-1 font-normal">Table</th>
              <th className="py-1 text-right font-normal">new</th>
              <th className="py-1 text-right font-normal">upd</th>
              <th className="py-1 text-right font-normal">same</th>
              <th className="py-1 text-right font-normal">del</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, c }) => (
              <tr key={t} className="border-t border-ink-600/60 text-parchment-dim">
                <td className="py-1 font-sans text-[12px]">{TABLE_LABELS[t]}</td>
                <td className="py-1 text-right text-ok">{c.inserted || "·"}</td>
                <td className="py-1 text-right text-gold">{c.updated || "·"}</td>
                <td className="py-1 text-right">{c.unchanged || "·"}</td>
                <td className="py-1 text-right text-danger">{c.deleted || "·"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
