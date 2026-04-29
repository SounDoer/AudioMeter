import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./env.js";

/** @returns {import("@tauri-apps/api/window").Window | null} */
function mainWindow() {
  if (!isTauri()) return null;
  return getCurrentWindow();
}

export async function minimizeMainWindow() {
  const w = mainWindow();
  if (!w) return;
  await w.minimize();
}

export async function toggleMaximizeMainWindow() {
  const w = mainWindow();
  if (!w) return;
  await w.toggleMaximize();
}

export async function closeMainWindow() {
  const w = mainWindow();
  if (!w) return;
  await w.close();
}
