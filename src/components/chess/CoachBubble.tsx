import { Volume2, VolumeX } from "lucide-react";
import { ChessMessMark } from "@/components/brand/ChessMessMark";

export function CoachBubble({
  text,
  speaking,
  onMute,
}: {
  text: string | null;
  speaking?: boolean;
  onMute?: () => void;
}) {
  if (!text) return null;
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3">
      <div className="mt-0.5 size-8 shrink-0 overflow-hidden rounded-full border border-border">
        <ChessMessMark size={32} withBg className="size-full" />
      </div>
      <p className="flex-1 text-sm leading-relaxed text-fg">{text}</p>
      {onMute && (
        <button
          type="button"
          onClick={onMute}
          className="size-11 shrink-0 rounded-[var(--radius-sm)] text-muted hover:bg-elevated hover:text-fg"
          aria-label={speaking ? "Stop coach" : "Coach muted"}
        >
          {speaking ? <Volume2 className="mx-auto size-4" /> : <VolumeX className="mx-auto size-4" />}
        </button>
      )}
    </div>
  );
}
