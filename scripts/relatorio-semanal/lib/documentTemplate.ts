/**
 * documentTemplate.ts — o Relatório Semanal como DOCUMENTO, não como deck.
 *
 * POR QUE ISTO EXISTE, e é a mesma razão pela qual `slideTemplates.ts` deixou de ser
 * a entrega principal: o slide tem 720px de altura fixa, e altura fixa obriga a cortar.
 * Com corte, uma tabela mostra 5 linhas, e um relatório de 5 linhas por tabela é quase
 * igual toda semana — o que é frequente é estável, e o que muda de uma semana para a
 * outra é justamente o detalhe que não cabia.
 *
 * O relatório é lido em casa, não projetado. Então a tabela corre inteira, a página
 * quebra sozinha e o volume deixa de ser um problema para virar o produto. A reunião
 * comenta o documento; não passa por ele.
 *
 * DUAS REGRAS DE COMPOSIÇÃO, e as duas vêm de erros já cometidos aqui:
 *
 *   • Todo número tem a unidade dita em português por perto. "2,3×" sozinho esconde
 *     três réguas diferentes (por pessoa alcançada, contra o esperado da duração,
 *     contra o próprio criador). Ver describeFinding.ts.
 *   • Toda linha carrega quantas vezes aconteceu e o nome do lastro que isso dá:
 *     indício, sinal ou tendência. É o que substituiu o corte — nada é escondido, mas
 *     nada se disfarça de mais do que é. Ver weight.ts.
 */

import type {
  RankingRow,
  RankingTable,
  ReportMetric,
  TerritorySection,
  TopVideo,
  WeeklyReportData,
} from "../../../src/app/lib/relatorio/types";
import { EVIDENCE_LABEL } from "../../../src/app/lib/relatorio/weight";

