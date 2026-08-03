/**
 * mobileTemplate.ts — o mesmo relatório, para ser lido no celular.
 *
 * POR QUE NÃO DÁ PARA SÓ ADAPTAR O DECK. A tela tem 1280px de largura. Num celular de
 * 390pt a página inteira encolhe para 31%, e aí o nome do elemento (15px) chega em
 * 4,6pt e o `visto 1× · 1 criador` (8,5px) em 2,6pt. Nada abaixo de ~8pt se lê. Não é
 * um problema de CSS responsivo: é um problema de arranjo. Cinco colunas lado a lado
 * não cabem em 390pt por mais que se ajuste tamanho de fonte.
 *
 * A TRADUÇÃO. A linha da tabela vira um cartão vertical:
 *
 *     tabela (deck)     elemento | visto | lastro | métrica A | métrica B | quem fez
 *     cartão (celular)  elemento
 *                       ▓▓▓▓▓▓░░░ 2,8× comentários
 *                       1× · 1 criador · indício · 2,5× compartilh.
 *
 * O que se perde é a comparação visual entre linhas — no deck a coluna alinhada deixa
 * varrer 10 valores de uma vez. O que se ganha é poder ler. Para quem está no ônibus a
 * troca é óbvia; para quem está na reunião, o deck continua existindo.
 *
 * A LINGUAGEM VISUAL é a mesma: papel creme, preto, rosa de destaque, mono nos rótulos.
 * Um relatório que parece outro produto no celular não é o mesmo relatório.
 *
 * Página única, autocontida, sem rede: pode ser mandada como arquivo, hospedada, ou
 * virar o corpo de uma rota do app sem reescrever nada.
 */

import type {
  NarrativeEntry,
  RankingRow,
  RankingTable,
  ReportMetric,
  TerritorySection,
  TopVideo,
  WeeklyReportData,
} from "../../../src/app/lib/relatorio/types";
import { EVIDENCE_LABEL } from "../../../src/app/lib/relatorio/weight";
import { REPORT_METRIC_SHORT } from "../../../src/app/lib/relatorio/types";

/** Quantas linhas aparecem antes do "ver todas". */
const PREVIEW_ROWS = 6;

