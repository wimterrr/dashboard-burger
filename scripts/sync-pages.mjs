import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const docsDir = path.join(rootDir, "docs");

if (!existsSync(distDir)) {
  throw new Error(`dist directory is missing: ${distDir}`);
}

rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });

for (const entry of readdirSync(distDir)) {
  cpSync(path.join(distDir, entry), path.join(docsDir, entry), { recursive: true });
}

writeFileSync(path.join(docsDir, ".nojekyll"), "");

console.log(
  JSON.stringify(
    {
      ok: true,
      docs_path: docsDir,
      copied_from: distDir,
    },
    null,
    2,
  ),
);
