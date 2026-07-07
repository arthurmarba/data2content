// scripts/revista/contactSheet.ts
// Junta todos os slide-NN.png de uma pasta numa única imagem (grade), para
// visualizar o carousel inteiro de uma vez.
//
// Uso:
//   npx tsx scripts/revista/contactSheet.ts --dir=output/revista/2026-06-17

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

async function main() {
  const dir = arg("dir");
  if (!dir) {
    console.error("Informe --dir=output/revista/<dia>");
    process.exit(1);
  }
  const abs = path.resolve(dir);
  const files = (await fs.readdir(abs))
    .filter((f) => /^slide-\d+\.png$/.test(f))
    .sort();
  if (files.length === 0) {
    console.error("Nenhum slide-NN.png em " + abs);
    process.exit(1);
  }

  const cells = files
    .map((f, i) => {
      const url = pathToFileURL(path.join(abs, f)).href;
      return `<figure><span class="n">${String(i + 1).padStart(2, "0")}</span><img src="${url}"></figure>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;box-sizing:border-box}
    body{background:#e9e6df;padding:40px;font-family:system-ui}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;width:1700px}
    figure{position:relative;border-radius:6px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.16)}
    img{width:100%;display:block}
    .n{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.65);color:#fff;
       font-size:18px;font-weight:700;padding:4px 12px;border-radius:20px;z-index:2}
  </style></head><body><div class="grid">${cells}</div></body></html>`;

  const htmlFile = path.join(abs, ".contact.html");
  await fs.writeFile(htmlFile, html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1780, height: 1200 }, deviceScaleFactor: 1.5 });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  const grid = await page.$(".grid");
  const out = path.join(abs, "contact-sheet.png");
  if (grid) await grid.screenshot({ path: out });
  await browser.close();
  await fs.rm(htmlFile, { force: true });
  console.error(`✓ contact sheet: ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
