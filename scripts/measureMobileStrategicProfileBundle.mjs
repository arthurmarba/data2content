import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const route = process.argv[2] ?? "/dashboard/boards/mobile-strategic-profile/page";
const buildDir = path.resolve(process.cwd(), ".next");
const manifestPath = path.join(buildDir, "app-build-manifest.json");

if (!fs.existsSync(manifestPath)) {
  throw new Error(".next/app-build-manifest.json não encontrado. Execute npm run build primeiro.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const files = manifest.pages?.[route];
if (!Array.isArray(files)) {
  throw new Error(`Rota não encontrada no app-build-manifest: ${route}`);
}

const entries = files.flatMap((file) => {
  const absolutePath = path.join(buildDir, file);
  if (!fs.existsSync(absolutePath)) return [];
  const contents = fs.readFileSync(absolutePath);
  return [{
    file,
    rawBytes: contents.byteLength,
    gzipBytes: zlib.gzipSync(contents).byteLength,
  }];
});

const totals = entries.reduce(
  (sum, entry) => ({
    rawBytes: sum.rawBytes + entry.rawBytes,
    gzipBytes: sum.gzipBytes + entry.gzipBytes,
  }),
  { rawBytes: 0, gzipBytes: 0 },
);

console.log(JSON.stringify({ route, files: entries, totals }, null, 2));
