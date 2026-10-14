// Builds the Chrome extension into extension/dist with esbuild (already a dependency of vite).
//   node extension/build.mjs          one-shot build
//   node extension/build.mjs --watch  rebuild on change
import { build, context } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "dist");
const watch = process.argv.includes("--watch");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, "manifest.json"), join(out, "manifest.json"));
cpSync(join(root, "icons"), join(out, "icons"), { recursive: true });
cpSync(join(root, "src/sidepanel/sidepanel.html"), join(out, "sidepanel.html"));
cpSync(join(root, "src/sidepanel/sidepanel.css"), join(out, "sidepanel.css"));

const common = { bundle: true, sourcemap: false, target: "chrome116", logLevel: "info", minify: false };
const bundles = [
  // The service worker is an ES module (manifest "type": "module").
  { entryPoints: [join(root, "src/background.ts")], outfile: join(out, "background.js"), format: "esm" },
  // Content scripts run in the page's world: a self-contained IIFE, no imports.
  { entryPoints: [join(root, "src/content/engine.ts")], outfile: join(out, "content.js"), format: "iife" },
  { entryPoints: [join(root, "src/sidepanel/sidepanel.ts")], outfile: join(out, "sidepanel.js"), format: "iife" },
];

if (watch) {
  for (const b of bundles) (await context({ ...common, ...b })).watch();
  console.log("watching extension sources…");
} else {
  await Promise.all(bundles.map((b) => build({ ...common, ...b })));
}
