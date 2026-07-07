// scripts/reuniao/produce.ts
//
// Orquestrador do Galisteu: a partir do deck.json JÁ ESCRITO pelo agente (a parte
// editorial), roda o motor inteiro em UM comando, com logs limpos (LOG_LEVEL=error).
// Espelha o produce.ts do Galeano. Colapsa "resolveDeck → renderDeck" e cada passo
// degrada com elegância; se um FALHAR de verdade, para e diz qual.
//
// Ordem: resolveDeck (context.json → fatos/thumbs/poster/gráfico) → renderDeck
//        (PNGs + reels comprimidos + .pptx).
//
// Uso:
//   npx tsx scripts/reuniao/produce.ts --dir=output/reunioes/<data>
//   npx tsx scripts/reuniao/produce.ts --deck=output/reunioes/<data>/deck.json
//   ... --render-only        (reusa reels já baixados/comprimidos; p/ ajustes de copy)
//   ... --reel-secs=30       (corte mais curto → .pptx menor)

import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}
function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

const deckArg = arg("deck");
const dirArg = arg("dir");
let deckPath: string;
let dir: string;
if (deckArg) {
  deckPath = path.resolve(deckArg);
  dir = path.dirname(deckPath);
} else if (dirArg) {
  dir = path.resolve(dirArg);
  deckPath = path.join(dir, "deck.json");
} else {
  console.error("Informe --dir=output/reunioes/<data> ou --deck=<...>/deck.json");
  process.exit(1);
}
if (!existsSync(deckPath)) {
  console.error(`✗ deck não encontrado: ${deckPath}`);
  process.exit(1);
}

const renderOnly = has("render-only");
const reelSecs = arg("reel-secs");

interface Step {
  label: string;
  script: string;
  args: string[];
  env: boolean; // precisa de --env-file=.env.local (Graph API p/ reels)
}

const steps: Step[] = [
  { label: "Hidrata deck (context.json → fatos/thumbs/poster/gráfico)", script: "resolveDeck.ts", args: [`--deck=${deckPath}`], env: false },
  {
    label: "Renderiza slides + reels + .pptx",
    script: "renderDeck.ts",
    args: [`--deck=${deckPath}`, ...(renderOnly ? ["--render-only"] : []), ...(reelSecs ? [`--reel-secs=${reelSecs}`] : [])],
    env: true,
  },
];

const scriptsDir = path.join(process.cwd(), "scripts", "reuniao");
const t0 = Date.now();
console.error(`▶ produce: ${path.relative(process.cwd(), deckPath)} (${steps.length} passos)\n`);

for (let i = 0; i < steps.length; i++) {
  const s = steps[i];
  console.error(`▸ [${i + 1}/${steps.length}] ${s.label}`);
  const tsxArgs = [s.env ? "--env-file=.env.local" : "", path.join(scriptsDir, s.script), ...s.args].filter(Boolean);
  const r = spawnSync("npx", ["tsx", ...tsxArgs], {
    stdio: "inherit",
    env: { ...process.env, LOG_LEVEL: process.env.LOG_LEVEL || "error" },
  });
  if (r.status !== 0) {
    console.error(`\n✗ FALHOU em "${s.label}" (exit ${r.status}). Pipeline interrompido — investigue antes de seguir.`);
    process.exit(r.status ?? 1);
  }
  console.error("");
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.error(`✓ pronto em ${secs}s — entregue ~/Downloads/reunioes/<data>/ (.pptx + slides)`);
