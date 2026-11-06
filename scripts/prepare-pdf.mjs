import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
const target = resolve("public/pdfjs");
mkdirSync(target, { recursive: true });
cpSync(resolve(root, "build/pdf.worker.min.mjs"), resolve(target, "pdf.worker.min.mjs"));
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(resolve(root, folder), resolve(target, folder), { recursive: true });
}
