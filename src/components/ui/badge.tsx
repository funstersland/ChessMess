import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "good" | "danger" | "warn" | "accent";
}) {
  const tones = {
    muted: "bg-elevated text-muted border-border",
    good: "bg-good/15 text-good border-good/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    warn: "bg-warn/15 text-warn border-warn/30",
    accent: "bg-accent text-accent-fg border-transparent",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
