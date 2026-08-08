// scripts/relatorio/renderReport.ts
//
// Renderiza o report.json (escrito pelo agente) como PDF A4 via Playwright e:
//  1. grava o snapshot da semana em output/relatorios/<slug>/snapshots.json
//     (a "memória" que liga o comparativo da próxima semana — nunca o PDF);
//  2. copia o PDF para ~/Downloads/relatorios/<slug>/ (entrega ao usuário).
//
// Uso:
//   npx tsx scripts/relatorio/renderReport.ts --report=output/relatorios/<slug>/<ate>/report.json

import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { renderReportHtml } from "./lib/reportTemplates";
import type { ContextoSemana, ReportData, Snapshot } from "./lib/types";

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Baixa uma imagem remota para o disco e devolve um caminho file:// confiável.
 *  URLs assinadas do Instagram expiram/dão 403 no render — localizar resolve. */
async function localizar(url: string | null, destDir: string, nome: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("file://") || url.startsWith("/")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ⚠ imagem ${nome}: HTTP ${res.status} — usando fallback`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = (res.headers.get("content-type")?.includes("png") ? "png" : "jpg");
    const file = path.join(destDir, `${nome}.${ext}`);
    await fs.writeFile(file, buf);
    return pathToFileURL(file).href;
  } catch (e) {
    console.error(`  ⚠ imagem ${nome}: ${(e as Error).message} — usando fallback`);
    return null;
  }
}

/** Localiza foto de perfil + thumbs dos posts, reescrevendo o report in-place. */
async function localizarImagens(report: ReportData, weekDir: string): Promise<void> {
  const assetsDir = path.join(weekDir, ".assets");
  await fs.mkdir(assetsDir, { recursive: true });
  report.criador.profilePictureUrl = await localizar(report.criador.profilePictureUrl, assetsDir, "perfil");
  for (let i = 0; i < report.avaliacoes.length; i++) {
    const avaliacao = report.avaliacoes[i];
    if (!avaliacao) continue;
    avaliacao.thumbnailUrl = await localizar(
      avaliacao.thumbnailUrl,
      assetsDir,
      `post-${String(i + 1).padStart(2, "0")}`,
    );
  }
}

/** Deriva o snapshot persistido a partir do relatório escrito. */
function toSnapshot(r: ReportData): Snapshot {
  return {
    data: r.periodo.ate,
    narrativaCentral: r.criador.narrativaCentral,
    territoriosOcupados: r.criador.territorios,
    audienciaPede: r.audiencia.resumo,
    facaMais: r.facaMais,
    facaMenos: r.facaMenos,
    planoPrometido: r.plano.map((p) => p.titulo),
    vereditos: r.avaliacoes.map((a) => ({ postId: a.postId, veredito: a.veredito })),
  };
}

/** Portão de QA visual — abre o HTML já renderizado e mede geometria/texto real
 *  no DOM em vez de confiar que "rodou sem erro" = "está certo". Pega a classe
 *  de bug que só um `pdftoppm` manual pegava antes: caixa espremida pelo
 *  flexbox (overflow) e campo `undefined`/vazio por um valor de enum inválido
 *  no report.json. Espelha o portão de renderSlides.ts do TrendReport (que
 *  falha o processo em vez de entregar um deck quebrado). O bug do box-shadow
 *  virando retângulo cinza no PDF não é detectável assim — já foi corrigido na
 *  raiz removendo sombra difusa do CSS. */
async function runVisualQA(page: import("playwright").Page): Promise<string[]> {
  return page.$$eval(
    // Overflow: só nos CONTÊINERES desenhados com altura/overflow explícitos
    // (.numeros/.num-cell têm height:96px+overflow:hidden de propósito — ver
    // reportTemplates.ts). Texto solto como .num-valor não tem clientHeight
    // próprio e sempre "estoura" por 1-4px de métrica de fonte — checar nele
    // dava falso positivo.
    ".num-cell, .post-card, .plano-card, .faca, .recap, .pt-block",
    (els) =>
      els
        .filter((el) => el.scrollHeight > el.clientHeight + 1)
        .map(
          (el) =>
            `overflow: .${el.className.toString().split(" ")[0]} (scrollHeight=${el.scrollHeight} > clientHeight=${el.clientHeight}) — "${(el.textContent ?? "").trim().slice(0, 60)}"`,
        ),
  ).then(async (overflow) => {
    const texto = await page.$$eval(
      ".pc-veredito, .plano-mira, .num-valor, .num-label, .pt-label, .pt-idx, .gk-txt",
      (els) =>
        els
          .filter((el) => {
            const t = (el.textContent ?? "").trim();
            return /(undefined|NaN)/.test(t) || t === "";
          })
          .map(
            (el) =>
              `texto inválido: .${el.className.toString().split(" ")[0]} = "${(el.textContent ?? "").trim()}"`,
          ),
    );
    return [...overflow, ...texto];
  });
}

/** Insere/atualiza o snapshot da semana (idempotente por data). */
async function upsertSnapshot(slugDir: string, snap: Snapshot): Promise<string> {
  const file = path.join(slugDir, "snapshots.json");
  let all: Snapshot[] = [];
  try {
    all = JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    /* primeiro snapshot */
  }
  all = all.filter((s) => s.data !== snap.data);
  all.push(snap);
  all.sort((a, b) => (a.data < b.data ? -1 : 1));
  await fs.mkdir(slugDir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(all, null, 2));
  return file;
}

async function main() {
  const reportPath = arg("report");
  if (!reportPath) {
    console.error("Informe --report=caminho/para/report.json");
    process.exit(1);
  }
  const reportAbs = path.resolve(reportPath);
  const report: ReportData = JSON.parse(await fs.readFile(reportAbs, "utf-8"));
  const weekDir = path.dirname(reportAbs); // output/relatorios/<slug>/<ate>
  const slugDir = path.dirname(weekDir); // output/relatorios/<slug>
  const slug = path.basename(slugDir);

  // As TABELAS de padrão vêm calculadas do context.json (patterns.ts) e são
  // mescladas aqui — nunca passam pelo report.json escrito pelo LLM. Assim o
  // número não corre risco de transcrição; o report.json carrega só a leitura
  // interpretativa (`padroesLeitura`). Sem context.json (ou sem `padroes`), o
  // relatório sai como antes, com 3 atos.
  let padroes: ContextoSemana["padroes"];
  try {
    const ctx: ContextoSemana = JSON.parse(
      await fs.readFile(path.join(weekDir, "context.json"), "utf-8"),
    );
    padroes = ctx.padroes;
  } catch {
    console.error("  ⚠ context.json não encontrado — relatório sem o ato de padrões");
  }

  // 1. Localiza imagens (perfil + thumbs) e gera HTML → PDF
  await localizarImagens(report, weekDir);
  const html = renderReportHtml(report, padroes);
  const htmlFile = path.join(weekDir, ".report.html");
  await fs.writeFile(htmlFile, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    // @ts-ignore
    if (document.fonts?.ready) await document.fonts.ready;
  });
  const pdfFile = path.join(weekDir, "relatorio.pdf");
  await page.pdf({
    path: pdfFile,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });
  // Capa em PNG para preview rápido (contact-sheet do relatório).
  const pngFile = path.join(weekDir, "relatorio-capa.png");
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.screenshot({ path: pngFile, clip: { x: 0, y: 0, width: 794, height: 1123 } });

  // QA visual — mede o DOM real antes de entregar. Nunca copiar pro Downloads
  // nem gravar snapshot se algo estiver visivelmente quebrado.
  const problemas = await runVisualQA(page);

  await browser.close();
  await fs.rm(htmlFile, { force: true });

  if (problemas.length > 0) {
    console.error(`✗ QA visual reprovou (${problemas.length} problema(s)) — relatório NÃO entregue:`);
    for (const p of problemas) console.error(`  · ${p}`);
    console.error(`  (PDF ficou em ${pdfFile} para inspeção; corrija o report.json e rode de novo)`);
    process.exit(1);
  }
  console.error(`✓ QA visual ok`);
  console.error(`✓ PDF: ${pdfFile}`);
  console.error(`✓ capa: ${pngFile}`);

  // 2. snapshot (a memória do comparativo)
  const snapFile = await upsertSnapshot(slugDir, toSnapshot(report));
  console.error(`✓ snapshot: ${snapFile}`);

  // 3. entrega no Downloads
  const home = process.env.HOME ?? `/Users/${process.env.USER}`;
  const dlDir = path.join(home, "Downloads", "relatorios", slug);
  await fs.mkdir(dlDir, { recursive: true });
  const dlPdf = path.join(dlDir, `relatorio-${report.periodo.ate}.pdf`);
  await fs.copyFile(pdfFile, dlPdf);
  console.error(`✓ entregue em: ${dlPdf}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
