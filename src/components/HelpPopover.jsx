import { useState, useEffect, useRef } from "react";

export function HelpPopover({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center justify-center w-[1.1em] h-[1.1em] rounded-full border leading-none transition-colors",
          open
            ? "border-[color:var(--ui-color-text-secondary)] text-[color:var(--ui-color-text-secondary)]"
            : "border-[color:var(--ui-color-text-muted)] text-[color:var(--ui-color-text-muted)] hover:border-[color:var(--ui-color-text-secondary)] hover:text-[color:var(--ui-color-text-secondary)]",
        ].join(" ")}
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-max rounded-lg bg-[var(--ui-color-panel-bg)] border border-[color:var(--ui-color-text-muted)]/20 shadow-lg px-3 py-2.5 flex flex-col gap-1 text-[length:var(--ui-fs-metric-meta)]">
          {items.map((item) => (
            <div key={item} className="text-[color:var(--ui-color-text-muted)] whitespace-nowrap">{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}