const METRIC_LABEL: Record<ReportMetric, string> = {
  curtidas: "curtidas",
  comentarios: "comentários",
  compartilhamentos: "compartilh.",
  salvamentos: "salvamentos",
  engajamento: "engajamento",
  retencao: "retenção",
  alcance: "alcance",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function multiplier(index: number): string {
  return `${index.toFixed(1).replace(".", ",")}×`;
}

/**
 * A classe de cor da célula. Três estados, não um gradiente: acima, na régua, abaixo.
 * A faixa morta de 0,9–1,1 é a mesma de describeFinding — se as duas divergissem, o
 * texto diria "não há o que dizer" ao lado de uma célula pintada.
 */
function toneOf(index: number): string {
  if (index >= 1.1) return "up";
  if (index <= 0.9) return "down";
  return "flat";
}

function rowHtml(row: RankingRow, columns: ReportMetric[]): string {
  const cells = columns
    .map((metric) => {
      const found = row.metrics.find((m) => m.metric === metric);
      if (!found) return `<td class="num empty">—</td>`;
      return `<td class="num ${toneOf(found.index)}">${multiplier(found.index)}</td>`;
    })
    .join("");

  const creators = row.creators === 1 ? "1 criador" : `${row.creators} criadores`;
  return `<tr>
    <td class="label">${escapeHtml(row.label)}</td>
    <td class="seen">${row.occurrences}× · ${creators}</td>
    <td class="evidence ${row.evidence}">${EVIDENCE_LABEL[row.evidence]}</td>
    ${cells}
  </tr>`;
}

function tableHtml(table: RankingTable): string {
  if (table.rows.length === 0) {
    return `<section class="table empty-table">
      <h3>${escapeHtml(table.title)}</h3>
      <p class="nothing">Nada foi lido nesta dimensão nesta semana.</p>
    </section>`;
  }

  const head = table.columns.map((metric) => `<th class="num">${METRIC_LABEL[metric]}</th>`).join("");
  // As duas metades do 1,0×: o que puxa para cima e o que puxa para baixo. Não é
  // "incluído e excluído" — nada é excluído. São as duas direções da mesma régua.
  const up = table.rows.filter((row) => !row.pullsDown);
  const down = table.rows.filter((row) => row.pullsDown);

  const body = [
    ...up.map((row) => rowHtml(row, table.columns)),
    down.length
      ? `<tr class="divider"><td colspan="${3 + table.columns.length}">abaixo da régua do território</td></tr>`
      : "",
    ...down.map((row) => rowHtml(row, table.columns)),
  ].join("");

  return `<section class="table">
    <h3>${escapeHtml(table.title)} <span class="sorted">ordenado por ${METRIC_LABEL[table.sortedBy]}</span></h3>
    ${table.reading ? `<p class="reading">${escapeHtml(table.reading)}</p>` : ""}
    <table>
      <thead><tr><th>elemento</th><th>na semana</th><th>lastro</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    <p class="note">${escapeHtml(table.cutoffNote)}</p>
  </section>`;
}

function topVideoHtml(video: TopVideo, position: number): string {
  const numbers = video.standout
    .map((m) => `<b>${multiplier(m.index)}</b> ${METRIC_LABEL[m.metric]}`)
    .join(" · ");
  const retention =
    video.retention !== null ? ` · ${Math.round(video.retention * 100)}% assistido` : "";
  const duration = video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : "—";

  return `<article class="video">
    <div class="pos">${position}</div>
    <div class="body">
      <div class="who">
        ${escapeHtml(video.creatorName)}
        ${video.creatorHandle ? `<span class="handle">@${escapeHtml(video.creatorHandle)}</span>` : ""}
        ${video.postLink ? `<a class="play" href="${escapeHtml(video.postLink)}">▶ dar play</a>` : ""}
      </div>
      <div class="numbers">${numbers}<span class="meta">${duration}${retention}</span></div>
      ${
        video.screenTitle
          ? `<p class="hook"><span class="tag">na tela</span> ${escapeHtml(video.screenTitle)}</p>`
          : ""
      }
      ${
        video.openingLine
          ? `<p class="hook"><span class="tag">abertura</span> “${escapeHtml(video.openingLine)}”</p>`
          : ""
      }
      ${video.elements.length ? `<p class="elements">${video.elements.map(escapeHtml).join(" · ")}</p>` : ""}
    </div>
  </article>`;
}

function territoryHtml(territory: TerritorySection): string {
  const h = territory.header;
  const delta =
    h.engagementDeltaPct === null
      ? ""
      : `<span class="delta ${h.engagementDeltaPct >= 0 ? "up" : "down"}">engajamento ${
          h.engagementDeltaPct >= 0 ? "+" : ""
        }${h.engagementDeltaPct}%</span>`;

  // A ordem das tabelas é a ordem da conversa: primeiro o que se disse, depois o que
  // se mostrou, depois como se gravou, e só no fim quando se postou. O calendário é a
  // pergunta menos interessante e sempre foi tratado como se fosse a primeira.
  const tables = [
    territory.temas,
    territory.falas,
    territory.assets,
    territory.objetos,
    territory.locais,
    territory.enquadramentos,
    territory.esteticas,
    territory.assuntos,
    territory.tons,
    territory.horarios,
    territory.duracoes,
  ];

  return `<section class="territory">
    <header class="territory-head">
      <h2>${escapeHtml(h.label)}</h2>
      <p class="sub">
        ${h.creators} criadores no mapa · ${h.creatorsWhoPosted} postaram nesta semana ·
        ${h.narratives} narrativas ${delta}
      </p>
    </header>

    ${
      territory.narratives.length
        ? `<section class="narratives">
             <h3>As narrativas deste território</h3>
             <ul>${territory.narratives
               .map(
                 (n) =>
                   `<li>${escapeHtml(n.label)}${n.creators > 1 ? ` <span class="n">${n.creators} criadores</span>` : ""}</li>`,
               )
               .join("")}</ul>
           </section>`
        : ""
    }

    ${
      territory.topVideos.length
        ? `<section class="videos">
             <h3>Os vídeos da semana</h3>
             ${territory.topVideos.map((video, i) => topVideoHtml(video, i + 1)).join("")}
           </section>`
        : ""
    }

    ${tables.map(tableHtml).join("")}

    ${
      territory.pautas.length
        ? `<section class="pautas">
             <h3>O que dá para tentar</h3>
             <ul>${territory.pautas.map((p) => `<li>${escapeHtml(p.headline)} <span class="n">${escapeHtml(p.narrative)}</span></li>`).join("")}</ul>
           </section>`
        : ""
    }
  </section>`;
}

/** A página que ensina a ler o resto. Sem ela, "2,3×" é um símbolo sem régua. */
function howToReadHtml(): string {
  return `<section class="howto">
    <h2>Como ler este relatório</h2>

    <h3>O multiplicador</h3>
    <p>
      Todo número desta forma — <b>2,3×</b> — compara o post <i>típico</i> que tem aquele
      elemento com o post <i>típico</i> do mesmo território, na mesma semana. Não é com
      outros territórios, e não é com a internet: é com os vizinhos de recorte.
      <b>2,3×</b> em Maternidade significa "recebeu 2,3 vezes mais do que o post comum de
      Maternidade naquela semana".
    </p>
    <p>
      A unidade muda conforme a coluna, e por isso cada tabela traz uma frase escrita por
      extenso. Curtidas, comentários, compartilhamentos e salvamentos são sempre
      <b>por pessoa alcançada</b> — quem alcança mais gente não ganha vantagem. Retenção
      é contra o <b>esperado para a duração</b> daquele vídeo. Alcance é contra o que
      <b>aquele criador</b> costuma alcançar.
    </p>

    <h3>Lastro: indício, sinal, tendência</h3>
    <p>
      Nada aqui foi escondido por ter acontecido pouco. Um objeto que apareceu em um
      único vídeo está na tabela, com o número dele. O que muda é o <b>lastro</b>:
    </p>
    <ul>
      <li><b>indício</b> — aconteceu uma ou duas vezes. É uma pista, não uma conclusão.</li>
      <li><b>sinal</b> — de três a sete vezes. Já merece atenção.</li>
      <li><b>tendência</b> — oito vezes ou mais, com gente diferente. É onde apostar.</li>
    </ul>
    <p>
      A ordem das linhas já leva o lastro em conta: um <b>3,0×</b> visto uma vez fica
      abaixo de um <b>2,2×</b> visto quatro vezes, porque o segundo se repetiu. E posts
      da mesma pessoa não somam indefinidamente — uma pessoa sozinha nunca vira
      tendência de um território.
    </p>

    <h3>De onde vem cada coisa</h3>
    <p>
      Território, narrativa, assets de vida e tom vêm do card <b>Seu Mapa</b> de cada
      criador — é a declaração dele, e muda devagar. Assunto, frase, objeto, cenário,
      enquadramento e estética são lidos do <b>vídeo publicado</b> da semana. O mapa é o
      dicionário; a semana é a medição.
    </p>
    <p class="caveat">
      Dia e horário aparecem porque a diferença é mensurável, mas não são verdade
      absoluta: a melhor hora é a hora em que <i>a sua</i> audiência está acordada, e isso
      é pessoal. Trate como ponto de partida, não como regra.
    </p>
  </section>`;
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  :root {
    --ink: #14110f;
    --muted: #6b625c;
    --line: #e4dfd9;
    --up: #1d6b47;
    --down: #a03828;
    --accent: #b4532a;
    --paper: #fdfcfa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--paper); color: var(--ink);
    font-family: "Charter", "Georgia", serif; font-size: 10.5pt; line-height: 1.5;
  }
  h1, h2, h3 { font-weight: 600; letter-spacing: -0.01em; }
  a { color: var(--accent); text-decoration: none; }

  .cover { height: 240mm; display: flex; flex-direction: column; justify-content: center; }
  .cover .kicker { font-size: 11pt; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
  .cover h1 { font-size: 40pt; line-height: 1.05; margin: 12px 0 18px; }
  .cover .window { font-size: 13pt; color: var(--muted); }
  .cover .stats { margin-top: 40px; display: flex; gap: 36px; border-top: 1.5px solid var(--ink); padding-top: 18px; }
  .cover .stats div b { display: block; font-size: 26pt; line-height: 1; }
  .cover .stats div span { font-size: 9pt; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }

  .howto { break-before: page; }
  .howto h2 { font-size: 20pt; margin: 0 0 14px; }
  .howto h3 { font-size: 12pt; margin: 22px 0 6px; color: var(--accent); }
  .howto ul { margin: 8px 0; padding-left: 18px; }
  .howto .caveat { color: var(--muted); font-size: 9.5pt; border-left: 2px solid var(--line); padding-left: 10px; }

  .territory { break-before: page; }
  .territory-head { border-bottom: 2px solid var(--ink); padding-bottom: 8px; margin-bottom: 16px; }
  .territory-head h2 { font-size: 24pt; margin: 0; }
  .territory-head .sub { margin: 4px 0 0; font-size: 9.5pt; color: var(--muted); }
  .delta { margin-left: 8px; font-weight: 600; }
  .delta.up { color: var(--up); } .delta.down { color: var(--down); }

  .narratives ul { list-style: none; padding: 0; margin: 0 0 18px; }
  .narratives li { padding: 4px 0 4px 12px; border-left: 2px solid var(--line); margin-bottom: 4px; }
  .narratives .n { color: var(--muted); font-size: 9pt; }

  h3 { font-size: 12pt; margin: 20px 0 8px; }
  .sorted { font-weight: 400; font-size: 9pt; color: var(--muted); }

  .videos { margin-bottom: 20px; }
  .video { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); break-inside: avoid; }
  .video .pos { font-size: 18pt; color: var(--line); font-weight: 700; min-width: 26px; }
  .video .who { font-weight: 600; }
  .video .handle { color: var(--muted); font-weight: 400; margin-left: 6px; }
  .video .play { margin-left: 10px; font-size: 9pt; }
  .video .numbers { font-size: 9.5pt; color: var(--muted); margin-top: 2px; }
  .video .numbers b { color: var(--ink); }
  .video .meta { margin-left: 10px; }
  .video .hook { margin: 5px 0 0; font-size: 10pt; }
  .video .tag {
    font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--muted); border: 1px solid var(--line); padding: 1px 5px; margin-right: 6px;
  }
  .video .elements { margin: 5px 0 0; font-size: 9pt; color: var(--muted); }

  .table { margin-bottom: 22px; break-inside: auto; }
  .table .reading { margin: 0 0 8px; font-size: 10pt; color: var(--ink); font-style: italic; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  thead th {
    text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--muted); font-weight: 500; border-bottom: 1.5px solid var(--ink); padding: 4px 6px;
  }
  tbody td { padding: 4px 6px; border-bottom: 1px solid var(--line); vertical-align: top; }
  tbody tr { break-inside: avoid; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num.up { color: var(--up); font-weight: 600; }
  td.num.down { color: var(--down); }
  td.num.empty { color: var(--line); }
  td.seen { color: var(--muted); white-space: nowrap; font-size: 9pt; }
  td.evidence { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); white-space: nowrap; }
  td.evidence.tendencia { color: var(--ink); font-weight: 600; }
  tr.divider td {
    font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted);
    border-bottom: none; padding-top: 10px;
  }
  .table .note { margin: 6px 0 0; font-size: 8.5pt; color: var(--muted); }
  .empty-table .nothing { font-size: 9.5pt; color: var(--muted); font-style: italic; }

  .pautas ul { padding-left: 18px; }
  .pautas li { margin-bottom: 4px; }
`;

export function renderDocumentHtml(report: WeeklyReportData): string {
  const cover = report.cover;
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório Semanal · semana ${cover.isoWeek}</title>
<style>${CSS}</style></head>
<body>
  <section class="cover">
    <div class="kicker">Relatório Semanal D2C</div>
    <h1>Semana ${cover.isoWeek} · ${cover.isoYear}</h1>
    <div class="window">${escapeHtml(cover.rangeLabel)}</div>
    <div class="stats">
      <div><b>${cover.creators}</b><span>criadores</span></div>
      <div><b>${cover.videos}</b><span>vídeos</span></div>
      <div><b>${report.territories.length}</b><span>territórios</span></div>
    </div>
  </section>

  ${howToReadHtml()}
  ${report.territories.map(territoryHtml).join("")}
</body></html>`;
}
