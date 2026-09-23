"use client";

// STUB — replaced by the panel implementation. The props are the contract.

import type { Skill } from "@/lib/content/types";
import { Dialog } from "@/components/ui/Dialog";

export interface RecallDialogProps {
  open: boolean;
  onClose: () => void;
  skill: Skill;
  mode: "test-out" | "complete";
  /** Called after a successful submit. */
  onSubmitted?: (result: { passed: number; total: number; learned: boolean }) => void;
}

export function RecallDialog({ open, onClose, skill, mode }: RecallDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`${mode === "test-out" ? "Test out" : "Complete"}: ${skill.title}`}>
      <p>Recall flow coming soon.</p>
    </Dialog>
  );
}
