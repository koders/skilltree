"use client";

import { createContext, useContext } from "react";

export interface CanvasActions {
  select: (skillId: string) => void;
  /** Pointer or keyboard focus entering (id) or leaving (null) an orb. */
  hover: (skillId: string | null) => void;
  /** Keyboard focus landed on an orb: bring it into view. */
  reveal: (skillId: string) => void;
}

export const CanvasContext = createContext<CanvasActions>({
  select: () => {},
  hover: () => {},
  reveal: () => {},
});

export function useCanvasActions(): CanvasActions {
  return useContext(CanvasContext);
}
