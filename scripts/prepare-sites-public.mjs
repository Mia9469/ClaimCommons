import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "app/static");
const output = resolve(root, "sites-public");

await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, "data"), { recursive: true });

for (const name of ["index.html", "styles.css", "app.js", "og.png"]) {
  await copyFile(resolve(source, name), resolve(output, name));
}

await copyFile(
  resolve(source, "data/published-paper-dossiers.json"),
  resolve(output, "data/published-paper-dossiers.json"),
);
