"use client";

import clsx from "clsx";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastTone = "info" | "success" | "error" | "xp";
interface ToastMessage {
  id: number;
  text: React.ReactNode;
  tone: ToastTone;
}

const ToastContext = createContext<(text: React.ReactNode, tone?: ToastTone) => void>(() => {});

/** `const toast = useToast(); toast("+90 XP", "xp")` */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const next = useRef(1);

  const push = useCallback((text: React.ReactNode, tone: ToastTone = "info") => {
    const id = next.current++;
    setMessages((m) => [...m.slice(-3), { id, text, tone }]);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "panel animate-rise px-4 py-2 text-[13px]",
              m.tone === "error" && "!border-danger/50 text-danger",
              m.tone === "success" && "text-ok",
              m.tone === "xp" && "!border-gold/60 font-mono text-gold-bright shadow-[0_0_30px_-8px_var(--gold)]",
            )}
          >
            {m.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
