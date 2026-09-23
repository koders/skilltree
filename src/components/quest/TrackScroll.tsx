"use client";

import { useEffect, useRef } from "react";

/**
 * Horizontal scroller for the week track on narrow screens: on mount it
 * centres the "now" marker, so week 9 isn't hidden off the right edge.
 */
export function TrackScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const now = el.querySelector<HTMLElement>("[data-now]");
    if (!now) return;
    const box = el.getBoundingClientRect();
    const mark = now.getBoundingClientRect();
    el.scrollLeft += mark.left + mark.width / 2 - (box.left + box.width / 2);
  }, []);

  return (
    <div ref={ref} className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      {children}
    </div>
  );
}
