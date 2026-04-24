import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauri } from "./env.js";
import { loadFloatWindowBounds } from "./floatWindowPrefs.js";

const TITLES = {
  peak: "Peak",
  loudness: "Loudness",
  spectrum: "Spectrum",
  vector: "Vectorscope",
};

/**
 * One float per panel kind: same label — second click focuses the existing window.
 * @param {keyof TITLES} kind
 * @returns {Promise<void>}
 */
export async function openFloatPanel(kind) {
  if (!isTauri() || !TITLES[kind]) return;
  const label = `float-${kind}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    try {
      await existing.show();
      await existing.setFocus();
    } catch (e) {
      console.error("float window focus failed", e);
    }
    return;
  }
  const b = await loadFloatWindowBounds(kind);
  const w = new WebviewWindow(label, {
    url: `index.html?float=${encodeURIComponent(kind)}`,
    title: `${TITLES[kind]} — AudioMeter`,
    width: b.width,
    height: b.height,
    ...(Number.isFinite(b.x) && Number.isFinite(b.y) ? { x: b.x, y: b.y } : {}),
    resizable: true,
    alwaysOnTop: true,
    parent: "main",
  });
  w.once("tauri://error", (e) => {
    console.error("float window create failed", e);
  });
}
