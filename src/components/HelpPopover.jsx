import { useState, useEffect, useRef } from "react";

function iconForHint(item) {
  const text = String(item).toLowerCase();
  const baseCls = "h-[1.1em] w-[1.1em] shrink-0 text-[color:var(--ui-color-text-secondary)]";
  const common = {
    viewBox: "0 0 24 24",
    className: baseCls,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.1",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (text.includes("wheel")) {
    return (
      <svg {...common}>
        <rect x="5.5" y="3" width="13" height="17" rx="5.4" />
        <rect x="10.7" y="4.3" width="2.6" height="4.4" rx="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (text.includes("right")) {
    return (
      <svg {...common}>
        <rect x="5.5" y="3" width="13" height="17" rx="5.4" />
        <path d="M12 3.2H15.2A3.3 3.3 0 0 1 18.5 6.5V8.6H12V3.2Z" fill="currentColor" stroke="none" />
        <line x1="12" y1="3.2" x2="12" y2="8.6" />
      </svg>
    );
  }

  if (text.includes("left")) {
    return (
      <svg {...common}>
        <rect x="5.5" y="3" width="13" height="17" rx="5.4" />
        <path d="M12 3.2H8.8A3.3 3.3 0 0 0 5.5 6.5V8.6H12V3.2Z" fill="currentColor" stroke="none" />
        <line x1="12" y1="3.2" x2="12" y2="8.6" />
      </svg>
    );
  }

  if (text.includes("m / st") || text.includes("labels")) {
    return (
      <svg {...common}>
        <path d="M7 12.5V8.8A1.8 1.8 0 0 1 10.6 8.8V12" />
        <path d="M10.6 12V7.9A1.8 1.8 0 0 1 14.2 7.9V12.1" />
        <path d="M14.2 12.1V9.2A1.8 1.8 0 0 1 17.8 9.2V14.2A5.4 5.4 0 0 1 12.4 19.6H11.6A4.6 4.6 0 0 1 7 15V12.5Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <rect x="5.5" y="3" width="13" height="17" rx="5.4" />
      <line x1="12" y1="3.2" x2="12" y2="8.6" />
    </svg>
  );
}

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
            <div key={item} className="flex items-center gap-1.5 text-[color:var(--ui-color-text-muted)] whitespace-nowrap">
              {iconForHint(item)}
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
