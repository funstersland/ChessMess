import { cn } from "@/lib/utils";
import { LOGO_MARK_URL } from "@/lib/theme/logo-mark";

type ChessMessMarkProps = {
  size?: number;
  withBg?: boolean;
  className?: string;
  title?: string;
};

export function ChessMessMark({
  size,
  withBg = false,
  className,
  title = "ChessMess",
}: ChessMessMarkProps) {
  return (
    <img
      src={LOGO_MARK_URL}
      alt={title}
      width={size}
      height={size}
      className={cn(
        "shrink-0 object-contain",
        size == null && "size-full",
        withBg && "rounded-[12%]",
        className,
      )}
      style={size != null ? { width: size, height: size } : undefined}
    />
  );
}
