import { closeMainWindow, minimizeMainWindow, toggleMaximizeMainWindow } from "../ipc/mainWindowControls.js";

const btnClass =
  "flex h-9 w-11 shrink-0 items-center justify-center rounded-md text-[color:var(--ui-color-text-secondary)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--ui-color-text-primary)_12%,transparent)] hover:text-[color:var(--ui-color-text-primary)] active:bg-[color:color-mix(in_srgb,var(--ui-color-text-primary)_18%,transparent)]";

export function TitleBarWindowControls() {
  return (
    <div className="ml-1 flex shrink-0 items-stretch border-l border-[color:var(--ui-color-divider)] pl-2" data-tauri-no-drag>
      <button
        type="button"
        className={btnClass}
        aria-label="Minimize"
        onClick={() => void minimizeMainWindow()}
      >
        <svg width="10" height="1" viewBox="0 0 10 1" aria-hidden className="shrink-0">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        className={btnClass}
        aria-label="Maximize or restore"
        onClick={() => void toggleMaximizeMainWindow()}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden className="shrink-0">
          <rect x="0.5" y="0.5" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        className={`${btnClass} hover:!bg-red-600/85 hover:!text-white active:!bg-red-700`}
        aria-label="Close"
        onClick={() => void closeMainWindow()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="shrink-0">
          <path d="M1 1l8 8M9 1L1 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
