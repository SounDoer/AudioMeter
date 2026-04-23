/**
 * Ensures root package.json "version" matches:
 * - src-tauri/Cargo.toml [package].version
 * - src-tauri/tauri.conf.json "version"
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const pkgVersion = pkg.version;

const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
const cargo = fs.readFileSync(cargoPath, "utf8");

const pkgIdx = cargo.indexOf("[package]");
if (pkgIdx === -1) {
  console.error("Cargo.toml: [package] section not found");
  process.exit(1);
}
const after = cargo.slice(pkgIdx);
const nextSection = after.search(/\n\[/);
const block = nextSection === -1 ? after : after.slice(0, nextSection);
const m = block.match(/^\s*version\s*=\s*"([^"]+)"/m);
if (!m) {
  console.error("Cargo.toml: package version not found in [package] block");
  process.exit(1);
}
const cargoVersion = m[1];

const tauriConfPath = path.join(root, "src-tauri", "tauri.conf.json");
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
const tauriVersion = tauriConf.version;
if (typeof tauriVersion !== "string") {
  console.error("tauri.conf.json: missing string \"version\"");
  process.exit(1);
}

if (pkgVersion !== cargoVersion || pkgVersion !== tauriVersion) {
  console.error(
    "Version mismatch — package.json, src-tauri/Cargo.toml [package], src-tauri/tauri.conf.json must match:",
  );
  console.error(`  package.json     ${pkgVersion}`);
  console.error(`  Cargo.toml       ${cargoVersion}`);
  console.error(`  tauri.conf.json  ${tauriVersion}`);
  process.exit(1);
}

console.log(`Versions OK (${pkgVersion})`);
