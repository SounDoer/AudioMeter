import { cn } from "@/lib/utils";

/**
 * A small icon-only button with an optional tooltip.
 *
 * @param {{
 *   icon: import("react").ReactNode,
 *   tip?: string,
 *   disabled?: boolean,
 *   onClick?: () => void,
 *   className?: string,
 * }} props
 */
export function IconButton({ icon, tip, disabled = false, onClick, className }) {
  return (
    <div className="relative group">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex items-center justify-center size-8 rounded-md",
          "text-muted-foreground bg-transparent",
          "transition-colors duration-[120ms]",
          disabled
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-secondary hover:text-foreground",
          className,
        )}
      >
        {icon}
      </button>

      {tip && (
        <span
          className={cn(
            "absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50",
            "opacity-0 pointer-events-none",
            "group-hover:opacity-100",
            "transition-opacity duration-100 delay-100",
            "text-[11px] text-foreground bg-popover",
            "border border-white/10 rounded px-2 py-1",
            "whitespace-nowrap shadow-md",
          )}
        >
          {tip}
        </span>
      )}
    </div>
  );
}