const METRIC_CLASS: Record<ReportMetric, string> = {
  curtidas: "c-lik",
  comentarios: "c-com",
  compartilhamentos: "c-sha",
  salvamentos: "c-sav",
  engajamento: "c-eng",
  retencao: "c-ret",
  alcance: "c-alc",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function idx(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}×`;
}

/**
 * Largura da barra. O 1,0× fica na metade, então 2,0× enche e 0,0× esvazia — a mesma
 * régua do deck, para quem lê nos dois não ter que reaprender.
 */
function barWidth(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(2, Math.min(100, (value / 2) * 100));
}

function rowCard(row: RankingRow, table: RankingTable): string {
  const main = row.metrics.find((m) => m.metric === table.sortedBy);
  const others = table.columns
    .filter((metric) => metric !== table.sortedBy)
    .map((metric) => {
      const found = row.metrics.find((m) => m.metric === metric);
      return found ? `${idx(found.index)} ${REPORT_METRIC_SHORT[metric].toLowerCase()}` : null;
    })
    .filter(Boolean);

  const meta = [
    `${row.occurrences}×`,
    row.creators === 1 ? "1 criador" : `${row.creators} criadores`,
    `<b class="ev ${row.evidence}">${esc(EVIDENCE_LABEL[row.evidence])}</b>`,
    ...others.map(esc),
  ].join(" · ");

  return (
    `<div class="card${row.pullsDown ? " low" : ""}">` +
    `<p class="cname">${esc(row.label)}</p>` +
    `<div class="cbar">` +
    `<span class="track"><span class="fill ${METRIC_CLASS[table.sortedBy]}" ` +
    `style="width:${barWidth(main?.index)}%"></span><span class="one"></span></span>` +
    `<b class="cval">${idx(main?.index)}</b>` +
    `</div>` +
    `<p class="cmeta">${meta}</p>` +
    `</div>`
  );
}

function tableSection(table: RankingTable, title: string, subtitle: string): string {
  if (table.rows.length === 0) return "";

  const head =
    `<div class="shead"><h3>${esc(title)}</h3>` +
    `<p class="ssub">${esc(subtitle)}</p>` +
    `<p class="sby">Ordenado por ${esc(REPORT_METRIC_SHORT[table.sortedBy].toLowerCase())} · ` +
    `${table.rows.length} ${table.rows.length === 1 ? "linha" : "linhas"}</p></div>`;

  const preview = table.rows.slice(0, PREVIEW_ROWS).map((row) => rowCard(row, table)).join("");
  const rest = table.rows.slice(PREVIEW_ROWS);

  // <details> em vez de JS: a página tem que abrir de um arquivo, sem servidor e sem
  // rede. Sessenta cartões abertos de uma vez também transformariam a rolagem num muro.
  const more =
    rest.length > 0
      ? `<details class="more"><summary>ver as outras ${rest.length}</summary>` +
        rest.map((row) => rowCard(row, table)).join("") +
        `</details>`
      : "";

  const reading = table.reading ? `<p class="reading">${esc(table.reading)}</p>` : "";

  return `<section class="sec">${head}${reading}${preview}${more}</section>`;
}

function videoCard(video: TopVideo, position: number): string {
  const standout = video.standout
    .map((m) => `<b>${idx(m.index)}</b> ${esc(REPORT_METRIC_SHORT[m.metric].toLowerCase())}`)
    .join(" · ");
  const meta = [
    video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : null,
    video.retention !== null ? `${Math.round(video.retention * 100)}% assistido` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    `<div class="vid">` +
    `<p class="vname"><span class="vnum">${position}</span>${esc(video.creatorName)}` +
    (video.postLink ? ` <a class="vlink" href="${esc(video.postLink)}">▶ play</a>` : "") +
    `</p>` +
    `<p class="vmet">${standout}${meta ? ` · <span class="dim">${esc(meta)}</span>` : ""}</p>` +
    (video.screenTitle
      ? `<p class="vhook"><span class="tag">na tela</span> ${esc(video.screenTitle)}</p>`
      : "") +
    (video.openingLine
      ? `<p class="vhook"><span class="tag">abertura</span> “${esc(video.openingLine)}”</p>`
      : "") +
    (video.elements.length > 0 ? `<p class="vel">${esc(video.elements.join(" · "))}</p>` : "") +
    `</div>`
  );
}

function narrativesSection(narratives: NarrativeEntry[]): string {
  if (narratives.length === 0) return "";
  return (
    `<section class="sec"><div class="shead"><h3>As narrativas daqui</h3>` +
    `<p class="ssub">Ache a sua. Não tem ordem.</p></div>` +
    `<ul class="narr">` +
    narratives
      .map(
        (n) =>
          `<li>${esc(n.label)}${n.creators > 1 ? ` <span class="dim">${n.creators} criadores</span>` : ""}</li>`,
      )
      .join("") +
    `</ul></section>`
  );
}

function blindSpot(section: TerritorySection): string {
  const { read, videos } = section.header.scene;
  if (videos === 0 || read > 0) return "";
  return (
    `<section class="sec blind"><div class="shead"><h3>Ponto cego</h3></div>` +
    `<p><b>Os ${videos} vídeos desta semana não puderam ser lidos.</b> A leitura de cena ` +
    `baixa o vídeo publicado pelo Instagram, e isso exige a conta conectada ao D2C. ` +
    `Nenhum criador que postou aqui está conectado.</p>` +
    `<p class="dim">Conectar resolve a partir da semana seguinte, sem refazer nada.</p>` +
    `</section>`
  );
}

function territoryBlock(section: TerritorySection): string {
  const h = section.header;
  const delta =
    h.engagementDeltaPct === null
      ? ""
      : `<span class="delta ${h.engagementDeltaPct >= 0 ? "up" : "down"}">` +
        `${h.engagementDeltaPct >= 0 ? "+" : ""}${h.engagementDeltaPct}%</span>`;

  const tables: [RankingTable, string, string][] = [
    [section.temas, "O que se falou", "O assunto de fato, nas palavras do vídeo."],
    [section.falas, "Frases ditas", "Copiadas do vídeo."],
    [section.assuntos, "Assuntos, agrupados", "A versão grossa do que está acima."],
    [section.assets, "Assets de vida", "O que aparece no seu vídeo e é só seu."],
    [section.objetos, "Objetos em cena", "O que estava na mão, na mesa, no fundo."],
    [section.locais, "Onde foi gravado", "O cômodo, não só “em casa”."],
    [section.enquadramentos, "Enquadramento", "Como a câmera estava posicionada."],
    [section.esteticas, "Estética", "Luz, ritmo de corte, produção."],
    [section.tons, "Tom de voz", "Como se falou."],
    [section.horarios, "Dia e horário", "Hábito do território, não regra sua."],
    [section.duracoes, "Duração", "Que tamanho de vídeo rendeu."],
  ];

  return (
    `<article class="terr" id="t-${esc(h.territoryId)}">` +
    `<header class="thead"><h2>${esc(h.label)}</h2>` +
    `<p class="tmeta">${h.creators} no mapa · ${h.creatorsWhoPosted} postaram · ` +
    `${h.narratives} narrativas ${delta}</p></header>` +
    narrativesSection(section.narratives) +
    (section.topVideos.length > 0
      ? `<section class="sec"><div class="shead"><h3>Os vídeos da semana</h3>` +
        `<p class="ssub">Os que mais engajaram — e o que tinha dentro.</p></div>` +
        section.topVideos.map((v, i) => videoCard(v, i + 1)).join("") +
        `</section>`
      : "") +
    blindSpot(section) +
    tables.map(([table, title, sub]) => tableSection(table, title, sub)).join("") +
    (section.pautas.length > 0
      ? `<section class="sec"><div class="shead"><h3>O que dá para tentar</h3></div>` +
        `<ul class="narr">` +
        section.pautas.map((p) => `<li>${esc(p.headline)}</li>`).join("") +
        `</ul></section>`
      : "") +
    `</article>`
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
:root{
  --paper:#F8F5F0; --ink:#14120F; --pink:#F0286E; --blue:#3E7FA8; --green:#3F9673;
  --gold:#C08A1E; --purple:#7B57B5; --gray:#6B6560; --gray2:#9C948B; --rule:#DCD5CA;
  --track:#E5DED3;
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-text-size-adjust:100%}
body{background:var(--paper);color:var(--ink);font-family:'Inter',system-ui,sans-serif;
  font-size:16px;line-height:1.45;padding:0 0 64px}
.wrap{max-width:640px;margin:0 auto;padding:0 18px}

/* Capa */
.cover{padding:44px 0 28px;border-bottom:2px solid var(--ink)}
.kick{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--pink);font-weight:700}
.cover h1{font-size:38px;line-height:1.02;letter-spacing:-.02em;margin:8px 0 6px;font-weight:800}
.cover .rng{color:var(--gray);font-size:14px}
.stats{display:flex;gap:26px;margin-top:22px}
.stats b{display:block;font-size:26px;line-height:1;font-weight:800}
.stats span{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--gray2)}

/* Índice fixo — sem ele, 60 cartões viram um poço sem fundo */
nav{position:sticky;top:0;z-index:9;background:var(--paper);border-bottom:1px solid var(--rule);
  padding:10px 0;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}
nav a{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;
  letter-spacing:.08em;text-transform:uppercase;color:var(--gray);text-decoration:none;
  border:1px solid var(--rule);border-radius:999px;padding:5px 11px;margin-right:7px}
nav a:first-child{margin-left:18px}

/* Como ler */
.howto{padding:26px 0;border-bottom:1px solid var(--rule)}
.howto h2{font-size:22px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px}
.howto h4{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--pink);font-weight:700;margin:18px 0 6px}
.howto p{font-size:14.5px;color:var(--gray);margin-bottom:8px}
.howto p b,.howto p strong{color:var(--ink)}

/* Território */
.terr{padding-top:30px}
.thead{border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:4px}
.thead h2{font-size:27px;font-weight:800;letter-spacing:-.02em;line-height:1.08}
.tmeta{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--gray2);margin-top:5px}
.delta{font-weight:700} .delta.up{color:var(--green)} .delta.down{color:var(--pink)}

.sec{padding:20px 0 4px;border-bottom:1px solid var(--rule)}
.shead h3{font-size:18px;font-weight:700;letter-spacing:-.01em}
.ssub{font-size:13.5px;color:var(--gray);margin-top:2px}
.sby{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--gray2);margin-top:6px}
.reading{font-size:14px;color:var(--ink);border-left:3px solid var(--pink);
  padding-left:11px;margin:12px 0 4px}

/* O cartão: a linha da tabela, de pé */
.card{padding:11px 0;border-bottom:1px solid var(--rule)}
.card:last-child{border-bottom:none}
.card.low .cname{padding-left:9px;box-shadow:inset 2px 0 0 var(--rule)}
.cname{font-size:15.5px;font-weight:600;line-height:1.3}
.cbar{display:flex;align-items:center;gap:9px;margin-top:6px}
.track{position:relative;flex:1;height:9px;background:var(--track);border-radius:1px;overflow:hidden}
.fill{position:absolute;left:0;top:0;bottom:0}
.one{position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,.28)}
.c-com{background:var(--pink)} .c-sha{background:var(--blue)} .c-sav{background:var(--green)}
.c-lik{background:var(--gold)} .c-ret{background:var(--purple)} .c-eng{background:var(--pink)}
.c-alc{background:var(--gray2)}
.cval{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;min-width:52px;
  text-align:right}
.cmeta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray);margin-top:5px;
  letter-spacing:.02em}
.ev{font-weight:700}
.ev.tendencia{color:var(--ink)} .ev.sinal{color:var(--ink);font-weight:600}
.ev.indicio{color:var(--gray);font-weight:500}

details.more{margin-top:2px}
details.more>summary{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--pink);font-weight:700;padding:13px 0;cursor:pointer;
  list-style:none;border-top:1px solid var(--rule)}
details.more>summary::-webkit-details-marker{display:none}
details.more>summary::after{content:" ▾"}
details.more[open]>summary::after{content:" ▴"}

/* Vídeos */
.vid{padding:12px 0;border-bottom:1px solid var(--rule)}
.vid:last-child{border-bottom:none}
.vname{font-size:15.5px;font-weight:700}
.vnum{font-family:'JetBrains Mono',monospace;color:var(--gray2);margin-right:8px}
.vlink{color:var(--pink);text-decoration:none;font-size:12.5px;font-weight:600;white-space:nowrap}
.vmet{font-size:13px;color:var(--gray);margin-top:3px}
.vmet b{color:var(--ink);font-family:'JetBrains Mono',monospace}
.vhook{font-size:14px;margin-top:6px;line-height:1.35}
.tag{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--gray2);border:1px solid var(--rule);padding:1px 5px;
  margin-right:6px;white-space:nowrap}
.vel{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray2);margin-top:6px}

.narr{list-style:none;margin-top:12px}
.narr li{font-size:15px;padding:7px 0 7px 11px;border-left:2px solid var(--rule);margin-bottom:6px}
.dim{color:var(--gray2);font-size:12.5px}
.blind p{font-size:14.5px;margin-top:10px}
.foot{padding:34px 0 0;font-family:'JetBrains Mono',monospace;font-size:9.5px;
  letter-spacing:.1em;text-transform:uppercase;color:var(--gray2);text-align:center}
`;

export function renderMobileHtml(report: WeeklyReportData): string {
  const cover = report.cover;
  const nav = report.territories
    .map((t) => `<a href="#t-${esc(t.header.territoryId)}">${esc(t.header.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F8F5F0">
<title>Relatório Semanal · semana ${cover.isoWeek}</title>
<style>${CSS}</style></head>
<body>
<div class="wrap">
  <header class="cover">
    <p class="kick">Relatório Semanal D2C</p>
    <h1>Semana ${cover.isoWeek}</h1>
    <p class="rng">${esc(cover.rangeLabel)}</p>
    <div class="stats">
      <div><b>${cover.creators}</b><span>criadores</span></div>
      <div><b>${cover.videos}</b><span>vídeos</span></div>
      <div><b>${report.territories.length}</b><span>territórios</span></div>
    </div>
  </header>
</div>

<nav>${nav}<a href="#como-ler">Como ler</a></nav>

<div class="wrap">
  <section class="howto" id="como-ler">
    <h2>Como ler</h2>
    <h4>O multiplicador</h4>
    <p>Todo número na forma <b>2,3×</b> compara o post típico que tem aquele elemento com o
    post típico do <b>mesmo território, na mesma semana</b>. Curtidas, comentários,
    compartilhamentos e salvamentos são sempre <b>por pessoa alcançada</b>. Retenção é contra
    o esperado para a duração. Alcance é contra o que aquele criador costuma alcançar.</p>
    <h4>Lastro</h4>
    <p>Nada foi escondido por ter acontecido pouco. <b>Indício</b> é uma ou duas vezes — pista,
    não conclusão. <b>Sinal</b> é de três a sete. <b>Tendência</b> é oito ou mais, com gente
    diferente: é onde apostar. A ordem das linhas já leva isso em conta.</p>
    <h4>De onde vem</h4>
    <p>Território, narrativa, assets e tom vêm do card <b>Seu Mapa</b>. Assunto, frase, objeto,
    cenário, enquadramento e estética são lidos do vídeo publicado. O mapa é o dicionário;
    a semana é a medição.</p>
  </section>

  ${report.territories.map(territoryBlock).join("")}

  <p class="foot">D2C · semana ${cover.isoWeek} de ${cover.isoYear}</p>
</div>
</body></html>`;
}
