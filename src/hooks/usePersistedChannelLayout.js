import { useEffect, useState } from "react";
import { UI_PREFERENCES } from "../uiPreferences.js";

function readLayoutFromStorage() {
  try {
    const raw = localStorage.getItem(UI_PREFERENCES.layoutPersistKey);
    if (!raw) return "auto";
    const s = JSON.parse(raw);
    if (s.channelLayout === "auto" || s.channelLayout === "stereo" || s.channelLayout === "5.1") {
      return s.channelLayout;
    }
  } catch (_) {}
  return "auto";
}

/**
 * Reads Settings → Channel layout from the same persisted JSON as the main window so float panels stay
 * roughly in sync (poll + storage event). Same-tab updates do not fire `storage`; polling covers that.
 */
export function usePersistedChannelLayout() {
  const [channelLayout, setChannelLayout] = useState(() => readLayoutFromStorage());

  useEffect(() => {
    const tick = () => setChannelLayout(readLayoutFromStorage());
    const id = window.setInterval(tick, 800);
    const onStorage = (e) => {
      if (e.key === UI_PREFERENCES.layoutPersistKey || e.key === null) tick();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", tick);
    };
  }, []);

  return channelLayout;
}
