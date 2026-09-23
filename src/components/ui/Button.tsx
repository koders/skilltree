import clsx from "clsx";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-parchment text-ink-900 hover:bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]",
  secondary: "border border-ink-500 bg-ink-700/70 text-parchment hover:border-ink-400 hover:bg-ink-600",
  ghost: "text-mist hover:bg-ink-700/70 hover:text-parchment",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
  gold: "bg-gradient-to-b from-gold-bright to-gold text-ink-900 shadow-[0_0_24px_-6px_var(--gold)] hover:from-white hover:to-gold-bright",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-[13.5px] gap-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center font-medium transition-[background,color,border,box-shadow] disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        SIZES[size],
        loading && "animate-pulse",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
