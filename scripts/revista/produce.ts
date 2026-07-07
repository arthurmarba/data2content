// scripts/revista/produce.ts
//
// Orquestrador do motor da Revista D2C: roda o pipeline inteiro a partir do brief
// já escrito (carousel.json), em UM comando, com logs limpos (LOG_LEVEL=error).
// Colapsa 5+ idas-e-vindas em 1. Cada passo degrada com elegância (no-op se não
// houver nada a fazer); se um passo FALHAR de verdade, para e diz qual.
//
// Ordem: resolveAssets → generateArt(+limpeza falso-texto) → fetchAssets →
//        videoCover → renderSlides → contactSheet.
//
// Uso:
//   npx tsx scripts/revista/produce.ts --dir=output/revista/<dia>
//   npx tsx scripts/revista/produce.ts --brief=output/revista/<dia>/carousel.json
//   ... --skip=art,video      (pula geração de IA e/ou cards de vídeo)
//   ... --render-only         (só resolveAssets + render + contactSheet; p/ ajustes de copy)

import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const briefArg = arg("brief");
const dirArg = arg("dir");
let briefPath: string;
let dir: string;
if (briefArg) {
  briefPath = path.resolve(briefArg);
  dir = path.dirname(briefPath);
} else if (dirArg) {
  dir = path.resolve(dirArg);
  briefPath = path.join(dir, "carousel.json");
} else {
  console.error("Informe --dir=output/revista/<dia> ou --brief=<...>/carousel.json");
  process.exit(1);
}
if (!existsSync(briefPath)) {
  console.error(`✗ brief não encontrado: ${briefPath}`);
  process.exit(1);
}

const skip = new Set((arg("skip") ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const renderOnly = has("render-only");

interface Step {
  id: string;
  label: string;
  script: string;
  args: string[];
  env: boolean; // precisa de --env-file=.env.local (DB / Gemini / Graph API)
}

const all: Step[] = [
  { id: "resolve", label: "Resolve assets (context.json → URLs)", script: "resolveAssets.ts", args: [`--brief=${briefPath}`], env: false },
  { id: "art", label: "Gera arte de IA (+ limpa falso-texto)", script: "generateArt.ts", args: [`--brief=${briefPath}`], env: true },
  { id: "fetch", label: "Baixa imagens reais", script: "fetchAssets.ts", args: [`--brief=${briefPath}`], env: true },
  { id: "video", label: "Monta cards de vídeo", script: "videoCover.ts", args: [`--brief=${briefPath}`], env: true },
  { id: "render", label: "Renderiza slides (PNG)", script: "renderSlides.ts", args: [`--brief=${briefPath}`], env: false },
  { id: "sheet", label: "Monta contact sheet", script: "contactSheet.ts", args: [`--dir=${dir}`], env: false },
];

const renderOnlyIds = new Set(["resolve", "render", "sheet"]);
const steps = all.filter((s) => {
  if (renderOnly) return renderOnlyIds.has(s.id);
  return !skip.has(s.id);
});

const scriptsDir = path.join(process.cwd(), "scripts", "revista");
const t0 = Date.now();
console.error(`▶ produce: ${path.relative(process.cwd(), briefPath)} (${steps.length} passos)\n`);

for (let i = 0; i < steps.length; i++) {
  const s = steps[i];
  const tag = `[${i + 1}/${steps.length}] ${s.label}`;
  console.error(`▸ ${tag}`);
  const tsxArgs = [s.env ? "--env-file=.env.local" : "", path.join(scriptsDir, s.script), ...s.args].filter(Boolean);
  const r = spawnSync("npx", ["tsx", ...tsxArgs], {
    stdio: "inherit",
    env: { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL || "error" },
  });
  if (r.status !== 0) {
    console.error(`\n✗ FALHOU no passo "${s.label}" (exit ${r.status}). Pipeline interrompido — investigue antes de seguir.`);
    process.exit(r.status ?? 1);
  }
  console.error("");
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.error(`✓ pronto em ${secs}s — entregue ${path.join(path.relative(process.cwd(), dir), "contact-sheet.png")} + a caption do carousel.json`);
