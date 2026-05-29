import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(currentDir);
const html = readFileSync(join(currentDir, "index.html"), "utf8");
const tauriConfig = JSON.parse(
  readFileSync(join(rootDir, "src-tauri", "tauri.conf.json"), "utf8"),
);

describe("landing page downloads", () => {
  test("download links fall back to GitHub Releases instead of inert anchors", () => {
    expect(html).not.toContain("|| '#'");
    expect(html).toContain("https://github.com/SounDoer/PLVS/releases");
    expect(html).toContain("View Releases");
  });

  test("release API fallback uses neutral version copy", () => {
    expect(html).not.toContain("v0.1.0");
    expect(html).toContain("Latest release");
  });
});

describe("landing page responsive layout", () => {
  test("mobile breakpoint stacks dense two-column sections", () => {
    expect(html).toContain("@media (max-width: 720px)");
    expect(html).toMatch(/\.hero-btns\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(html).toMatch(/\.feature-row\s*\{[^}]*grid-template-columns:\s*1fr/s);
    expect(html).toMatch(/\.subscribe-section\s*\{[^}]*flex-direction:\s*column/s);
  });
});

describe("landing page release updates", () => {
  test("does not present a fake email signup", () => {
    expect(html).not.toContain("subscribe-form");
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain("You're on the list");
    expect(html).toContain("Follow GitHub Releases");
  });
});

describe("landing page system requirements", () => {
  test("platform cards include release-critical OS and architecture requirements", () => {
    expect(html).toContain("10 / 11 · x64");
    expect(html).toContain("Apple Silicon");
    expect(html).toContain(`macOS ${tauriConfig.bundle.macOS.minimumSystemVersion}+`);
  });
});
