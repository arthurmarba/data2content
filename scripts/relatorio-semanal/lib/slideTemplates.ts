// scripts/relatorio-semanal/lib/slideTemplates.ts
//
// Os 21 slides do Relatório Semanal em HTML 1280×720, fiéis ao mock v7:
// mesma paleta, tipografia da marca (Bricolage Grotesque + Instrument Sans + mono),
// e os sete padrões do §6 —
// risca do 1,0× dentro de cada mini-barra, coluna de movimento, risca preta de corte,
// coluna "cabe em", ocorrências na linha, ordenação declarada no canto, escala igual.
//
// Sem dependência externa além das fontes do Google (renderSlides aguarda
// document.fonts.ready). Nenhum cálculo aqui: só leitura do WeeklyReportData.

import type {
  DurationBar,
  ElementKind,
  Highlight,
  RankingRow,
  RankingTable as RankingTableType,
  TerritorySection,
  MatrixRow,
  Movement,
  NarrativeEntry,
  RankingTable,
  ReportMetric,
  TerritoryGap,
  TerritoryHeader,
  TimeGrid,
  TopVideo,
  WeeklyReportData,
} from "../../../src/app/lib/relatorio/types";
import { REPORT_METRIC_LABELS, REPORT_METRIC_SHORT } from "../../../src/app/lib/relatorio/types";
import { compareRankingRows } from "../../../src/app/lib/relatorio/rankingEngine";
import {
  EVIDENCE_LABEL,
} from "../../../src/app/lib/relatorio/weight";

export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

/** Escala compartilhada pelos quatro territórios (padrão 7). 3,0× enche a barra. */
const BAR_FULL_INDEX = 3;

const METRIC_CLASS: Record<ReportMetric, string> = {
  curtidas: "c-lik",
  comentarios: "c-com",
  compartilhamentos: "c-sha",
  salvamentos: "c-sav",
  retencao: "c-ret",
  alcance: "c-alc",
  engajamento: "c-com",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── Helpers de formatação ───────────────────────────────────────────────────

/** "1 criador", "3 criadores". Sem isto, toda linha de uma pessoa diz "1 criadores". */
function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2,7×" — vírgula decimal, como o mock. */
function idx(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}×`;
}

/** Retenção de um vídeo: fração 0–1 em porcentagem inteira. */
function retentionPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function deltaClass(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "delta-neutral";
  return value > 0 ? "delta-up" : "delta-down";
}

/** Largura da barra: 1,0× cai exatamente sobre a risca em 1/BAR_FULL_INDEX. */
function barWidth(value: number | null | undefined): number {
  if (value === null || value === undefined || value <= 0) return 0;
  return Math.min(100, (value / BAR_FULL_INDEX) * 100);
}

function movementCell(movement: Movement | null): string {
  if (!movement) return `<span class="mv e">·</span>`;
  if (movement.kind === "new") return `<span class="mv n">novo</span>`;
  if (movement.kind === "stable") return `<span class="mv e">—</span>`;
  const arrow = movement.kind === "up" ? "▲" : "▼";
  return `<span class="mv ${movement.kind === "up" ? "u" : "d"}">${arrow} ${movement.delta}</span>`;
}

function metricBar(metric: ReportMetric, value: number | null | undefined, narrow = false): string {
  return (
    `<span class="mb${narrow ? " nb" : ""}">` +
    `<i class="${METRIC_CLASS[metric]}" style="width:${barWidth(value).toFixed(1)}%"></i>` +
    `</span><span class="mv-val">${idx(value)}</span>`
  );
}

/** A mesma régua das tabelas, em largura editorial para slides-resumo e leituras. */
function wideMetricBar(metric: ReportMetric, value: number | null | undefined): string {
  return (
    `<span class="signalbar"><i class="${METRIC_CLASS[metric]}" ` +
    `style="width:${barWidth(value).toFixed(1)}%"></i></span>`
  );
}

function compactViews(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")} mil`;
  return Math.round(value).toLocaleString("pt-BR");
}

function viewsBar(value: number | null | undefined, max: number): string {
  const width = value !== null && value !== undefined && value > 0 && max > 0
    ? Math.max(2, Math.min(100, (value / max) * 100))
    : 0;
  return `<span class="viewbar"><i style="width:${width.toFixed(1)}%"></i></span>` +
    `<span class="view-val">${esc(compactViews(value))}</span>`;
}

function metricBasis(metric: ReportMetric): string {
  if (metric === "retencao") return "tempo assistido em relação ao esperado";
  if (metric === "alcance") return "alcance em relação à própria base";
  return `${REPORT_METRIC_LABELS[metric].toLowerCase()} por pessoa alcançada`;
}

/**
 * Corta a frase numa palavra inteira. As narrativas são frases longas ("Celebrar a vida
 * nordestina com leveza, humor e a alegria da maternidade") e no pé do slide 06 elas
 * transbordavam por cima do rodapé — o slide tem altura fixa. A frase inteira está na
 * tela 03; aqui ela só identifica de quem é a pauta.
 */
function shorten(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const cut = value.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function sortedByLabel(metric: ReportMetric): string {
  return `Ordenado por ${REPORT_METRIC_LABELS[metric].toLowerCase()}`;
}

function rankedByForceLabel(metric: ReportMetric): string {
  return `Ordenado por força em ${REPORT_METRIC_LABELS[metric].toLowerCase()}`;
}

function slide(
  inner: string,
  options: { dark?: boolean; foot: [string, string]; className?: string },
): string {
  return (
    `<div class="slide${options.dark ? " dark" : ""}${options.className ? ` ${esc(options.className)}` : ""}">` +
    `<div class="body">${inner}</div>` +
    `<div class="foot"><div>${esc(options.foot[0])}</div><div>${esc(options.foot[1])}</div></div>` +
    `</div>`
  );
}

function territoryHead(header: TerritoryHeader): string {
  return (
    `<div class="thead territory-eyebrow"><div class="nm">${esc(header.label)}</div>` +
    `<div class="meta">${plural(header.creators, "criador", "criadores")} · ` +
    `${plural(header.narratives, "narrativa", "narrativas")} · ` +
    `engajamento <b>${pct(header.engagementDeltaPct)}</b> na semana</div></div>`
  );
}

function emptyNote(reason: string): string {
  return `<div class="empty"><p>Sem dado suficiente nesta semana</p><span>${esc(reason)}</span></div>`;
}

// ─── Tabela de ranking (os sete padrões) ─────────────────────────────────────

const COLUMN_LABEL: Partial<Record<ElementKind, string>> = {
  asset: "Asset",
  assunto: "Assunto",
  tom: "Tom e formato",
  formato: "Formato",
  horario: "Dia e horário",
  duracao: "Faixa",
  territorio: "Território",
  tema: "Assunto específico",
  objeto: "Objeto",
  fala: "O que foi dito",
  local: "Lugar",
  enquadramento: "Enquadramento",
  estetica: "Traço",
};

/**
 * Quantas linhas de tabela cabem numa tela de largura inteira.
 *
 * O número é a única concessão que o formato de slide impõe — e a resposta a ela não é
 * mais cortar a tabela, é continuar na tela seguinte. Antes o teto era 5 linhas e o
 * resto sumia; era isso que fazia o relatório ser quase igual toda semana, porque o
 * que sobrava era só o mais frequente, que é o mais estável.
 */
const ROWS_PER_SLIDE = 7;

/**
 * DENSIDADE: o corpo do texto muda conforme quanto conteúdo a tela tem.
 *
 * Toda tela usava o mesmo tamanho, independentemente de ter 3 linhas ou 30. O resultado
 * media 43% de altura usada nas telas curtas — papel em branco onde cabia texto legível.
 * Um território pequeno passava a impressão de território pobre, quando ele só tem menos
 * linhas.
 *
 * A tabela de 4 linhas agora ocupa a tela com corpo grande em vez de ocupar um terço com
 * corpo pequeno. Mesma informação, muito mais fácil de ler — inclusive projetada.
 */
function densidadeDe(linhas: number): "compacta" | "normal" | "ampla" {
  if (linhas >= 9) return "compacta";
  if (linhas >= 5) return "normal";
  return "ampla";
}

/** As dimensões cujo vocabulário vem do vídeo, não do mapa. */
const OPEN_KINDS: ReadonlySet<string> = new Set([
  "tema", "objeto", "fala", "local", "enquadramento", "estetica",
]);

/**
 * Quebra em páginas SEM deixar sobra ridícula na última.
 *
 * `chunk` cru produzia "Assuntos · 2 de 2" com UMA linha numa tela inteira: seis linhas
 * de ranking viravam 5+1. Quando a última página fica com menos de um terço do tamanho,
 * o número de páginas é o mesmo mas a divisão é equilibrada — 6 vira 3+3, não 5+1.
 */
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const pages = Math.ceil(items.length / size);
  if (pages <= 1) return [items.slice()];
  const balanced = Math.ceil(items.length / pages);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += balanced) out.push(items.slice(i, i + balanced));
  return out;
}

function rankingTable(
  table: RankingTable,
  options: {
    fitsLabel?: string;
    fitsMode?: "ratio" | "creators";
    showFits?: boolean;
    showViews?: boolean;
    viewsMax?: number;
    narrow?: boolean;
    densidade?: "compacta" | "normal" | "ampla";
    positionStart?: number;
  } = {},
): string {
  if (table.rows.length === 0) {
    return emptyNote(table.cutoffNote);
  }
  const {
    fitsLabel = "Cabe em",
    fitsMode = "ratio",
    showFits = true,
    showViews = false,
    viewsMax = 0,
    narrow = false,
  } = options;
  // Nome da COLUNA, não o título da tabela — repetir o título no `th` deixava
  // "Assuntos / ASSUNTOS" empilhado no slide.
  const head =
    `<tr>${narrow ? "" : `<th style="width:34px"></th>`}` +
    `<th>${esc(COLUMN_LABEL[table.kind] ?? "Elemento")}</th><th style="width:44px">Mov.</th>` +
    table.columns.map((metric) => `<th>${esc(REPORT_METRIC_SHORT[metric])}</th>`).join("") +
    (showViews
      ? `<th style="width:178px;text-align:right">Visualizações/post</th>`
      : showFits
      ? `<th style="width:${fitsMode === "creators" ? 150 : 70}px;text-align:right">${esc(fitsLabel)}</th>`
      : "") +
    `</tr>`;

  const rows: string[] = [];
  let cutDrawn = false;
  // Contador PRÓPRIO: `rows.length` inclui a linha divisória do 1,0×, e por causa dela
  // a numeração pulava do 3 para o 5.
  let posicao = options.positionStart ?? 0;
  for (const row of table.rows) {
    if (row.pullsDown && !cutDrawn) {
      cutDrawn = true;
      rows.push(
        `<tr class="cut"><td colspan="${table.columns.length + (narrow ? 2 : 3) + (showFits || showViews ? 1 : 0)}">` +
          `<div class="cutlabel"><span>Abaixo da régua nesta semana</span>` +
          `<b>menos de 1,0× na métrica que ordena a lista</b></div></td></tr>`,
      );
    }
    const metrics = table.columns
      .map((metric) => {
        const found = row.metrics.find((m) => m.metric === metric);
        return `<td>${metricBar(metric, found?.index ?? null, narrow)}</td>`;
      })
      .join("");
    const adoptionMeta = !showFits && row.fitsOutOf > 0
      ? table.kind === "asset"
        ? ` · no mapa de ${row.fitsCount}/${row.fitsOutOf}`
        : OPEN_KINDS.has(table.kind)
          ? ` · ${row.fitsCount} de ${row.fitsOutOf} criadores em 90 dias`
          : ""
      : row.occurrencesInWindow > row.occurrences
        ? ` · ${row.occurrencesInWindow}× em 90 dias`
        : "";
    rows.push(
      `<tr class="${row.pullsDown ? "low" : ""}">` +
        // A posição à esquerda dá a leitura de tópico: 1, 2, 3. Sem ela a tabela é uma
        // lista de nomes com números do lado direito, e a ordem não se lê.
        (narrow ? "" : `<td class="pos">${(posicao += 1)}</td>`) +
        `<td><div class="it">${esc(row.label)}</div>` +
        `<span class="occ">visto ${row.occurrences}× · ${plural(row.creators, "criador", "criadores")}` +
        adoptionMeta +
        ` · <b class="ev ${row.evidence}">${esc(EVIDENCE_LABEL[row.evidence])}</b></span></td>` +
        `<td>${movementCell(row.movement)}</td>${metrics}` +
        (showViews
          ? `<td class="views-cell">${viewsBar(row.medianViews, viewsMax)}</td>`
          : showFits
          ? fitsMode === "creators"
            ? `<td class="fit fit-creators">${row.fitsCount}<span class="fout"> de ${row.fitsOutOf} criadores</span></td>`
            : `<td class="fit">${row.fitsCount}<span class="fout">/${row.fitsOutOf}</span></td>`
          : "") +
        `</tr>`,
    );
  }

  const densidade = options.densidade ?? densidadeDe(table.rows.length);
  return `<table class="rk d-${densidade}">${head}${rows.join("")}</table>`;
}

/**
 * Fecha a tabela com uma leitura curta. A régua e a comparação já estão nas linhas;
 * repeti-las aqui deixava a página mais pesada sem acrescentar informação.
 */
function rankingReadingBlock(table: RankingTableType, territoryLabel: string): string {
  if (!table.reading) return "";
  const first = table.rows[0];
  if (!first) return `<p class="reading">${esc(table.reading)}</p>`;
  const metric = table.sortedBy;
  const value = first.metrics.find((entry) => entry.metric === metric)?.index ?? null;
  return (
    `<div class="ranking-reading" aria-label="Leitura da primeira linha">` +
    `<p class="rr-kicker">Sinal mais forte</p>` +
    `<p class="rr-line"><b>${esc(first.label)}</b>` +
    `<span>${idx(value)} versus o post típico · ${esc(metricBasis(metric))} · ${esc(territoryLabel)}</span></p>` +
    `</div>`
  );
}

/**
 * Reordena uma dimensão aberta pela ressonância em engajamento, usando exatamente a
 * mesma força bayesiana do motor. O índice exibido continua sendo o valor verdadeiro;
 * a força só decide a ordem e impede um viral solitário de parecer tendência coletiva.
 *
 * Assuntos específicos, falas e objetos vêm da leitura de cena e podem aparecer uma
 * única vez sem deixar de ser evidência útil. Por isso todos entram na tabela: peso
 * define a posição, não a visibilidade.
 */
function engagementResonanceTable(table: RankingTableType): RankingTableType {
  const engagementIndex = (row: RankingRow): number | null =>
    row.metrics.find((entry) => entry.metric === "engajamento")?.index ?? null;
  const columns: ReportMetric[] = ["engajamento", "comentarios", "compartilhamentos"];
  const rows = table.rows
    .map((row) => ({ ...row, pullsDown: (engagementIndex(row) ?? 1) < 1 }))
    .sort((a, b) => compareRankingRows(a, b, "engajamento", columns));
  return {
    ...table,
    sortedBy: "engajamento",
    columns,
    rows,
    reading: null,
  };
}

/**
 * A leitura da tabela em português, mais o que "cabe em" conta.
 *
 * A frase vem do dado (RankingTable.reading) e diz o multiplicador por extenso — é o
 * que dispensa aprender o que "2,2×" compara, porque a unidade muda por métrica e a
 * régua muda por tela.
 */
function tableLegend(table: RankingTableType, territoryLabel: string): string {
  const parts: string[] = [];
  if (table.reading) parts.push(`<p class="reading">${esc(table.reading)}</p>`);
  // O exemplo do "cabe em" usa os números REAIS da primeira linha — um exemplo
  // inventado (8/15) ao lado de um cabeçalho que diz 17 criadores parece erro.
  const first = table.rows[0];
  if (first && first.fitsOutOf > 0) {
    parts.push(
      `<p class="note-fine"><b>Cabe em ${first.fitsCount}/${first.fitsOutOf}</b> = dos ` +
        `${first.fitsOutOf} criadores que declaram ${esc(territoryLabel)} no mapa, ` +
        `${first.fitsCount} têm ${esc(first.label.toLowerCase())} na vida — é quanta ` +
        `gente pode usar isso.</p>`,
    );
  }
  return parts.join("");
}

// ─── Blocos visuais ─────────────────────────────────────────────────────────

function narrativesBlock(narratives: NarrativeEntry[]): string {
  if (narratives.length === 0) {
    return (
      `<h2 class="tt sm">Narrativas do território</h2>` +
      `<p class="sub sm">Ache a sua. Não tem ordem.</p>` +
      emptyNote(
        "As narrativas do mapa ainda são texto livre de cada criador. Nenhuma é " +
          "compartilhada por dois criadores deste território.",
      )
    );
  }

  // TODAS as narrativas, em duas colunas.
  //
  // Antes cortava em 6 e escrevia "e 5 outras narrativas no território" — enquanto 70%
  // da tela estava vazia. Truncar num espaço vazio é o pior dos dois mundos: some com a
  // narrativa de alguém E deixa o buraco. A narrativa é a frase que define o criador no
  // mapa; ninguém deveria abrir o relatório do próprio território e não se encontrar.
  return (
    `<h2 class="tt sm">Narrativas do território</h2>` +
    `<p class="sub sm">Todas as narrativas do território. Não estão em ordem de nada.</p>` +
    `<div class="nrlist grandes${narratives.length > 9 ? " muitas" : ""}">` +
    narratives
      .map(
        (narrative) =>
          `<div class="nr"><b>${esc(narrative.label)}</b>` +
          (narrative.creators > 1
            ? `<span>${plural(narrative.creators, "criador", "criadores")}</span>`
            : "") +
          `</div>`,
      )
      .join("") +
    `</div>`
  );
}

function timeGridBlock(grid: TimeGrid): string {
  const maxIndex = Math.max(1, ...grid.cells.map((cell) => cell.index ?? 0));
  const header =
    `<div></div>` + WEEKDAYS.map((day) => `<div class="h">${day}</div>`).join("");
  const rows = grid.slotLabels
    .map((label, slot) => {
      const cells = WEEKDAYS.map((_, dayOfWeek) => {
        const cell = grid.cells.find((c) => c.dayOfWeek === dayOfWeek && c.slot === slot);
        if (!cell || cell.index === null) return `<div class="cell v0"></div>`;
        const opacity = Math.max(0.18, Math.min(1, cell.index / maxIndex));
        const lite = opacity < 0.45 ? " lite" : "";
        return `<div class="cell${lite}" style="opacity:${opacity.toFixed(2)}"><span>${idx(
          cell.index,
        ).replace("×", "")}</span></div>`;
      }).join("");
      return `<div class="hr">${esc(label)}</div>${cells}`;
    })
    .join("");
  return `<div class="grid7">${header}${rows}</div>`;
}

function durationBlock(durations: DurationBar[]): string {
  const maxRetention = Math.max(1, ...durations.map((d) => d.retentionIndex ?? 0));
  const maxEngagement = Math.max(1, ...durations.map((d) => d.engagementIndex ?? 0));
  const columns = durations
    .map((bar) => {
      const retention = bar.retentionIndex === null ? 0 : (bar.retentionIndex / maxRetention) * 100;
      const engagement =
        bar.engagementIndex === null ? 0 : (bar.engagementIndex / maxEngagement) * 100;
      return (
        `<div class="dcol"><div class="dbars">` +
        `<i class="c-ret" style="height:${retention.toFixed(1)}%"></i>` +
        `<i class="c-com" style="height:${engagement.toFixed(1)}%"></i>` +
        `</div><div class="dvalues">` +
        `<span class="ret">Ret. ${idx(bar.retentionIndex)}</span>` +
        `<span class="eng">Eng. ${idx(bar.engagementIndex)}</span>` +
        `</div><div class="dlab">${esc(bar.label)}<br><span>${bar.posts} posts</span></div></div>`
      );
    })
    .join("");
  return `<div class="dur">${columns}</div>`;
}

/**
 * Os vídeos da semana. É a tela mais importante da reunião — é onde a análise vira
 * "olha esse aqui" — então ela é um CARD por vídeo, não uma linha de tabela.
 *
 * O que mudou e por quê: a tabela antiga tinha quatro colunas de índice lado a lado e
 * saía "1,1× 2,0× 0,0× 0,1×" — o olho não achava o que era notável no meio dos zeros.
 * Agora só as DUAS métricas em que o vídeo se destacou, com o nome da métrica por
 * extenso, mais os elementos do mapa que estavam nele (o "por que funcionou") e o link
 * para dar play na hora.
 */
function topVideosBlock(videos: TopVideo[], startAt = 1): string {
  if (videos.length === 0) return emptyNote("Nenhum vídeo com alcance medido nesta semana.");

  return (
    `<div class="vids">` +
    videos
      .map((video, position) => {
        const thumb = video.thumbnailUrl
          ? `<span class="vtn" style="background-image:url('${esc(video.thumbnailUrl)}')"></span>`
          : `<span class="vtn"></span>`;
        const standout = video.standout
          .map(
            (m) =>
              `<span class="vmet"><b>${idx(m.index)}</b> ${esc(
                REPORT_METRIC_LABELS[m.metric].toLowerCase(),
              )}</span>`,
          )
          .join("");
        const meta = [
          video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : null,
          video.retention !== null ? `${retentionPct(video.retention)} assistido` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          `<div class="vid">` +
          `<span class="vnum">${position + startAt}</span>${thumb}` +
          `<div class="vinfo">` +
          `<p class="vname">${esc(video.creatorName)}</p>` +
          `<p class="vmeta">${esc(meta)}</p>` +
          (video.screenTitle
            ? `<p class="vhook"><span class="vtag">na tela</span> ${esc(video.screenTitle)}</p>`
            : "") +
          (video.openingLine
            ? `<p class="vhook"><span class="vtag">abertura</span> “${esc(video.openingLine)}”</p>`
            : "") +
          (video.elements.length > 0
            ? `<p class="vel">${esc(video.elements.join(" · "))}</p>`
            : "") +
          `</div>` +
          `<div class="vmets">${standout}</div>` +
          (video.postLink
            ? `<a class="vlink" href="${esc(video.postLink)}">abrir ▸</a>`
            : `<span class="vlink off">sem link</span>`) +
          `</div>`
        );
      })
      .join("") +
    `</div>`
  );
}

/**
 * O vídeo nº 1, em tamanho de gente.
 *
 * "Exibir os melhores vídeos é o principal da reunião" — e o principal estava numa
 * linha de tabela com capa de 54px, disputando espaço com quatro outras. Aqui o
 * primeiro colocado ganha a página: a capa no formato em que foi feita (9:16), o
 * gancho legível de longe, e os números grandes ao lado.
 */
function heroVideoBlock(video: TopVideo, territoryLabel: string): string {
  const thumb = video.thumbnailUrl
    ? `<span class="hvtn" style="background-image:url('${esc(video.thumbnailUrl)}')"></span>`
    : `<span class="hvtn empty"></span>`;
  const standoutMetrics = new Set(video.standout.map((metric) => metric.metric));
  const contextItems = [
    ...video.metrics
      .filter((metric) => !standoutMetrics.has(metric.metric))
      .map(
        (metric) =>
          `<p><b>${idx(metric.index)}</b><span>${esc(REPORT_METRIC_LABELS[metric.metric].toLowerCase())}</span></p>`,
      ),
    ...(video.durationSeconds
      ? [`<p><b>${Math.round(video.durationSeconds)}s</b><span>duração</span></p>`]
      : []),
    ...(video.retention !== null
      ? [`<p><b>${retentionPct(video.retention)}</b><span>assistido</span></p>`]
      : []),
  ];
  const [primary, secondary] = video.standout;
  const resultReading = primary
    ? `Em ${esc(metricBasis(primary.metric))}, chegou a ${idx(primary.index)} o resultado do post típico do território.` +
      (secondary
        ? ` Em ${esc(metricBasis(secondary.metric))}, chegou a ${idx(secondary.index)}.`
        : "")
    : "O post liderou a seleção desta semana, mas ainda não tem métricas comparáveis suficientes.";

  return (
    `<div class="hero">` +
    thumb +
    `<div class="hinfo">` +
    `<p class="hkick">O vídeo da semana em ${esc(territoryLabel)}</p>` +
    `<p class="hname">${esc(video.creatorName)}` +
    (video.creatorHandle ? `<span class="hhandle">@${esc(video.creatorHandle)}</span>` : "") +
    `</p>` +
    (video.screenTitle
      ? `<p class="hhook"><span class="vtag">na tela</span>${esc(video.screenTitle)}</p>`
      : "") +
    (video.openingLine
      ? `<p class="hhook big">“${esc(video.openingLine)}”</p>`
      : "") +
    `<div class="hmets">` +
    video.standout
      .map(
        (m) =>
          `<div><b>${idx(m.index)}</b><span>${esc(REPORT_METRIC_LABELS[m.metric].toLowerCase())}</span></div>`,
      )
      .join("") +
    `</div>` +
    `<div class="hreading"><span>Leitura do resultado</span><p>${resultReading}</p></div>` +
    (contextItems.length > 0
      ? `<div class="hcontext"><span>Outros dados</span><div>${contextItems.join("")}</div></div>`
      : "") +
    (video.elements.length > 0
      ? `<p class="hel"><span>O que aparece</span>${esc(video.elements.join(" · "))}</p>`
      : "") +
    (video.postLink ? `<a class="hlink" href="${esc(video.postLink)}">▶ dar play no post</a>` : "") +
    `</div></div>`
  );
}

function gapsBlock(gaps: TerritoryGap[]): string {
  if (gaps.length === 0) return "";
  return (
    `<p class="sortby mb10">O que está vazio no território</p>` +
    `<div class="gaps">` +
    gaps
      .map(
        (gap) =>
          `<div class="box"><p class="gt">${esc(gap.title)}</p><p class="gd">${esc(gap.detail)}</p></div>`,
      )
      .join("") +
    `</div>`
  );
}

/** Ordem e nome das famílias da matriz. */
const MATRIX_GROUPS: { kind: ElementKind; label: string }[] = [
  { kind: "asset", label: "O que aparece" },
  { kind: "assunto", label: "Sobre o que fala" },
  { kind: "tom", label: "Como fala" },
  { kind: "horario", label: "Quando posta" },
  { kind: "duracao", label: "Que tamanho" },
];

/**
 * A matriz, AGRUPADA por família.
 *
 * Antes era uma lista corrida de 12 linhas misturando asset, assunto, tom, horário e
 * duração, todas com o mesmo peso — e a instrução "ache a coluna e desça" não ajudava
 * porque não dava para saber o que cada linha era. Agrupada, a leitura vira: escolha a
 * pergunta ("o que aparece?", "quando posto?"), depois a coluna, depois desça.
 */
function matrixBlock(matrix: MatrixRow[], columns: ReportMetric[]): string {
  if (matrix.length === 0) return emptyNote("Nenhum elemento passou o corte nesta semana.");
  const head =
    `<tr><th style="width:230px">Elemento</th>` +
    columns.map((metric) => `<th>${esc(REPORT_METRIC_SHORT[metric])}</th>`).join("") +
    `</tr>`;

  const body: string[] = [];
  for (const group of MATRIX_GROUPS) {
    const rows = matrix.filter((row) => row.kind === group.kind);
    if (rows.length === 0) continue;
    body.push(
      `<tr class="mxg"><td colspan="${columns.length + 1}">${esc(group.label)}</td></tr>`,
    );
    for (const row of rows) {
      const cells = columns
        .map((metric) => {
          const cell = row.cells.find((c) => c.metric === metric);
          if (!cell) return `<td class="m0">—</td>`;
          return `<td class="m${cell.intensity}">${idx(cell.index)}</td>`;
        })
        .join("");
      body.push(`<tr><td>${esc(row.label)}</td>${cells}</tr>`);
    }
  }
  return `<table class="mx">${head}${body.join("")}</table>`;
}

/**
 * Pagina a matriz sem quebrar uma pergunta no meio.
 *
 * Cada família custa uma linha de cabeçalho além de suas linhas de dados. Um grupo só
 * continua na página seguinte quando, sozinho, ultrapassa a capacidade visual da
 * matriz. Isso evita "O que aparece" no fim de uma página e novamente no início da
 * próxima, que fazia parecer que eram blocos diferentes.
 */
function matrixPages(matrix: MatrixRow[], maxVisualRows = 10): MatrixRow[][] {
  const groups = MATRIX_GROUPS
    .map((group) => matrix.filter((row) => row.kind === group.kind))
    .filter((rows) => rows.length > 0);

  // No caso comum, em que cada família cabe inteira, distribui os grupos perto da
  // ocupação média de cada página. O empacotamento puramente guloso fazia 10/6 linhas;
  // respeitar o alvo produz 7/9 sem separar nenhuma pergunta.
  if (groups.every((rows) => rows.length + 1 <= maxVisualRows)) {
    const totalCost = groups.reduce((sum, rows) => sum + rows.length + 1, 0);
    const plannedPages = Math.max(1, Math.ceil(totalCost / maxVisualRows));
    const targetCost = totalCost / plannedPages;
    const balanced: MatrixRow[][] = [];
    let current: MatrixRow[] = [];
    let currentCost = 0;

    for (const rows of groups) {
      const groupCost = rows.length + 1;
      const nextCost = currentCost + groupCost;
      const wouldOverflow = nextCost > maxVisualRows;
      const wouldUnbalance =
        current.length > 0 &&
        Math.abs(nextCost - targetCost) > Math.abs(currentCost - targetCost) &&
        balanced.length < plannedPages - 1;
      if (wouldOverflow || wouldUnbalance) {
        balanced.push(current);
        current = [];
        currentCost = 0;
      }
      current.push(...rows);
      currentCost += groupCost;
    }
    if (current.length > 0) balanced.push(current);
    return balanced;
  }

  const pages: MatrixRow[][] = [];
  let current: MatrixRow[] = [];
  let currentCost = 0;

  const flush = () => {
    if (current.length === 0) return;
    pages.push(current);
    current = [];
    currentCost = 0;
  };

  for (const rows of groups) {
    const groupCost = rows.length + 1;
    if (groupCost <= maxVisualRows) {
      if (current.length > 0 && currentCost + groupCost > maxVisualRows) flush();
      current.push(...rows);
      currentCost += groupCost;
      continue;
    }

    flush();
    for (const continuation of chunk(rows, Math.max(1, maxVisualRows - 1))) {
      pages.push(continuation);
    }
  }

  flush();
  return pages;
}

// ─── Os 21 slides ───────────────────────────────────────────────────────────

const MATRIX_COLUMNS: ReportMetric[] = [
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "retencao",
  "alcance",
];

const OVERVIEW_COLUMNS: ReportMetric[] = [
  "curtidas",
  "comentarios",
  "compartilhamentos",
  "salvamentos",
  "retencao",
];

export interface RenderedSlide {
  n: number;
  id: string;
  note: string;
  html: string;
  /** Capítulo editorial usado no mapa do relatório e na auditoria. */
  chapter?: "abertura" | "hall" | "inteligencia" | "territorio" | "fechamento";
  /** Duas velocidades de leitura: reunião e estudo profundo. */
  readingMode?: "anchor" | "study" | "divider";
  /** Família visual para regras de ocupação e QA. */
  family?: string;
  territoryId?: string;
  /** Dados representados integralmente neste slide. */
  coverageKeys?: string[];
  /** Dados repetidos de propósito em resumos ou homenagens. */
  repeatedCoverageKeys?: string[];
  intentionalWhitespace?: boolean;
}

type TerritoryTableField =
  | "temas"
  | "falas"
  | "assuntos"
  | "tons"
  | "assets"
  | "objetos"
  | "locais"
  | "enquadramentos"
  | "esteticas"
  | "horarios"
  | "duracoes";

const TERRITORY_TABLE_FIELDS: TerritoryTableField[] = [
  "temas",
  "falas",
  "assuntos",
  "tons",
  "assets",
  "objetos",
  "locais",
  "enquadramentos",
  "esteticas",
  "horarios",
  "duracoes",
];

// A síntese de cautelas precisa falar de decisões criativas. Horário e duração têm
// leitura própria no estudo de cada território e, fora desse contexto, parecem uma
// recomendação editorial solta (por exemplo, "Moda · Sáb 8–12h").
const INTELLIGENCE_CAUTION_FIELDS = [
  "temas",
  "falas",
  "assuntos",
  "tons",
  "assets",
  "objetos",
  "locais",
  "enquadramentos",
  "esteticas",
] as const satisfies readonly TerritoryTableField[];

const INTELLIGENCE_CAUTION_LABELS: Record<(typeof INTELLIGENCE_CAUTION_FIELDS)[number], string> = {
  temas: "Assunto específico",
  falas: "Frase dita",
  assuntos: "Assunto agrupado",
  tons: "Tom de voz",
  assets: "Asset de vida",
  objetos: "Objeto em cena",
  locais: "Local",
  enquadramentos: "Enquadramento",
  esteticas: "Estética",
};

function territoryKey(territoryId: string, kind: string, index: number): string {
  return `territory:${territoryId}:${kind}:${index}`;
}

function tableRowKey(territoryId: string, field: TerritoryTableField | string, index: number): string {
  return territoryKey(territoryId, `table:${field}:row`, index);
}

function coverageForRows(
  territoryId: string,
  field: TerritoryTableField | string,
  source: readonly RankingRow[],
  rows: readonly RankingRow[],
): string[] {
  return rows.map((row) => {
    const referenceIndex = source.indexOf(row);
    const stableIndex = referenceIndex >= 0
      ? referenceIndex
      : source.findIndex((candidate) => candidate.key === row.key);
    if (stableIndex < 0) {
      throw new Error(`Linha sem chave de cobertura: ${territoryId}/${field}/${row.key}`);
    }
    return tableRowKey(territoryId, field, stableIndex);
  });
}

/**
 * A expectativa de cobertura vem do dado, não do desenho. Se um template esquecer uma
 * continuação, a renderização falha em vez de produzir silenciosamente um PDF menor.
 */
export function expectedCoverageKeys(report: WeeklyReportData): string[] {
  const keys: string[] = ["cover", "meeting", "silent-creators:count"];
  report.overview.forEach((_, index) => keys.push(`overview:${index}`));
  if (report.previousPrediction) keys.push("previous-prediction");
  report.highlights.forEach((_, index) => keys.push(`highlight:${index}`));
  if (report.prediction) keys.push("prediction");

  for (const section of report.territories) {
    const id = section.header.territoryId;
    keys.push(`territory:${id}:header`);
    section.narratives.forEach((_, index) => keys.push(territoryKey(id, "narrative", index)));
    section.topVideos.forEach((_, index) => keys.push(territoryKey(id, "video", index)));
    TERRITORY_TABLE_FIELDS.forEach((field) =>
      section[field].rows.forEach((_, index) => keys.push(tableRowKey(id, field, index))),
    );
    section.timeGrid.cells.forEach((_, index) => keys.push(territoryKey(id, "time-cell", index)));
    section.durations.forEach((_, index) => keys.push(territoryKey(id, "duration-bar", index)));
    section.matrix.forEach((_, index) => keys.push(territoryKey(id, "matrix", index)));
    section.gaps.forEach((_, index) => keys.push(territoryKey(id, "gap", index)));
    section.pautas.forEach((_, index) => keys.push(territoryKey(id, "pauta", index)));
    if (section.strongCombination) keys.push(`territory:${id}:combination`);
  }
  return keys;
}

export interface CoverageManifest {
  expected: string[];
  covered: string[];
  repeated: string[];
  missing: string[];
  duplicatePrimary: string[];
}

export function buildCoverageManifest(
  report: WeeklyReportData,
  slides: readonly RenderedSlide[],
): CoverageManifest {
  const expected = expectedCoverageKeys(report);
  const counts = new Map<string, number>();
  for (const slide_ of slides) {
    for (const key of slide_.coverageKeys ?? []) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const covered = [...counts.keys()].sort();
  const expectedSet = new Set(expected);
  const missing = expected.filter((key) => !counts.has(key));
  const duplicatePrimary = [...counts.entries()]
    .filter(([key, count]) => expectedSet.has(key) && count > 1)
    .map(([key]) => key)
    .sort();
  const repeated = [...new Set(slides.flatMap((slide_) => slide_.repeatedCoverageKeys ?? []))].sort();
  return { expected: expected.sort(), covered, repeated, missing, duplicatePrimary };
}

function coverSlide(report: WeeklyReportData, n: number): RenderedSlide {
  const { cover } = report;
  const dateLabel = `${cover.rangeLabel
    .replace(/\s+a\s+/i, "—")
    .replace(/\s+de\s+/i, " ")} ${cover.isoYear}`;
  const columns = report.highlights.length <= 3
    ? Math.max(1, report.highlights.length)
    : report.highlights.length <= 6
      ? 3
      : report.highlights.length <= 8
        ? 4
        : 5;
  const rows = Math.max(1, Math.ceil(report.highlights.length / columns));
  const cast = report.highlights.length > 0
    ? report.highlights.map(coverPortrait).join("")
    : `<div class="coverpeople-empty"><span>★</span><p>Os destaques desta semana aparecem no Hall.</p></div>`;

  return {
    n,
    id: "capa",
    note: `${String(n).padStart(2, "0")} · capa`,
    chapter: "abertura",
    readingMode: "anchor",
    family: "cover",
    coverageKeys: ["cover"],
    repeatedCoverageKeys: report.highlights.map((_, index) => `highlight:${index}`),
    intentionalWhitespace: true,
    html: slide(
      `<div class="coverlayout">` +
        `<section class="covercopy">` +
          `<p class="coverkicker">Data2Content · Inteligência de conteúdo</p>` +
          `<h1 class="covertitle"><span>Report</span><b>D2C</b></h1>` +
          `<p class="coverdate">${esc(dateLabel)}</p>` +
          `<p class="coverweek">Semana ${cover.isoWeek}</p>` +
          `<div class="coverpromise"><span>Hall da Semana</span>` +
          `<p>As pessoas e ideias que marcaram esta edição.</p></div>` +
        `</section>` +
        `<section class="coverpeople cols-${columns} rows-${rows}" style="--cover-cols:${columns}">` +
          cast +
        `</section>` +
      `</div>`,
      { dark: true, foot: ["Data2Content", `Semana ${cover.isoWeek} · 01`], className: "cover-slide" },
    ),
  };
}

function overviewSlide(report: WeeklyReportData, n: number): RenderedSlide[] {
  const rows = report.overview
    .map((row) => {
      const metrics = OVERVIEW_COLUMNS.map(
        (metric) =>
          `<td>${metricBar(metric, row.metrics.find((m) => m.metric === metric)?.index ?? null)}</td>`,
      ).join("");
      return (
        `<tr><td><div class="it">${esc(row.label)}</div>` +
        `<span class="occ">${row.posts} vídeos</span></td>` +
        `<td>${movementCell(row.movement)}</td>${metrics}` +
        `<td class="fit">${row.creators}</td></tr>`
      );
    })
    .join("");

  const prediction = report.previousPrediction;
  const predictionBlock = prediction
    ? `<h2 class="tt">A previsão da semana passada</h2>` +
      `<p class="sub">${esc(prediction.statement)}</p>` +
      `<div class="predrow">` +
      `<div><div class="big" style="font-size:60px">${prediction.worked}` +
      `<span class="of">/${prediction.tested}</span></div>` +
      `<p class="sortby mt7">testaram e funcionou</p></div>` +
      (prediction.note
        ? `<div class="prednote"><p>${esc(prediction.note)}</p></div>`
        : "") +
      `</div>`
    : `<h2 class="tt">A previsão da semana passada</h2>` +
      emptyNote(
        "A primeira previsão é registrada nesta semana. O resultado abre o relatório " +
          "da próxima segunda.",
      );

  // Criadores cobertos pelas telas de território, para a nota da soma.
  const shown = report.overview.reduce((sum, row) => sum + row.creators, 0);
  const cover = report.cover;

  const legend = OVERVIEW_COLUMNS.map(
    (metric) =>
      `<div><i class="${METRIC_CLASS[metric]}"></i> ${esc(
        REPORT_METRIC_LABELS[metric].toLowerCase(),
      )}</div>`,
  ).join("");

  const table =
    `<table class="rk${report.overview.length > 6 ? " ovcompact" : ""}">` +
    `<tr><th style="width:190px">Território</th><th style="width:52px">Mov.</th>` +
    OVERVIEW_COLUMNS.map((metric) => `<th>${esc(REPORT_METRIC_SHORT[metric])}</th>`).join("") +
    `<th style="text-align:right;width:78px">Criadores</th></tr>${rows}</table>`;

  const legendBlock =
    `<div><p class="sortby mb12">Como ler as barras</p>` +
    `<div class="leg col">${legend}</div>` +
    // A conta da capa não fecha com a soma das linhas, e sem esta nota parece erro: a
    // capa conta TODO criador que postou; as linhas contam só os territórios que
    // abriram tela. O resto está espalhado em territórios pequenos demais.
    (cover.creators > shown
      ? `<p class="note-fine">Os ${cover.creators} criadores da capa incluem ` +
        `${cover.creators - shown} que postaram em territórios menores, sem tela ` +
        `própria nesta semana.</p>`
      : "") +
    `</div>`;

  // Calibrado para ~4-6 territórios: a tabela + previsão + legenda dividiam a mesma
  // tela. Sem teto de território, com 13 a tabela sozinha já ocupa quase toda a altura
  // (622 dos ~638px medidos) — não sobra o suficiente pra previsão nem apertando o CSS.
  // Acima do limiar, a tabela ganha a tela pra ela e previsão+legenda vira uma segunda,
  // com espaço de sobra. Poucos territórios continuam numa tela só, como sempre foi.
  if (report.overview.length <= 6) {
    return [
      {
        n,
        id: "visao-geral",
        note: `${String(n).padStart(2, "0")} · os territórios + previsão anterior + legenda`,
        chapter: "abertura",
        readingMode: "anchor",
        family: "overview",
        coverageKeys: [
          ...report.overview.map((_, index) => `overview:${index}`),
          ...(report.previousPrediction ? ["previous-prediction"] : []),
          "silent-creators:count",
        ],
        html: slide(
          `<div class="thead"><div class="nm">Os ${report.overview.length} territórios</div>` +
            `<div class="meta">${esc(sortedByLabel("comentarios"))} · variação sobre a semana anterior</div></div>` +
            table +
            `<div class="split125"><div>${predictionBlock}</div><div class="vr"></div>${legendBlock}</div>`,
          { foot: ["Visão geral", `Semana ${report.cover.isoWeek} · ${String(n).padStart(2, "0")}`] },
        ),
      },
    ];
  }

  const secondN = n + 1;
  return [
    {
      n,
      id: "visao-geral",
      note: `${String(n).padStart(2, "0")} · os territórios · 1 de 2`,
      chapter: "abertura",
      readingMode: "anchor",
      family: "overview",
      coverageKeys: report.overview.map((_, index) => `overview:${index}`),
      html: slide(
        `<div class="thead"><div class="nm">Os ${report.overview.length} territórios</div>` +
          `<div class="meta">${esc(sortedByLabel("comentarios"))} · variação sobre a semana anterior · 1 de 2</div></div>` +
          table,
        { foot: ["Visão geral", `Semana ${report.cover.isoWeek} · ${String(n).padStart(2, "0")}`] },
      ),
    },
    {
      n: secondN,
      id: "visao-geral-previsao",
      note: `${String(secondN).padStart(2, "0")} · previsão anterior + legenda · 2 de 2`,
      chapter: "abertura",
      readingMode: "anchor",
      family: "overview",
      coverageKeys: [
        ...(report.previousPrediction ? ["previous-prediction"] : []),
        "silent-creators:count",
      ],
      html: slide(
        `<div class="thead"><div class="nm">Os ${report.overview.length} territórios</div>` +
          `<div class="meta">Previsão da semana passada e legenda · 2 de 2</div></div>` +
          `<div class="split125" style="margin-top:40px">` +
          `<div>${predictionBlock}</div><div class="vr"></div>${legendBlock}</div>`,
        { foot: ["Visão geral", `Semana ${report.cover.isoWeek} · ${String(secondN).padStart(2, "0")}`] },
      ),
    },
  ];
}

/**
 * A parede de frases.
 *
 * As falas nunca foram categoria: são EVIDÊNCIA. Colocá-las numa tabela com barra e
 * multiplicador — 42 linhas, nenhuma repetida — era pedir ao leitor que comparasse
 * citações, que é uma operação sem sentido. E enterrava, em cinco telas de tabela, a
 * coisa mais aproveitável do relatório inteiro: a frase que o criador pode roubar na
 * quinta-feira.
 *
 * Aqui elas voltam ao que são: dito, em corpo grande, com autor. As oito mais fortes
 * ganham a tela; o resto desce para o inventário, sem número, junto do que aconteceu
 * uma vez.
 */
function quoteWallBlock(rows: readonly RankingRow[], sortedBy: ReportMetric): string {
  if (rows.length === 0) return "";
  return (
    `<div class="qwall">` +
    rows
      .map((row) => {
        const metric = row.metrics.find((m) => m.metric === sortedBy);
        return (
          `<figure class="q">` +
          `<blockquote>“${esc(row.label)}”</blockquote>` +
          `<figcaption>${esc(row.sampleCreatorName ?? "criador")}` +
          (metric
            ? `<span class="qm">${idx(metric.index)} ${esc(REPORT_METRIC_SHORT[sortedBy].toLowerCase())}</span>`
            : "") +
          `</figcaption></figure>`
        );
      })
      .join("") +
    `</div>`
  );
}

/**
 * A EVIDÊNCIA: a capa do vídeo que puxou a primeira linha da tabela.
 *
 * Nenhuma tela de tabela tinha imagem, e várias sobravam meia página. Aqui o espaço
 * vira exemplo concreto: a linha diz "Look montado 2,5×", e ao lado está o vídeo da
 * semana que TINHA look montado, com capa, autor e link. A tabela deixa de ser abstrata.
 *
 * Só aparece quando existe um vídeo da semana que de fato contém aquele elemento — se
 * não houver, não se inventa exemplo.
 */
function evidenciaBlock(
  table: RankingTable,
  videos: readonly TopVideo[],
  densidade: "compacta" | "normal" | "ampla",
): string {
  if (densidade !== "ampla" || table.rows.length > 3) return "";
  const primeira = table.rows.find((row) => !row.pullsDown);
  if (!primeira) return "";
  const alvo = primeira.label.toLowerCase();
  const video = videos.find(
    (v) => v.thumbnailUrl && v.elements.some((e) => e.toLowerCase() === alvo),
  );
  if (!video) return "";

  const numero = video.standout[0];
  return (
    `<div class="evid">` +
    `<span class="evimg" style="background-image:url('${esc(video.thumbnailUrl)}')"></span>` +
    `<div class="evtxt">` +
    `<p class="evlabel">Um vídeo da semana com ${esc(primeira.label.toLowerCase())}</p>` +
    `<p class="evname">${esc(video.creatorName)}` +
    (video.creatorHandle ? `<span>@${esc(video.creatorHandle)}</span>` : "") +
    `</p>` +
    (numero
      ? `<p class="evnum">${idx(numero.index)} ${esc(REPORT_METRIC_LABELS[numero.metric].toLowerCase())}</p>`
      : "") +
    (video.openingLine ? `<p class="evhook">“${esc(video.openingLine)}”</p>` : "") +
    `</div>` +
    (video.postLink ? `<a class="cta evcta" href="${esc(video.postLink)}">▶ Assistir</a>` : "") +
    `</div>`
  );
}

/**
 * O inventário: o que aconteceu uma vez só.
 *
 * A DECISÃO DE DESENHO MAIS IMPORTANTE DO RELATÓRIO, e ela veio de um número. Das 448
 * linhas de tabela, 324 (72%) apareceram UMA vez. Nas duas maiores tabelas de
 * Maternidade — 60 assuntos e 42 frases — a repetição foi ZERO: em 30 posts de 11
 * criadoras, ninguém falou da mesma coisa que outra.
 *
 * Essas 102 linhas ocupavam onze slides desenhados na gramática de um ranking (barra,
 * multiplicador, coluna de movimento, "quem fez"). A tabela promete comparação; sem
 * repetição não há nada a comparar, e a ordem cai no alfabeto. Onze slides prometendo
 * o que não podiam entregar, e empurrando para fora o que importava.
 *
 * Aqui a informação continua inteira e muda de traje: vira lista densa, em colunas, sem
 * número e sem barra. É honesto (não finge ranking) e é compacto (60 itens em um bloco
 * em vez de seis telas).
 */
/**
 * Quantas LINHAS de texto o inventário aguenta, por coluna, conforme o que já está
 * ocupando a tela acima dele.
 *
 * Contar itens não serve: "caneca" ocupa uma linha e "Sabe aquela história que homem
 * tem três meses para resolver alguma coisa?" ocupa três. Contando itens, 34 frases
 * transbordaram o rodapé; contando linhas, o bloco fecha onde deve.
 */
const INVENTORY_LINES = { sozinho: 18, comRanking: 12, comParede: 6 } as const;

/** Largura útil de uma coluna do inventário, em caracteres, a 12,5px. */
const CHARS_PER_LINE = 46;

function linesOf(row: RankingRow): number {
  return Math.max(1, Math.ceil(row.label.length / CHARS_PER_LINE));
}

/** Quebra o inventário em páginas que CABEM, medindo linhas e não itens. */
function inventoryPages(
  rows: readonly RankingRow[],
  linesPerColumn: number,
): RankingRow[][] {
  // Orçamento zero significa "não cabe nada aqui", e não "cabe um". Sem esta guarda o
  // laço abaixo sempre empurrava o primeiro item, porque a página começa vazia — e uma
  // linha de inventário sozinha embaixo de um ranking de 9 estourava o rodapé.
  if (linesPerColumn <= 0) return [];
  const budget = linesPerColumn * 3;
  const pages: RankingRow[][] = [];
  let current: RankingRow[] = [];
  let used = 0;
  for (const row of rows) {
    const cost = linesOf(row);
    if (used + cost > budget && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += cost;
  }
  if (current.length > 0) pages.push(current);
  // A última continuação não pode virar uma página com um ou dois itens enquanto a
  // anterior está lotada. Redistribui pelo custo real de linhas, sem aumentar o número
  // de páginas nem ultrapassar o orçamento de nenhuma coluna.
  for (let page = pages.length - 1; page > 0; page -= 1) {
    const previous = pages[page - 1]!;
    const last = pages[page]!;
    let previousCost = previous.reduce((sum, row) => sum + linesOf(row), 0);
    let lastCost = last.reduce((sum, row) => sum + linesOf(row), 0);
    const target = Math.ceil((previousCost + lastCost) / 2);
    while (lastCost < target && previous.length > 1) {
      const candidate = previous[previous.length - 1]!;
      const cost = linesOf(candidate);
      if (lastCost + cost > budget) break;
      previous.pop();
      last.unshift(candidate);
      previousCost -= cost;
      lastCost += cost;
    }
  }
  return pages;
}

function inventoryBlock(
  rows: readonly RankingRow[],
  title: string,
  total = rows.length,
  semCabecalho = false,
  standaloneLabel = "Itens observados",
  embedded = false,
): string {
  if (rows.length === 0) return "";
  const lineCount = rows.reduce((sum, row) => sum + linesOf(row), 0);
  const density =
    embedded && rows.length <= 3
      ? "inv-spacious"
      : rows.length <= 3
      ? "inv-solo"
      : rows.length <= 8 && lineCount <= 14
      ? "inv-spacious"
      : rows.length <= 18 && lineCount <= 28
        ? "inv-standard"
        : rows.length <= 36 && lineCount <= 40
          ? "inv-roomy"
          : "inv-compact";
  // Quando não existe ranking, a ausência de repetição não é um achado útil: dimensões
  // abertas são naturalmente específicas. A página passa a dizer o que existe e quantos
  // itens foram observados, sem gastar a área nobre explicando o que não aconteceu.
  if (semCabecalho) {
    return (
      `<div class="inv standalone ${density}">` +
      `<p class="invhead">${esc(standaloneLabel)} <span>${total}</span></p>` +
      `<ul class="invlist solta ${density}">` +
      rows.map((row) => `<li>${esc(row.label)}</li>`).join("") +
      `</ul></div>`
    );
  }
  const quantos =
    total === rows.length
      ? `${rows.length} ${rows.length === 1 ? "item" : "itens"}`
      : `${rows.length} de ${total}`;
  return (
    `<div class="inv ${density}">` +
    `<p class="invhead">${esc(title)} <span>${quantos}</span></p>` +
    `<ul class="invlist ${density}">` +
    rows.map((row) => `<li>${esc(row.label)}</li>`).join("") +
    `</ul></div>`
  );
}

function standaloneInventoryLabel(kind: ElementKind, continuation: boolean): string {
  const label =
    kind === "fala"
      ? "Frases observadas"
      : kind === "tema"
        ? "Assuntos específicos observados"
        : "Elementos observados";
  return continuation ? `${label} · continuação` : label;
}

/**
 * Uma tabela vira UMA OU MAIS telas, no mesmo desenho.
 *
 * É a peça que reconcilia as duas coisas que pareciam brigar: o desenho de slide, que
 * é bom e a gente quis manter, e a riqueza, que não cabe em 5 linhas. A resposta não é
 * espremer nem trocar de formato — é o deck crescer. "Assuntos ditos · 2 de 5" é a mesma
 * tela do "1 de 5", com as linhas seguintes.
 */
function tableSlides(params: {
  table: RankingTableType;
  section: TerritorySection;
  week: number;
  windowDays: number;
  startN: number;
  title: string;
  subtitle: string;
  slug: string;
  coverageField?: TerritoryTableField | string;
  sourceRows?: readonly RankingRow[];
  rankAllRows?: boolean;
  family?: string;
  showFits?: boolean;
  showViews?: boolean;
}): RenderedSlide[] {
  const { table, section, week, windowDays, startN, title, subtitle, slug } = params;
  const coverageField = params.coverageField ?? slug;
  const pad = (value: number) => String(value).padStart(2, "0");
  const head = territoryHead(section.header);

  // Ranking e inventário são coisas diferentes e param de dividir a mesma tabela.
  const sourceRows = params.sourceRows ?? table.rows;
  // Reaplica o comparador na renderização. Além de manter todas as famílias iguais,
  // isto protege snapshots antigos cuja ordem tenha sido gravada antes da regra atual.
  const orderedRows = [...table.rows].sort((a, b) =>
    compareRankingRows(a, b, table.sortedBy, table.columns));
  const orderedTable: RankingTableType = { ...table, rows: orderedRows };
  // Toda dimensão analítica é ranking, inclusive o que apareceu uma vez. A força
  // bayesiana reduz o peso da amostra curta; ela não transforma a linha em inventário
  // alfabético nem remove suas barras e sua posição.
  const rankAllRows = params.rankAllRows ?? true;
  const ranked = rankAllRows ? orderedRows : orderedRows.filter((row) => row.occurrences > 1);
  const once = rankAllRows ? [] : orderedRows.filter((row) => row.occurrences <= 1);
  if (ranked.length === 0 && once.length === 0) return [];

  // O ranking inteiro numa tela sempre que couber.
  //
  // Havia um teto fixo de 5 linhas quando existia inventário, e ele partia um ranking de
  // 9 em 5+4: a primeira tela ficava com 40% de papel em branco e nascia uma tela extra
  // só para as 4 restantes. A densidade adaptativa abaixo é que decide quanto cabe.
  const rankedPages: RankingRow[][] =
    ranked.length === 0
      ? [[]]
      : ranked.length <= ROWS_PER_SLIDE
        ? [ranked]
        : chunk(ranked, ROWS_PER_SLIDE);

  // Uma lista paginada é uma única unidade editorial. A última página costuma ter
  // menos linhas, mas isso não deve fazê-la saltar de 17,5px para 22px e parecer uma
  // seção diferente. Calculamos a densidade pela página mais cheia e a preservamos
  // em todas as continuações; tabelas realmente curtas, com uma página só, continuam
  // aproveitando o espaço com a variante ampla.
  const seriesDensity = densidadeDe(
    Math.max(0, ...rankedPages.map((pageRows) => pageRows.length)),
  );

  // O inventário da PRIMEIRA página divide a tela com o ranking; o que sobrar ganha
  // telas só suas, onde cabe bem mais. Medir isso em linhas, não em itens, é o que
  // impede o bloco de passar por cima do rodapé.
  // Sem ranking na tela, o inventário herda a altura inteira. Era o caso mais comum
  // (72% das linhas do relatório aparecem uma vez só) e estava desperdiçando um terço
  // da página com o orçamento de quem divide espaço.
  // Cada linha de ranking come ~2 linhas de inventário (rótulo, meta e barra), e o
  // custo muda com a densidade. Um orçamento fixo fazia o inventário sumir embaixo do
  // rodapé quando o ranking era longo, e sobrar tela quando era curto.
  const custoPorLinha = densidadeDe(rankedPages[0]?.length ?? 0) === "compacta" ? 2.6 : 3.4;
  const naPrimeira = rankedPages[0]?.length ?? 0;
  // Com 7 linhas de ranking a tela já está cheia: o inventário inteiro vai para a
  // página seguinte, onde tem a altura toda, em vez de espremer duas linhas aqui e
  // empurrar o resto 54px abaixo do rodapé.
  // O bloco de leitura estruturada também precisa de espaço real; reservar linhas aqui
  // é mais seguro do que reduzir o corpo quando ranking e inventário dividem a página.
  // Uma continuação de 1–3 itens curtos não merece uma página inteira. A página de
  // ranking já tem a conclusão na própria ordem e nas barras; nesses casos usamos o
  // espaço antes ocupado pela repetição "Sinal mais forte" para fechar o inventário.
  const mergeSmallTail =
    rankedPages.length === 1 &&
    ranked.length <= 6 &&
    once.length > 0 &&
    once.length <= 3 &&
    once.reduce((sum, row) => sum + linesOf(row), 0) <= 5;
  const readingReserve = table.reading && !mergeSmallTail ? 6 : 0;
  const primeiroOrcamento =
    naPrimeira >= ROWS_PER_SLIDE
      ? 0
      : ranked.length > 0
        ? Math.max(
            0,
            Math.round(INVENTORY_LINES.sozinho - naPrimeira * custoPorLinha - readingReserve),
          )
        : Math.max(0, INVENTORY_LINES.sozinho - readingReserve);
  const inventoryFirst = mergeSmallTail
    ? once.slice()
    : inventoryPages(once, primeiroOrcamento).slice(0, 1)[0] ?? [];
  const inventoryRest = inventoryPages(once.slice(inventoryFirst.length), INVENTORY_LINES.sozinho);
  const pages: { ranked: RankingRow[]; inventory: RankingRow[] }[] = [
    ...rankedPages.map((rows, i) => ({
      ranked: rows,
      inventory: i === rankedPages.length - 1 ? inventoryFirst : [],
    })),
    ...inventoryRest.map((rows) => ({ ranked: [] as RankingRow[], inventory: rows })),
  ];

  return pages.map((page_, page) => {
    const rows = page_.ranked;
    const positionStart = pages
      .slice(0, page)
      .reduce((total, previous) => total + previous.ranked.length, 0);
    const n = startN + page;
    const counter = pages.length > 1 ? ` · ${page + 1} de ${pages.length}` : "";
    return {
      n,
      id: `${section.header.territoryId}-${slug}${page > 0 ? `-${page + 1}` : ""}`,
      note: `${pad(n)} · ${section.header.label} · ${title.toLowerCase()}${counter}`,
      chapter: "territorio",
      readingMode: "study",
      family: params.family ?? "ranking-table",
      territoryId: section.header.territoryId,
      intentionalWhitespace: page_.ranked.length + page_.inventory.length <= 3,
      coverageKeys: coverageForRows(
        section.header.territoryId,
        coverageField,
        sourceRows,
        [...page_.ranked, ...page_.inventory],
      ),
      html: slide(
        head +
          `<div class="rowhead mb10"><div><h2 class="tt sm">${esc(title)}` +
          `${counter ? `<span class="sortby"> ${esc(counter.trim())}</span>` : ""}</h2>` +
          `<p class="sub sm">${esc(subtitle)}</p></div>` +
          `<div class="sortby">${esc(rankedByForceLabel(table.sortedBy))}</div></div>` +
          // Só a primeira página leva a leitura em português: repetida em cinco telas
          // ela vira ruído, e ela descreve a linha mais forte, que está na primeira.
          (rows.length > 0
            ? rankingTable(
                { ...table, rows },
                // "Cabe em" conta o mapa e continua nas dimensões declaradas. Nas
                // dimensões abertas, vindas do vídeo, `fitsCount` é adoção observada na
                // janela: escrever "5 de 18 criadores" explica o número sem uma fração
                // solta ou a promessa enganosa de mostrar nomes em "Quem fez".
                {
                  ...(OPEN_KINDS.has(table.kind)
                    ? {
                        fitsLabel: `Criadores em ${windowDays} dias`,
                        fitsMode: "creators" as const,
                      }
                    : table.kind === "asset"
                      ? {
                          fitsLabel: "Está no mapa de",
                          fitsMode: "creators" as const,
                        }
                      : {}),
                  showFits: params.showFits,
                  showViews: params.showViews,
                  viewsMax: Math.max(0, ...orderedRows.map((row) => row.medianViews ?? 0)),
                  // A densidade só cresce quando o ranking está SOZINHO na tela. Com
                  // inventário embaixo — ou com a evidência — a tabela em corpo grande
                  // empurrava tudo 123px abaixo do rodapé.
                  densidade:
                    page_.inventory.length > 0 ? "compacta" : seriesDensity,
                  positionStart,
                },
              )
            : "") +
          (page === 0 && table.reading && page_.inventory.length === 0
            ? rankingReadingBlock(orderedTable, section.header.label)
            : "") +
          inventoryBlock(
            page_.inventory,
            page > 0 && rows.length === 0 ? "Apareceu uma vez · continuação" : "Apareceu uma vez",
            once.length,
            ranked.length === 0,
            standaloneInventoryLabel(table.kind, page > 0),
            rows.length > 0,
          ) +
          // A evidência entra só na primeira página, e só quando a tabela é curta o
          // bastante para sobrar espaço. Ver evidenciaBlock().
          (page === 0 && page_.inventory.length === 0
            ? evidenciaBlock({ ...orderedTable, rows }, section.topVideos, densidadeDe(rows.length))
            : ""),
        {
          foot: [
            `Estudo · ${section.header.label} · ${title.toLowerCase()}${counter}`,
            `Semana ${week} · ${pad(n)}`,
          ],
        },
      ),
    };
  });
}

/**
 * A tela de uma tabela vazia — que precisa dizer POR QUE está vazia.
 *
 * Havia quatro telas em branco em Treino e elas acusavam o território de não ter feito
 * nada. A verdade era o contrário: os três criadores que postaram publicaram 25 vídeos,
 * e nenhum deles tem o Instagram conectado. Sem token não há mp4, sem mp4 a IA não
 * assiste, e toda tabela de cena nasce vazia por construção.
 *
 * "Não aconteceu" e "não foi lido" produzem exatamente a mesma tabela vazia e são
 * coisas opostas. Uma é um achado; a outra é uma tarefa.
 */
function emptyTableSlide(
  section: TerritorySection,
  title: string,
  subtitle: string,
): string {
  const { read, videos } = section.header.scene;
  const naoLidos = Math.max(0, videos - read);

  const explicacao =
    videos === 0
      ? `<p class="gd">Ninguém do território publicou vídeo nesta semana. Sem vídeo não há ` +
        `cena para ler — e sem cena, esta tabela não tem do que ser feita.</p>`
      : read === 0
        ? `<p class="gd"><b>Os ${videos} vídeos desta semana não puderam ser lidos.</b> ` +
          `A leitura de cena baixa o vídeo publicado pelo Instagram, e isso exige que o ` +
          `criador tenha a conta conectada ao D2C. Nenhum criador que postou neste ` +
          `território está conectado.</p>` +
          `<p class="gd mt16">Isto não é uma medição: é um ponto cego. Enquanto durar, o ` +
          `território não aparece em nenhuma tabela de cena — e o trabalho que essas ` +
          `pessoas fizeram na semana fica invisível para o grupo.</p>` +
          `<p class="note-fine mt16">Conectar a conta resolve a partir da semana seguinte, ` +
          `sem precisar refazer nada.</p>`
        : `<p class="gd">Dos ${videos} vídeos da semana, ${read} foram lidos e ` +
          `${naoLidos} não — e o que foi lido não trouxe nada nesta dimensão.</p>`;

  return (
    // `.emptywrap` mede a própria altura em vez de assumir "o cabeçalho tem 90px" —
    // esse número era certo quando foi calibrado e ficou errado assim que o cabeçalho
    // do território cresceu no redesenho (avatar, selo). Onze telas (Bem-estar,
    // Treino) estouravam pelo mesmo tanto fixo, sinal de que o erro era um número
    // parado, não o conteúdo. Flexbox mede o cabeçalho de verdade a cada render.
    `<div class="emptywrap">` +
    `<div class="rowhead mb10"><div><h2 class="tt sm">${esc(title)}</h2>` +
    `<p class="sub sm">${esc(subtitle)}</p></div>` +
    `<div class="sortby">Sem dado nesta semana</div></div>` +
    `<div class="midbox"><div class="box" style="max-width:820px">${explicacao}</div></div>` +
    `</div>`
  );
}

/**
 * As telas de um território, na ordem do DOCUMENTO.
 *
 * A ordem não é decorativa, é a ordem da conversa: primeiro quem são (narrativas),
 * depois o que deu certo (vídeos), depois o que se falou e o que apareceu em cena,
 * depois como se gravou, e só no fim quando se postou — o calendário é a pergunta
 * menos interessante e era a que vinha primeiro.
 *
 * Nenhuma tabela é cortada: toda tabela grande vira várias telas iguais. O número de
 * telas por território deixou de ser fixo e passou a depender do que o território
 * produziu, que é como tem que ser num relatório semanal.
 */
function territorySlides(
  report: WeeklyReportData,
  territoryIndex: number,
  startN: number,
): RenderedSlide[] {
  const section = report.territories[territoryIndex]!;
  const head = territoryHead(section.header);
  const week = report.cover.isoWeek;
  const pad = (value: number) => String(value).padStart(2, "0");
  const out: RenderedSlide[] = [];
  const n = () => startN + out.length;

  const push = (
    id: string,
    note: string,
    inner: string,
    footLeft: string,
    options: Partial<Pick<RenderedSlide, "readingMode" | "family" | "coverageKeys" | "repeatedCoverageKeys" | "intentionalWhitespace">> = {},
  ) => {
    const num = n();
    out.push({
      n: num,
      id: `${section.header.territoryId}-${id}`,
      note: `${pad(num)} · ${section.header.label} · ${note}`,
      chapter: "territorio",
      readingMode: options.readingMode ?? "study",
      family: options.family ?? "territory-study",
      territoryId: section.header.territoryId,
      coverageKeys: options.coverageKeys,
      repeatedCoverageKeys: options.repeatedCoverageKeys,
      intentionalWhitespace: options.intentionalWhitespace,
      html: slide(head + inner, {
        foot: [`${options.readingMode === "anchor" ? "Resumo" : "Estudo"} · ${section.header.label} · ${footLeft}`, `Semana ${week} · ${pad(num)}`],
        className: `mode-${options.readingMode ?? "study"}`,
      }),
    });
  };

  // Quando NADA foi lido, as oito tabelas de cena estão vazias pela MESMA razão, e
  // repetir a explicação oito vezes é pior que não explicar: some com o resto do
  // território. Uma tela só, e as tabelas que não dependem de cena continuam vindo.
  const pontoCego = section.header.scene.videos > 0 && section.header.scene.read === 0;

  const addTable = (
    table: RankingTableType,
    title: string,
    subtitle: string,
    slug: string,
    options: {
      sourceRows?: readonly RankingRow[];
      rankAllRows?: boolean;
      family?: string;
      showFits?: boolean;
      showViews?: boolean;
    } = {},
  ) => {
    const built = tableSlides({
      table,
      section,
      week,
      windowDays: report.meta.windowDays,
      startN: n(),
      title,
      subtitle,
      slug,
      coverageField: slug,
      ...options,
    });
    if (built.length > 0) {
      out.push(...built);
      return;
    }
    if (pontoCego) return;
    // Tabela vazia não vira tela em branco: vira a explicação de por que está vazia.
    push(slug, `${title.toLowerCase()} (vazio)`, emptyTableSlide(section, title, subtitle), title.toLowerCase());
  };

  // ── 0. Divisor ─────────────────────────────────────────────────────────────
  // Em 30+ telas o leitor precisa saber onde está. O divisor escuro é o respiro entre
  // um território e o outro, e devolve ao deck a estrutura que ele tinha com 20 telas.
  {
    const num = n();
    const h = section.header;
    out.push({
      n: num,
      id: `${h.territoryId}-abre`,
      note: `${pad(num)} · ${h.label} · abertura`,
      chapter: "territorio",
      readingMode: "divider",
      family: "territory-divider",
      territoryId: h.territoryId,
      coverageKeys: [`territory:${h.territoryId}:header`],
      intentionalWhitespace: true,
      html: slide(
        `<div class="center">` +
          `<p class="kick">Território ${territoryIndex + 1} de ${report.territories.length}</p>` +
          `<h1 class="tdiv">${esc(h.label)}</h1>` +
          `<p class="tdivsub">${plural(h.creators, "criador", "criadores")} no mapa · ` +
          `${h.creatorsWhoPosted} ${h.creatorsWhoPosted === 1 ? "postou" : "postaram"} nesta semana · ` +
          `${plural(h.narratives, "narrativa", "narrativas")}</p>` +
          `<p class="tdivscene">${h.scene.read} de ${h.scene.videos} vídeos foram lidos pela IA</p>` +
          `</div>`,
        { dark: true, foot: [`Estudo · ${h.label}`, `Semana ${week} · ${pad(num)}`] },
      ),
    });
  }

  // Página-âncora para a reunião. Ela repete achados que continuam completos nas
  // páginas de estudo seguintes.
  {
    const leituras = TERRITORY_TABLE_FIELDS.flatMap((field) => {
      const table = section[field];
      const row = table.rows[0];
      if (!table.reading || !row) return [];
      const metric = table.sortedBy;
      const value = row.metrics.find((entry) => entry.metric === metric)?.index ?? null;
      return [{ field, reading: table.reading, row, metric, value }];
    }).slice(0, 3);
    const territoryLabel = esc(section.header.label).replaceAll("/", "/<wbr>");
    const longTitleClass = section.header.label.length > 18 ? " long" : "";
    push(
      "resumo",
      "resumo para a reunião",
      `<div class="terrsummary">` +
        `<div class="terrsummary-copy"><p class="modeflag">Resumo · leitura rápida</p>` +
        `<h2 class="tt xl${longTitleClass}">O que importa em ${territoryLabel} nesta semana</h2>` +
        `<p class="terrsummary-lead">Comece pelos números da semana. Depois, veja os três resultados que mais chamaram atenção.</p>` +
        `<div class="terrsummary-stats">` +
        `<p><b>${section.header.creatorsWhoPosted}</b><span>criadores postaram</span></p>` +
        `<p><b>${section.header.scene.read}/${section.header.scene.videos}</b><span>vídeos lidos</span></p>` +
        `<p><b class="${deltaClass(section.header.engagementDeltaPct)}">${pct(section.header.engagementDeltaPct)}</b><span>engajamento</span></p>` +
        `</div></div>` +
        `<div class="terrsummary-findings"><p class="terrsummary-findings-title">O que mais chamou atenção</p>` +
        (leituras.length > 0
          ? `<div class="summary-signals">${leituras.map((item) =>
              `<article class="summary-signal"><div class="summary-signal-head">` +
              `<p>${esc(item.row.label)}</p><b>${idx(item.value)} ${esc(REPORT_METRIC_SHORT[item.metric].toLowerCase())}</b>` +
              `</div>${wideMetricBar(item.metric, item.value)}` +
              `</article>`
            ).join("")}</div>` +
            `<p class="summary-basis">Barras: multiplicador versus o post típico do território.</p>`
          // .gd (12.5px) é pequeno demais para esta família — território fino (poucos
          // criadores) é o caso que agora aciona este texto com frequência, e antes
          // ele nunca tinha sido visto de verdade. .terrsummary-empty usa a mesma
          // escala do resto da página-resumo (20px), não o corpo de texto genérico.
          : `<p class="terrsummary-empty">A semana ainda não tem lastro suficiente para destacar padrões. O estudo integral continua nas próximas páginas.</p>`) +
        `</div></div>`,
      "resumo",
      {
        readingMode: "anchor",
        family: "territory-summary",
        repeatedCoverageKeys: [
          ...leituras.flatMap((item) =>
            item.row
              ? [tableRowKey(section.header.territoryId, item.field, section[item.field].rows.indexOf(item.row))]
              : [],
          ),
        ],
      },
    );
  }

  // ── 1. Quem são ────────────────────────────────────────────────────────────
  const paginasNarrativas = chunk(section.narratives, 7);
  const paginasNarrativasOuVazia = paginasNarrativas.length > 0 ? paginasNarrativas : [[]];
  paginasNarrativasOuVazia.forEach((narrativas, pagina) => {
    const inicio = narrativas.length > 0 ? section.narratives.indexOf(narrativas[0]!) : 0;
    const ultima = pagina === paginasNarrativasOuVazia.length - 1;
    push(
      `narrativas${pagina > 0 ? `-${pagina + 1}` : ""}`,
      `narrativas${paginasNarrativasOuVazia.length > 1 ? ` · ${pagina + 1} de ${paginasNarrativasOuVazia.length}` : ""}`,
      narrativesBlock(narrativas) +
        (ultima && section.gaps.length > 0
          ? `<div class="gapsrow"><p class="sortby mb10">O que está vazio no território</p>` +
            `<div class="gapsline">` +
            section.gaps
              .map(
                (gap) =>
                  `<div class="box"><p class="gt">${esc(gap.title)}</p>` +
                  `<p class="gd">${esc(gap.detail)}</p></div>`,
              )
              .join("") +
            `</div></div>`
          : ""),
      "narrativas",
      {
        family: "narratives",
        coverageKeys: [
          ...narrativas.map((_, index) => territoryKey(section.header.territoryId, "narrative", inicio + index)),
          ...(ultima ? section.gaps.map((_, index) => territoryKey(section.header.territoryId, "gap", index)) : []),
        ],
      },
    );
  });

  // ── 2. O que deu certo ─────────────────────────────────────────────────────
  // O primeiro colocado ganha a página inteira. "Exibir os melhores vídeos é o principal
  // da reunião" e ele estava numa linha de tabela com capa de 54px.
  if (section.topVideos[0]) {
    push(
      "video-hero",
      "o vídeo da semana",
      heroVideoBlock(section.topVideos[0], section.header.label),
      "o vídeo da semana",
      {
        readingMode: "anchor",
        family: "video-hero",
        coverageKeys: [territoryKey(section.header.territoryId, "video", 0)],
      },
    );
  }

  const outrosVideos = section.topVideos.slice(1);
  chunk(outrosVideos, 4).forEach((videos, pagina, paginas) => {
    const inicio = 1 + outrosVideos.indexOf(videos[0]!);
    push(
      `videos${pagina > 0 ? `-${pagina + 1}` : ""}`,
      `melhores vídeos · ${pagina + 1} de ${paginas.length}`,
      `<div class="rowhead mb10"><div><h2 class="tt">Os outros da semana</h2>` +
        `</div>` +
        `<div class="sortby">${pagina + 1} de ${paginas.length} · engajamento</div></div>` +
        topVideosBlock(videos, inicio + 1),
      "os vídeos",
      {
        family: "video-list",
        coverageKeys: videos.map((_, index) =>
          territoryKey(section.header.territoryId, "video", inicio + index),
        ),
      },
    );
  });

  if (pontoCego) {
    push(
      "ponto-cego",
      "ponto cego",
      emptyTableSlide(section, "O que este território fez nesta semana", "E por que o relatório não consegue ver."),
      "ponto cego",
    );
  }

  // ── 3. O que se falou ──────────────────────────────────────────────────────
  addTable(
    engagementResonanceTable(section.temas),
    "Quais assuntos ressoaram mais",
    "Todos os assuntos específicos, comparados ao post típico deste território.",
    "temas",
    {
      sourceRows: section.temas.rows,
      rankAllRows: true,
      family: "topic-resonance",
      showFits: false,
    },
  );
  addTable(
    engagementResonanceTable(section.falas),
    "O que foi dito",
    "Todas as frases ditas nos vídeos, comparadas ao post típico deste território.",
    "falas",
    {
      sourceRows: section.falas.rows,
      rankAllRows: true,
      family: "quote-resonance",
      showFits: false,
    },
  );
  addTable(
    section.assuntos,
    "Assuntos, agrupados",
    "As gavetas do mapa — a versão grossa do que está nas telas anteriores.",
    "assuntos",
  );
  addTable(section.tons, "Tom de voz", "Como se falou.", "tons");

  // ── 4. O que apareceu em cena ──────────────────────────────────────────────
  addTable(
    engagementResonanceTable(section.assets),
    "Assets de vida",
    "Todos os assets observados, comparados ao post típico deste território.",
    "assets",
    {
      sourceRows: section.assets.rows,
      rankAllRows: true,
      family: "asset-resonance",
      showFits: false,
    },
  );
  addTable(
    engagementResonanceTable(section.objetos),
    "Objetos em cena",
    "Todos os objetos observados, comparados ao post típico deste território.",
    "objetos",
    {
      sourceRows: section.objetos.rows,
      rankAllRows: true,
      family: "object-resonance",
      showFits: false,
    },
  );
  // ── 5. Como foi gravado ────────────────────────────────────────────────────
  // Lugar, enquadramento e estética são a MESMA pergunta ("como isso foi gravado?") e
  // têm poucas linhas cada uma — 8, 7 e 5. Uma tela por dimensão gastava três telas
  // desperdiçando dois terços da altura em cada. Juntas, ainda ficam mais úteis: a
  // decisão é lida de uma vez, não em três páginas.
  const comoGravou: [RankingTableType, string, string][] = [
    [section.locais, "Onde", 'O cômodo, não só "em casa".'],
    [section.enquadramentos, "Enquadramento", "Como a câmera estava posicionada."],
    [section.esteticas, "Estética", "Luz, ritmo de corte, produção."],
  ];
  if (comoGravou.some(([table]) => table.rows.length > 0)) {
    const resumoKeys = comoGravou.flatMap(([table], tableIndex) => {
      const field: TerritoryTableField = (["locais", "enquadramentos", "esteticas"] as const)[tableIndex]!;
      return table.rows.slice(0, 1).map((_, index) => tableRowKey(section.header.territoryId, field, index));
    });
    push(
      "como-gravou",
      "como foi gravado",
      `<div class="rowhead mb10"><div><h2 class="tt sm">Como foi gravado</h2>` +
        `<p class="sub sm">Onde, com que enquadramento e com que luz.</p></div>` +
        `<div class="sortby">Três decisões de gravação</div></div>` +
        `<div class="recording-summary">` +
        comoGravou
          .map(
            ([table, title, sub]) => {
              const first = table.rows[0];
              const metric = first?.metrics.find((item) => item.metric === table.sortedBy);
              return `<article><p class="pt">${esc(title)}</p>` +
              (table.rows.length > 0
                ? `<p class="recording-signal">${esc(first?.label ?? "")}</p>` +
                  `<p class="recording-metric">${metric ? idx(metric.index) : "—"} ` +
                  `${esc(REPORT_METRIC_SHORT[table.sortedBy].toLowerCase())}</p>` +
                  `<p class="recording-reading">${esc(metric ? metricBasis(table.sortedBy) : sub)}</p>`
                : `<p class="recording-empty">Sem leitura nesta semana.</p>`) +
              `</article>`;
            },
          )
          .join("") +
        `</div>`,
      "como foi gravado",
      {
        readingMode: "anchor",
        family: "recording-summary",
        repeatedCoverageKeys: resumoKeys,
      },
    );
  }
  addTable(
    engagementResonanceTable(section.locais),
    "Locais",
    "Todos os locais observados, comparados ao post típico deste território.",
    "locais",
    {
      sourceRows: section.locais.rows,
      rankAllRows: true,
      family: "location-resonance",
      showFits: false,
    },
  );
  addTable(section.enquadramentos, "Enquadramentos", "Como a câmera estava posicionada.", "enquadramentos");
  addTable(section.esteticas, "Estéticas", "Luz, ritmo de corte e produção.", "esteticas");

  // ── 6. Quando se postou ────────────────────────────────────────────────────
  push(
    "numeros",
    "dia, horário e duração",
    `<div class="split11 timing">` +
      `<div class="col">` +
      `<div class="rowhead"><h2 class="tt sm">Dia e horário</h2>` +
      `<div class="sortby">Engajamento · 90 dias</div></div>` +
      `<p class="sub sm">Mais escuro, melhor. Cinza é horário sem post.</p>` +
      timeGridBlock(section.timeGrid) +
      `<p class="note-fine">Use a grade para escolher o que testar — não como regra.</p>` +
      `</div><div class="vr"></div>` +
      `<div class="col"><h2 class="tt sm">Duração</h2>` +
      `<p class="sub sm">Roxo: retenção · rosa: engajamento · abaixo: posts.</p>` +
      durationBlock(section.durations) +
      `</div></div>`,
    "dia, horário e duração",
    {
      family: "timing-visual",
      coverageKeys: [
        ...section.timeGrid.cells.map((_, index) => territoryKey(section.header.territoryId, "time-cell", index)),
        ...section.durations.map((_, index) => territoryKey(section.header.territoryId, "duration-bar", index)),
      ],
    },
  );
  addTable(
    section.horarios,
    "Horários",
    "Compare o resultado e a mediana de visualizações por post em cada dia e faixa.",
    "horarios",
    {
      rankAllRows: true,
      family: "timing-ranking",
      showFits: false,
      showViews: true,
    },
  );
  addTable(
    section.duracoes,
    "Durações",
    "Compare comentários, retenção e a mediana de visualizações por post em cada faixa.",
    "duracoes",
    {
      rankAllRows: true,
      family: "duration-ranking",
      showFits: false,
      showViews: true,
    },
  );

  // ── 7. Matriz de sinais ────────────────────────────────────────────────────
  // Era UMA tela com matriz + combinação + pautas, e os dois últimos blocos ficavam
  // 99px abaixo do rodapé — invisíveis em todos os territórios, desde sempre. As
  // pautas são a única coisa acionável do território; estavam fora da página.
  const combination = section.strongCombination;
  const paginasMatriz = matrixPages(section.matrix);
  paginasMatriz.forEach((rows, pagina) => {
    push(
      `matriz${pagina > 0 ? `-${pagina + 1}` : ""}`,
      `matriz de sinais · ${pagina + 1} de ${paginasMatriz.length}`,
      `<div class="rowhead mb10"><div><h2 class="tt sm">Matriz de sinais</h2>` +
        `<p class="sub sm">Escolha a pergunta na esquerda, depois a coluna do que você quer. ` +
        `As células escuras são as respostas.</p></div>` +
        `<div class="sortby">${pagina + 1} de ${paginasMatriz.length} · escuro = forte</div></div>` +
        matrixBlock(rows, MATRIX_COLUMNS) +
        (() => {
          const strongest = rows.flatMap((row) => row.cells.map((cell) => ({ row, cell })))
            .sort((a, b) => b.cell.index - a.cell.index)[0];
          return strongest
            ? `<p class="matrix-reading"><b>${esc(strongest.row.label)}</b> é o sinal mais forte desta página: ` +
              `${idx(strongest.cell.index)} em ${esc(REPORT_METRIC_LABELS[strongest.cell.metric].toLowerCase())}.</p>`
            : "";
        })(),
      "matriz de sinais",
      {
        family: "matrix",
        coverageKeys: rows.map((row) =>
          territoryKey(section.header.territoryId, "matrix", section.matrix.indexOf(row))),
      },
    );
  });

  // A abertura reserva metade do slide para a combinação mais forte e recebe três
  // pautas. As continuações usam a largura inteira, em duas colunas, com até quatro.
  // O `slice(3)` não descarta conteúdo: todo o restante entra em páginas de continuação.
  const paginasPautas = section.pautas.length > 0
    ? [section.pautas.slice(0, 3), ...chunk(section.pautas.slice(3), 4)]
    : [];
  const paginasPautasOuVazia = paginasPautas.length > 0 ? paginasPautas : [[]];
  paginasPautasOuVazia.forEach((pautas, pagina) => {
    const inicio = pautas.length > 0 ? section.pautas.indexOf(pautas[0]!) : 0;
    const mostraCombinacao = pagina === 0;
    const pautaItems = pautas.length > 0
      ? pautas.map((pauta, pautaIndex) =>
        `<p><b>${String(inicio + pautaIndex + 1).padStart(2, "0")} · ${esc(pauta.narrative)}</b>` +
        `<br>${esc(pauta.headline)}` +
        (pauta.source
          ? `<span class="pautabase">Base: ${idx(pauta.source.index)} ` +
            `${esc(REPORT_METRIC_LABELS[pauta.source.metric].toLowerCase())} · ` +
            `${esc(EVIDENCE_LABEL[pauta.source.evidence])}</span>`
          : "") +
        `</p>`,
      ).join("")
      : "";
    push(
      `pautas${pagina > 0 ? `-${pagina + 1}` : ""}`,
      `combinação e pautas · ${pagina + 1} de ${paginasPautasOuVazia.length}`,
      `<div class="rowhead mb10"><div><h2 class="tt sm">O que dá para tentar</h2>` +
        `<p class="sub sm">Sinais positivos da semana transformados em sugestões para cada narrativa.</p>` +
        `</div><div class="sortby">${pagina + 1} de ${paginasPautasOuVazia.length}</div></div>` +
        (mostraCombinacao
          ? `<div class="split11 afterhead pauta-spacious">` +
            `<div><p class="pt">A combinação mais forte</p>` +
            (combination
              ? `<p class="combo">${esc(combination.elements.join(" · "))}</p>` +
                `<p class="combometa">${esc(
                  combination.metrics.map((m) => `${REPORT_METRIC_SHORT[m.metric]} ${idx(m.index)}`).join(" · "),
                )} · visto ${combination.occurrences} vezes com ` +
                `${plural(combination.creators, "criador", "criadores")} · ` +
                `${esc(combination.windowLabel)}</p>`
              : `<p class="combometa">Nenhuma combinação de três elementos teve amostra suficiente nos últimos 90 dias.</p>`) +
            `</div><div class="vr"></div>` +
            `<div><p class="pt">Pautas · uma por narrativa</p>` +
            (pautaItems
              ? `<div class="pautas">${pautaItems}</div>`
              : `<p class="combometa">As pautas entram quando o território tiver narrativas registradas.</p>`) +
            `</div></div>`
          : `<div class="afterhead pauta-cont">` +
            `<div class="pauta-cont-head"><p class="pt">Pautas · uma por narrativa</p>` +
            `<p>Cada proposta cruza uma narrativa do mapa com um sinal positivo da semana. ` +
            `Use como hipótese de criação, não como receita.</p></div>` +
            `<div class="pautas pautas-grid">${pautaItems}</div></div>`),
      "combinação e pautas",
      {
        family: "opportunities",
        coverageKeys: [
          ...(mostraCombinacao && combination ? [`territory:${section.header.territoryId}:combination`] : []),
          ...pautas.map((_, index) => territoryKey(section.header.territoryId, "pauta", inicio + index)),
        ],
      },
    );
  });

  return out;
}

/**
 * OS DESTAQUES DA SEMANA — três telas, no topo do relatório.
 *
 * Eram seis linhas de tabela na penúltima tela: "Destaque do território · Débora Broch
 * Machado · Maternidade · 3,8× a própria média". Um quadro de avisos. Não dizia de QUÊ
 * a pessoa foi destaque, não tinha rosto, e ficava depois de quarenta telas de tabela.
 *
 * O dado para fazer melhor sempre esteve carregado: `collectHighlights` calculava o
 * post vencedor e o descartava na última linha. Agora ele vem junto, com capa, link e
 * gancho — e a seção sobe para logo depois do "Como ler", porque é o que a maioria vai
 * ler primeiro e talvez o único que algumas pessoas leiam inteiro.
 */
const HIGHLIGHT_VISUAL: Record<string, { symbol: string; color: string; text: string; tint: string; ink: string; slug: string }> = {
  destaque_do_territorio: { symbol: "★", color: "#C64A70", text: "#9F3658", tint: "#F3E1E7", ink: "#14120F", slug: "territorio" },
  video_da_comunidade: { symbol: "↗", color: "#4D7F9A", text: "#386A84", tint: "#E2EBEF", ink: "#14120F", slug: "comunidade" },
  frase_da_semana: { symbol: "“", color: "#76618E", text: "#655078", tint: "#E9E4ED", ink: "#14120F", slug: "frase" },
  coragem: { symbol: "⚡", color: "#9A7937", text: "#775B25", tint: "#EEE7D9", ink: "#14120F", slug: "coragem" },
  consistencia: { symbol: "7/7", color: "#587965", text: "#41614F", tint: "#E2EAE5", ink: "#14120F", slug: "consistencia" },
  virada: { symbol: "↻", color: "#B86557", text: "#984D42", tint: "#F1E3E0", ink: "#14120F", slug: "virada" },
};

function creatorInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

const COVER_AWARD_LABEL: Record<Highlight["kind"], string> = {
  destaque_do_territorio: "Destaque",
  video_da_comunidade: "Comunidade",
  frase_da_semana: "Frase da semana",
  coragem: "Coragem",
  consistencia: "Consistência",
  virada: "Virada",
};

/** A capa apresenta as pessoas — o conteúdo premiado fica nos slides do Hall. */
function coverPortrait(highlight: Highlight, index: number): string {
  const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
  const avatar = highlight.creatorAvatarUrl;
  const portrait = avatar
    ? `<span class="coverperson-image" style="background-image:url('${esc(avatar)}')"></span>`
    : `<span class="coverperson-image fallback">${esc(creatorInitials(highlight.creatorName))}</span>`;

  return (
    `<article class="coverperson" style="--award:${esc(visual.color)};--award-text:${esc(visual.text)}">` +
      `<div class="coverperson-photo">${portrait}` +
        `<span class="coverperson-emblem">${esc(visual.symbol)}</span>` +
        `<span class="coverperson-index">${String(index + 1).padStart(2, "0")}</span>` +
      `</div>` +
      `<p>${esc(COVER_AWARD_LABEL[highlight.kind])}</p>` +
      `<h2>${esc(highlight.creatorName)}</h2>` +
    `</article>`
  );
}

function awardMedia(highlight: Highlight): string {
  const post = highlight.post;
  const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
  if (post?.thumbnailUrl) {
    return `<div class="awardmedia thumbnail" style="background-image:url('${esc(post.thumbnailUrl)}')"></div>`;
  }
  if (highlight.creatorAvatarUrl) {
    return `<div class="awardmedia avatar" style="background-image:url('${esc(highlight.creatorAvatarUrl)}')"></div>`;
  }
  return `<div class="awardmedia graphic"><span>${esc(creatorInitials(highlight.creatorName))}</span><b>${esc(visual.symbol)}</b></div>`;
}

function awardFeature(highlight: Highlight, position: number, total: number, week: number): string {
  const post = highlight.post;
  const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
  const hook = post?.openingLine ?? post?.screenTitle;

  return (
    `<div class="awardnav"><span>Hall da Semana · semana ${week}</span>` +
    `<b>${String(position).padStart(2, "0")} / ${String(total).padStart(2, "0")}</b></div>` +
    `<div class="awardfeature award-${esc(visual.slug)}${highlight.kind === "frase_da_semana" ? " quote" : ""}" ` +
    `style="--award:${esc(visual.color)};--award-text:${esc(visual.text)};--award-tint:${esc(visual.tint)};--award-ink:${esc(visual.ink)}">` +
    `<div class="awardmediawrap">${awardMedia(highlight)}</div>` +
    `<div class="awardcopy">` +
    `<p class="awardlabel"><span>${esc(visual.symbol)}</span>${esc(highlight.label)}${highlight.territoryLabel ? ` · ${esc(highlight.territoryLabel)}` : ""}</p>` +
    `<div class="awardperson">` +
    (highlight.creatorAvatarUrl
      ? `<span class="awardavatar" style="background-image:url('${esc(highlight.creatorAvatarUrl)}')"></span>`
      : `<span class="awardavatar fallback">${esc(creatorInitials(highlight.creatorName))}</span>`) +
    `<div><h2>${esc(highlight.creatorName)}</h2>` +
    (highlight.creatorHandle
      ? `<a class="awardhandle" href="https://instagram.com/${esc(highlight.creatorHandle)}">@${esc(highlight.creatorHandle)}</a>`
      : "") +
    `</div></div>` +
    `<p class="awardresult">${esc(highlight.result)}</p>` +
    (highlight.plain ? `<p class="awardplain">${esc(highlight.plain)}</p>` : "") +
    (hook ? `<div class="awardstudy"><p>O que estudar neste conteúdo</p><blockquote>${highlight.kind === "frase_da_semana" ? "" : "“"}${esc(hook)}${highlight.kind === "frase_da_semana" ? "" : "”"}</blockquote></div>` : "") +
    (post?.elements.length ? `<p class="awardelements">${esc(post.elements.join(" · "))}</p>` : "") +
    (post?.link ? `<a class="awardcta" href="${esc(post.link)}">Assistir ao Reel ↗</a>` : "") +
    `</div></div>`
  );
}

function awardRosterItem(highlight: Highlight): string {
  const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
  return (
    `<article class="rosteritem" style="--award:${esc(visual.color)};--award-text:${esc(visual.text)};--award-tint:${esc(visual.tint)}">` +
    (highlight.creatorAvatarUrl
      ? `<span class="rosteravatar" style="background-image:url('${esc(highlight.creatorAvatarUrl)}')"></span>`
      : `<span class="rosteravatar fallback">${esc(creatorInitials(highlight.creatorName))}</span>`) +
    `<div><p class="rosteraward"><span>${esc(visual.symbol)}</span>${esc(highlight.label)}</p>` +
    `<h3>${esc(highlight.creatorName)}</h3>` +
    (highlight.creatorHandle ? `<p class="rosterhandle">@${esc(highlight.creatorHandle)}</p>` : "") +
    `<p class="rosterresult">${esc(highlight.result)}</p></div></article>`
  );
}

function highlightSlides(report: WeeklyReportData, startN: number): RenderedSlide[] {
  const out: RenderedSlide[] = [];
  const week = report.cover.isoWeek;
  const pad = (v: number) => String(v).padStart(2, "0");
  const push = (
    id: string,
    note: string,
    inner: string,
    footLeft: string,
    dark = false,
    options: Partial<Pick<RenderedSlide, "readingMode" | "family" | "coverageKeys" | "repeatedCoverageKeys" | "intentionalWhitespace">> = {},
  ) => {
    const num = startN + out.length;
    out.push({
      n: num,
      id,
      note: `${pad(num)} · ${note}`,
      chapter: "hall",
      readingMode: options.readingMode ?? "anchor",
      family: options.family ?? "hall",
      coverageKeys: options.coverageKeys,
      repeatedCoverageKeys: options.repeatedCoverageKeys,
      intentionalWhitespace: options.intentionalWhitespace,
      html: slide(inner, {
        dark,
        foot: [footLeft, `Semana ${week} · ${pad(num)}`],
        className: `mode-${options.readingMode ?? "anchor"}`,
      }),
    });
  };

  // Abertura escura, como a de um território: a seção tem peso próprio.
  push(
    "destaques-abre",
    "destaques da semana",
    `<div class="center">` +
      `<p class="kick">Os destaques</p>` +
      `<h1 class="tdiv">${plural(report.highlights.length, "destaque", "destaques")}<br>desta semana</h1>` +
      `<p class="tdivsub">Cada prêmio compara a pessoa com ela mesma, não com as outras.</p>` +
      `<p class="tdivscene">Quem foi destaque não concorre na semana seguinte, ` +
      `para o destaque circular</p>` +
      `</div>`,
    "os destaques",
    true,
    { readingMode: "divider", family: "hall-divider", intentionalWhitespace: true },
  );

  // Um prêmio por página. A capa do Reel mantém o 9:16 nativo e a pessoa recebe espaço
  // de homenagem, explicação e estudo sem disputar atenção com outro vencedor.
  report.highlights.forEach((highlight, index) => {
    const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
    push(
      `destaques-${visual.slug}-${index + 1}`,
      `${highlight.label.toLowerCase()} · ${highlight.creatorName}`,
      awardFeature(highlight, index + 1, report.highlights.length, week),
      "Hall da Semana",
      false,
      {
        family: "award-feature",
        coverageKeys: [`highlight:${index}`],
      },
    );
  });

  // Panorama humano: as fotos de perfil devolvem a autoria que uma lista de nomes perde.
  if (report.highlights.length > 0) {
    push(
      "destaques-vencedores",
      "quem levou os prêmios",
      `<div class="rowhead"><div><p class="modeflag">Hall da Semana</p>` +
      `<h2 class="tt xl">Quem levou os prêmios</h2>` +
      `<p class="sub">Um panorama dos criadores reconhecidos nesta semana.</p></div></div>` +
      `<div class="rostercols">${report.highlights.map(awardRosterItem).join("")}</div>`,
      "Vencedores da semana",
      false,
      {
        family: "award-roster",
        repeatedCoverageKeys: report.highlights.map((_, index) => `highlight:${index}`),
      },
    );
  }

  const EMBLEMAS: { kind: string; nome: string; criterio: string }[] = [
    {
      kind: "destaque_do_territorio",
      nome: "Destaque do território",
      criterio: "Superar a própria média com força dentro do território.",
    },
    {
      kind: "video_da_comunidade",
      nome: "Vídeo da comunidade",
      criterio: "Gerar compartilhamento e vontade de fazer o conteúdo circular.",
    },
    {
      kind: "frase_da_semana",
      nome: "A frase da semana",
      criterio: "Transformar uma fala real do vídeo em memória coletiva.",
    },
    {
      kind: "coragem",
      nome: "Coragem",
      criterio: "Experimentar um jeito novo de gravar, falar ou construir a cena.",
    },
    { kind: "consistencia", nome: "Consistência", criterio: "Sustentar presença em quatro dias ou mais da semana." },
    { kind: "virada", nome: "Virada", criterio: "Retomar a criação depois de três semanas sem publicar." },
  ];

  push(
    "destaques-emblemas",
    "como funcionam os seis prêmios",
    `<div class="rowhead mb10"><div><h2 class="tt">Os seis prêmios</h2>` +
      `<p class="sub">O que cada reconhecimento celebra.</p></div>` +
      `</div>` +
      `<div class="awardcriteria">` +
      EMBLEMAS.map((emblema) => {
        const visual = HIGHLIGHT_VISUAL[emblema.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;
        return (
          `<article style="--award:${esc(visual.color)};--award-text:${esc(visual.text)};--award-tint:${esc(visual.tint)}">` +
          `<p class="criterionname"><span>${esc(visual.symbol)}</span>${esc(emblema.nome)}</p>` +
          `<p>${esc(emblema.criterio)}</p></article>`
        );
      }).join("") +
      `</div>` +
      // As regras do rodízio e da régua de entrada ficam aqui, e não escondidas no
      // código: dizer "as vagas reabrem toda semana" é o que faz a lista parecer aberta.
      `<div class="regras">` +
      `<p><b>Quem foi destaque não concorre na semana seguinte</b>, para o destaque circular.</p>` +
      `<p><b>Para concorrer:</b> 5 posts nos últimos 90 dias — abaixo disso não dá para ` +
      `calcular a sua média, e todos os prêmios comparam a pessoa com a própria média.</p>` +
      `</div>`,
    "os seis prêmios",
    false,
    {
      readingMode: "study",
      family: "award-guide",
    },
  );

  return out;
}

function predictionSlide(report: WeeklyReportData, n: number): RenderedSlide {
  const prediction = report.prediction;
  const blocks = report.meeting.blocks
    .map(
      (block) =>
        `<tr><td><div class="it light">${esc(block.label)}</div></td>` +
        `<td class="mins">${block.minutes} min</td>` +
        `<td class="fit ${block.audience === "todos" ? "light" : "pink"}">` +
        `${block.audience === "todos" ? "Todo mundo" : "Assinantes"}</td></tr>`,
    )
    .join("");

  return {
    n,
    id: "previsao",
    note: `${String(n).padStart(2, "0")} · previsão + reunião`,
    chapter: "fechamento",
    readingMode: "anchor",
    family: "prediction",
    coverageKeys: ["meeting", ...(prediction ? ["prediction"] : [])],
    html: slide(
      `<div class="thead"><div class="nm">A previsão da semana ${report.cover.isoWeek}</div>` +
        `<div class="meta">O resultado abre o relatório da próxima segunda</div></div>` +
        `<div class="split11 mid">` +
        `<div><p class="pt">O que a gente espera ver</p>` +
        (prediction
          ? `<p class="predbig">${esc(prediction.statement)}</p>` +
            (prediction.caveat ? `<p class="predcav">${esc(prediction.caveat)}</p>` : "")
          : emptyNote(
              "A previsão desta semana é escrita na composição do relatório e medida " +
                "automaticamente na semana seguinte.",
            )) +
        `</div><div class="vr dark"></div>` +
        `<div><p class="pt">${esc(report.meeting.weekdayLabel)} · ${esc(report.meeting.timeLabel)}</p>` +
        `<table class="rk mt14"><tr><th>Bloco</th><th>Tempo</th>` +
        `<th style="text-align:right">Quem entra</th></tr>${blocks}</table>` +
        `<p class="predcav mt16">Os primeiros ${report.meeting.blocks[0]?.minutes ?? 20} minutos ` +
        `são abertos a todo mundo.</p></div></div>`,
      { dark: true, foot: ["Previsão e reunião", `Semana ${report.cover.isoWeek} · ${String(n).padStart(2, "0")}`] },
    ),
  };
}

/**
 * Monta os slides na ordem do §5: capa, visão geral, 4 por território, comparação,
 * destaques, previsão. Com 4 territórios dá exatamente 21.
 */
/**
 * Como ler o relatório. Existia só no documento e faltava no deck.
 *
 * Não é enfeite: sem esta tela, "2,3×" é um símbolo sem régua. A unidade muda por
 * métrica (por pessoa alcançada / contra o esperado da duração / contra o próprio
 * criador) e o lastro muda por linha, e nada disso se adivinha olhando a tabela.
 */
function howToReadSlide(report: WeeklyReportData, n: number): RenderedSlide {
  const pad = String(n).padStart(2, "0");
  return {
    n,
    id: "como-ler",
    note: `${pad} · como ler este relatório`,
    chapter: "abertura",
    readingMode: "anchor",
    family: "method",
    html: slide(
      `<div class="rowhead"><div><h2 class="tt">Como ler uma linha</h2>` +
        `<p class="sub">Identifique o elemento, compare com 1,0× e confira o lastro.</p></div></div>` +
        `<div class="method-hero">` +
        `<div class="method-example"><p class="method-kicker">Elemento</p>` +
        `<p class="method-topic">Casa</p></div>` +
        `<div class="method-scale">${wideMetricBar("comentarios", 2.3)}` +
        `<div class="method-scale-labels"><span>abaixo</span><b>1,0× = normal</b><span>acima</span></div></div>` +
        `<div class="method-number"><b>2,3×</b><span>comentários por pessoa alcançada</span></div>` +
        `</div>` +
        `<p class="method-reading">Posts com <b>Casa</b> geraram <b>2,3×</b> o nível normal de comentários.</p>` +
        `<div class="method-keys">` +
        `<article><p class="method-index">01</p><h3>Elemento</h3>` +
        `<p><b>Casa</b> apareceu no vídeo.</p></article>` +
        `<article><p class="method-index">02</p><h3>Resultado</h3>` +
        `<p><b>1,0×</b> é o padrão; <b>2,3×</b> ficou acima dele.</p></article>` +
        `<article><p class="method-index">03</p><h3>Lastro</h3>` +
        `<p><b>Sinal</b> · 4 aparições · 3 criadores.</p></article>` +
        `</div>` +
        `<div class="method-footer"><p>Indício: 1–2 · Sinal: 3–7 · Tendência: 8+ e coletiva</p>` +
        `<p>Mapa = repertório · semana = desempenho observado</p></div>`,
      { foot: ["como ler este relatório", `Semana ${report.cover.isoWeek} · ${pad}`] },
    ),
  };
}

function weeklyIntelligenceSlides(report: WeeklyReportData, startN: number): RenderedSlide[] {
  const pad = (value: number) => String(value).padStart(2, "0");
  const territoryFindings = report.territories.map((section) => {
    const source = TERRITORY_TABLE_FIELDS.map((field) => section[field]).find((table_) => Boolean(table_.reading));
    const first = source?.rows[0];
    const metric = source?.sortedBy ?? "comentarios";
    const value = first?.metrics.find((entry) => entry.metric === metric)?.index ?? null;
    return {
      territory: section.header.label,
      reading: source?.reading ?? "Ainda sem lastro para um achado coletivo nesta semana.",
      topic: first?.label ?? "Leitura da semana",
      metric,
      value,
    };
  });
  const lowerByTerritory = report.territories.map((section) => ({
    territory: section.header.label,
    items: INTELLIGENCE_CAUTION_FIELDS.flatMap((field) => {
      const table = section[field];
      return table.rows.filter((row) => row.pullsDown).slice(0, 1).map((row) => ({
        territory: section.header.label,
        label: row.label,
        kind: INTELLIGENCE_CAUTION_LABELS[field],
        metric: table.sortedBy,
        value: row.metrics.find((entry) => entry.metric === table.sortedBy)?.index ?? null,
      }));
    }),
  }));
  const lowerSignals: {
    territory: string;
    label: string;
    kind: string;
    metric: ReportMetric;
    value: number | null;
  }[] = [];
  for (let round = 0; lowerSignals.length < 5; round += 1) {
    let added = false;
    for (const territory of lowerByTerritory) {
      const item = territory.items[round];
      if (!item) continue;
      lowerSignals.push(item);
      added = true;
      if (lowerSignals.length === 5) break;
    }
    if (!added) break;
  }
  // Um achado por território, num artigo rico (título + duas barras) — media ~103px
  // de altura cada. Cabia numa tela só até uns 5 territórios; sem teto, uma semana de
  // 13 estourava por 788px. 4 por página é o que sobra de espaço depois do cabeçalho.
  const findingPages = chunk(territoryFindings, 4);
  const out: RenderedSlide[] = [];
  const nextN = () => startN + out.length;
  findingPages.forEach((pageFindings, page) => {
    const num = nextN();
    const counter = findingPages.length > 1 ? ` · ${page + 1} de ${findingPages.length}` : "";
    out.push({
      n: num,
      id: `inteligencia-achados${page > 0 ? `-${page + 1}` : ""}`,
      note: `${pad(num)} · principais achados${counter}`,
      chapter: "inteligencia",
      readingMode: "anchor",
      family: "intelligence-summary",
      html: slide(
        `<div class="rowhead"><div><p class="modeflag">Resumo · inteligência geral</p>` +
          `<h2 class="tt xl">Os achados que merecem a conversa${counter ? `<span class="sortby"> ${esc(counter.trim())}</span>` : ""}</h2></div></div>` +
          `<div class="findinglist">${pageFindings.map((finding, index) =>
            `<article><div class="findingnumber">${String(page * 4 + index + 1).padStart(2, "0")}</div>` +
            `<div class="findingcopy"><p class="pt">${esc(finding.territory)}</p>` +
            `<h3>${esc(finding.topic)}</h3><p class="findingbasis">${esc(metricBasis(finding.metric))}</p></div>` +
            `<div class="findingmeter"><div><span>Post típico</span>${wideMetricBar(finding.metric, 1)}<b>1,0×</b></div>` +
            `<div class="current"><span>Este assunto</span>${wideMetricBar(finding.metric, finding.value)}<b>${idx(finding.value)}</b></div></div></article>`,
          ).join("")}</div>`,
        { foot: [`Principais achados${counter}`, `Semana ${report.cover.isoWeek} · ${pad(num)}`], className: "mode-anchor" },
      ),
    });
  });
  const secondN = nextN();
  const thirdN = secondN + 1;
  out.push(
    {
      n: secondN,
      id: "inteligencia-padroes",
      note: `${pad(secondN)} · padrões entre territórios`,
      chapter: "inteligencia",
      readingMode: "anchor",
      family: "intelligence-patterns",
      html: slide(
        `<div class="rowhead"><div><p class="modeflag">Resumo · inteligência geral</p>` +
          `<h2 class="tt xl">O mesmo elemento muda de força entre territórios</h2>` +
          `<p class="sub">Um padrão não é uma fórmula universal.</p></div></div>` +
          (report.crossTerritory.length > 0
            ? `<div class="patternlist">${report.crossTerritory.slice(0, 5).map((row, index) =>
              `<article><span>${String(index + 1).padStart(2, "0")}</span>` +
              `<h3>${esc(row.label)}</h3><p>${esc(row.reading ?? "Compare os multiplicadores no estudo completo.")}</p></article>`,
            ).join("")}</div>`
            : `<p class="gd mt16">Nenhum elemento cruzou territórios com lastro suficiente.</p>`),
        { foot: ["Padrões entre territórios", `Semana ${report.cover.isoWeek} · ${pad(secondN)}`], className: "mode-anchor" },
      ),
    },
    {
      n: thirdN,
      id: "inteligencia-cautelas",
      note: `${pad(thirdN)} · cautelas e oportunidade`,
      chapter: "inteligencia",
      readingMode: "anchor",
      family: "intelligence-cautions",
      html: slide(
          `<div class="rowhead"><div><p class="modeflag">Resumo · inteligência geral</p>` +
          `<h2 class="tt xl">O que rendeu menos — e o próximo teste</h2>` +
          `<p class="sub">São duas leituras diferentes: primeiro, resultados desta semana; no fim, uma sugestão para experimentar.</p></div></div>` +
          (lowerSignals.length > 0
            ? `<section class="cautionsection"><div class="cautionintro"><div>` +
              `<p>01 · O QUE FICOU ABAIXO DO NORMAL</p><h3>Não são sugestões de pauta.</h3></div>` +
              `<span>São elementos de posts que renderam menos de 1,0× — o resultado típico do próprio território.</span></div>` +
              `<div class="cautionhead"><span>Território</span><span>Tipo</span><span>O que apareceu</span><span>Resultado</span></div>` +
              `<div class="cautionlist">${lowerSignals.map((item) =>
                `<article><p>${esc(item.territory)}</p><span>${esc(item.kind)}</span><h3>${esc(item.label)}</h3>` +
                `<div><b>${idx(item.value)}</b><small>${esc(REPORT_METRIC_LABELS[item.metric])}</small></div></article>`,
              ).join("")}</div></section>`
            : `<section class="cautionempty"><p>01 · RESULTADOS DA SEMANA</p>` +
              `<h3>Nenhum elemento ficou abaixo do resultado típico com lastro suficiente.</h3></section>`) +
          (report.prediction ? `<div class="opportunityline"><div><p>02 · PAUTA PARA TESTAR NA PRÓXIMA SEMANA</p>` +
            `<span>É um experimento sugerido pelo relatório, ainda não um resultado comprovado.</span></div>` +
            `<h3>${esc(report.prediction.statement)}</h3></div>` : ""),
        { foot: ["Resultados abaixo do normal e próximo teste", `Semana ${report.cover.isoWeek} · ${pad(thirdN)}`], className: "mode-anchor" },
      ),
    },
  );
  return out;
}

function intelligenceDividerSlide(report: WeeklyReportData, n: number): RenderedSlide {
  const pad = String(n).padStart(2, "0");
  return {
    n,
    id: "inteligencia-abre",
    note: `${pad} · inteligência geral`,
    chapter: "inteligencia",
    readingMode: "divider",
    family: "intelligence-divider",
    intentionalWhitespace: true,
    html: slide(
      `<div class="center"><p class="kick">Inteligência geral</p>` +
      `<h1 class="tdiv">O que a semana<br>está ensinando</h1>` +
      `<p class="tdivsub">Achados para a reunião, comparação coletiva e oportunidades para testar.</p></div>`,
      { dark: true, foot: ["Inteligência geral", `Semana ${report.cover.isoWeek} · ${pad}`] },
    ),
  };
}

function reportMapSlide(report: WeeklyReportData, n: number, slides: readonly RenderedSlide[]): RenderedSlide {
  const chapterNames: Record<NonNullable<RenderedSlide["chapter"]>, string> = {
    abertura: "Abertura e panorama",
    hall: "Hall da Semana",
    inteligencia: "Inteligência geral",
    territorio: "Estudo por território",
    fechamento: "Previsão e reunião",
  };
  const ordered: NonNullable<RenderedSlide["chapter"]>[] = ["abertura", "hall", "inteligencia", "territorio", "fechamento"];
  const ranges = ordered.flatMap((chapter) => {
    const found = slides.filter((item) => item.chapter === chapter);
    return found.length > 0 ? [{ chapter, pages: found.map((item) => item.n) }] : [];
  });
  const mapEntries = ranges.flatMap((range, chapterIndex) => {
    const chapterEntry = { label: chapterNames[range.chapter], pages: range.pages, child: false, order: chapterIndex + 1 };
    if (range.chapter !== "territorio") return [chapterEntry];
    const territories = report.territories.flatMap((section) => {
      const pages = slides
        .filter((item) => item.territoryId === section.header.territoryId)
        .map((item) => item.n);
      return pages.length > 0 ? [{ label: section.header.label, pages, child: true, order: chapterIndex + 1 }] : [];
    });
    return [chapterEntry, ...territories];
  });
  return {
    n,
    id: "mapa",
    note: `${String(n).padStart(2, "0")} · mapa do relatório`,
    chapter: "abertura",
    readingMode: "anchor",
    family: "report-map",
    html: slide(
      `<div class="rowhead"><div><p class="modeflag">Navegação</p><h2 class="tt xl">Mapa do relatório</h2>` +
        `<p class="sub">${slides.length + 1} páginas. A extensão acompanha a densidade da semana.</p></div></div>` +
        // A lista tem uma linha por capítulo + uma por território. Era dimensionada
        // para ~4 territórios (9 linhas); sem teto de território, uma semana rica
        // pode ter 13+ territórios (18+ linhas) e a lista no tamanho antigo passava
        // por cima do rodapé. Densidade: mesma ideia de densidadeDe(), aplicada aqui.
        `<div class="maplist${mapEntries.length > 13 ? " dense" : mapEntries.length > 9 ? " compact" : ""}">${mapEntries.map((entry) =>
          `<div class="${entry.child ? "mapchild" : ""}"><span>${entry.child ? "↳" : String(entry.order).padStart(2, "0")}</span>` +
          `<b>${esc(entry.label)}</b><em>${padRanges(entry.pages)}</em></div>`,
        ).join("")}</div>` +
        `<p class="note-fine mt20">Dentro de cada território: resumo, narrativas, vídeos, temas, frases, assuntos, tom, assets, objetos, locais, enquadramentos, estéticas, horários, durações, matriz, combinações, pautas e lacunas.</p>`,
      { foot: ["Mapa do relatório", `Semana ${report.cover.isoWeek} · ${String(n).padStart(2, "0")}`], className: "mode-anchor" },
    ),
  };
}

function padRange(first: number, last: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return first === last ? pad(first) : `${pad(first)}—${pad(last)}`;
}

function padRanges(pages: readonly number[]): string {
  const ranges: string[] = [];
  let start = pages[0];
  let previous = pages[0];
  for (const page of pages.slice(1)) {
    if (previous !== undefined && page === previous + 1) {
      previous = page;
      continue;
    }
    if (start !== undefined && previous !== undefined) ranges.push(padRange(start, previous));
    start = page;
    previous = page;
  }
  if (start !== undefined && previous !== undefined) ranges.push(padRange(start, previous));
  return ranges.join(" · ");
}

export function buildSlides(report: WeeklyReportData): RenderedSlide[] {
  // A página 2 é calculada por último, quando as faixas reais dos capítulos existem.
  const cover = coverSlide(report, 1);
  const slides: RenderedSlide[] = [howToReadSlide(report, 3)];
  let n = 4;
  const overview = overviewSlide(report, n);
  slides.push(...overview);
  n += overview.length;
  const hall = highlightSlides(report, n);
  slides.push(...hall);
  n += hall.length;
  slides.push(intelligenceDividerSlide(report, n));
  n += 1;
  const intelligence = weeklyIntelligenceSlides(report, n);
  slides.push(...intelligence);
  n += intelligence.length;
  for (let index = 0; index < report.territories.length; index += 1) {
    // O número de telas por território deixou de ser fixo em 5: depende de quantas
    // linhas o território produziu. Contar o que voltou, em vez de somar 5, é o que
    // mantém a numeração e o rodapé honestos.
    const built = territorySlides(report, index, n);
    slides.push(...built);
    n += built.length;
  }
  slides.push(predictionSlide(report, n));
  const allWithoutMap = [cover, ...slides];
  const built = [cover, reportMapSlide(report, 2, allWithoutMap), ...slides];
  // A classe de modo é um contrato visual, não uma responsabilidade opcional de cada
  // template. Aplicá-la aqui impede que uma nova família nasça sem Resumo/Estudo.
  return built.map((slide_) => {
    if (slide_.readingMode !== "anchor" && slide_.readingMode !== "study") return slide_;
    const modeClass = `mode-${slide_.readingMode}`;
    if (slide_.html.includes(modeClass)) return slide_;
    return { ...slide_, html: slide_.html.replace('<div class="slide', `<div class="slide ${modeClass}`) };
  });
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Sans:wdth,wght@75..100,400..700&family=JetBrains+Mono:wght@400;500;700&display=swap');
:root{
  --paper:#F8F5F0; --ink:#14120F; --dark:#15120F;
  --pink:#F0286E; --blue:#3E7FA8; --green:#3F9673; --gold:#C08A1E; --purple:#7B57B5;
  --pink-text:#B9144D; --blue-text:#276486; --green-text:#256A50; --gold-text:#76500B;
  --gray:#5F5954; --gray2:#6B6560; --rule:#DCD5CA; --ruled:#332C26; --track:#E5DED3;
}
*{box-sizing:border-box;margin:0;padding:0}
.hcwho{display:flex;align-items:center;gap:11px;margin-top:8px}
.hcava{width:44px;height:44px;flex:none;border-radius:50%;background-size:cover;
  background-position:center;background-color:var(--track)}
.hcava.vazia{border:1px solid var(--rule)}
.hcperfil{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:10px;
  letter-spacing:.06em;color:var(--pink-text);font-weight:700;text-decoration:none;margin-top:3px}
td.pos{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--gray2);
  vertical-align:top;padding-top:2px;width:34px}
table.rk.d-ampla td.pos{font-size:19px}
tr.low td.pos{color:var(--gray2)}
.invlist.solta{column-gap:34px;list-style:none;margin-top:22px}
.invlist.solta li{line-height:1.48;break-inside:avoid;padding-left:14px;
  position:relative;margin-bottom:3px}
.invlist.solta li::before{content:"·";position:absolute;left:0;color:var(--gray2)}
.evid{display:flex;align-items:center;gap:20px;margin-top:16px;border-top:1px solid var(--rule);
  padding-top:12px}
.evimg{width:92px;height:120px;flex:none;border-radius:4px;background-size:cover;
  background-position:center;background-color:var(--track)}
.evtxt{flex:1;min-width:0}
.evlabel{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.evname{font-size:20px;font-weight:700;letter-spacing:-.015em;margin-top:6px}
.evname span{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;
  color:var(--gray2);margin-left:9px}
.evnum{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;margin-top:5px}
.evhook{font-size:14px;color:var(--gray);margin-top:7px;line-height:1.3}
.cta.evcta{flex:none;align-self:center;margin-top:0;padding:12px 26px}
/* Ver densidadeDe(): tabela curta ganha corpo grande em vez de deixar a tela vazia. */
table.rk.d-normal td{padding-top:9px;padding-bottom:9px}
table.rk.d-normal .it{font-size:17.5px}
table.rk.d-normal .occ{font-size:9.5px;margin-top:3px}
table.rk.d-ampla td{padding-top:18px;padding-bottom:18px}
table.rk.d-ampla .it{font-size:22px;letter-spacing:-.015em}
table.rk.d-ampla .occ{font-size:10.5px;margin-top:5px}
table.rk.d-ampla .mb{height:13px}
table.rk.d-ampla .mv-val{font-size:15px}
table.rk.d-normal .mv-val{font-size:13.5px}
.regras{margin-top:22px;border-top:1px solid var(--rule);padding-top:14px;
  display:grid;grid-template-columns:1fr 1fr;gap:40px;max-width:1000px}
.regras p{font-size:13.5px;color:var(--gray);line-height:1.45}
.regras b{color:var(--ink)}
.selo{position:absolute;top:10px;left:10px;background:var(--award,var(--pink));color:var(--award-ink,#14120F);
  font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.13em;
  text-transform:uppercase;font-weight:700;padding:5px 10px;border-radius:999px;display:flex;align-items:center;gap:6px}
.selo b{font-family:'Bricolage Grotesque',sans-serif;font-size:14px;line-height:.8;letter-spacing:0;color:inherit}
.award-consistencia .selo,.award-consistencia .selo b{color:#000000!important}
.selo.solto{position:static;align-self:flex-start;margin-bottom:22px}
.hcimg{position:relative}
.cta{display:inline-block;color:var(--award-text,var(--pink-text));text-align:left;text-decoration:none;
  font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.11em;text-transform:uppercase;
  font-weight:700;border-bottom:1px solid currentColor;padding:0 0 3px;margin-top:14px}
.cta.grande{align-self:flex-start;font-size:13px;padding:16px 40px;margin-top:28px}
.ctasub{font-size:11.5px;color:var(--gray);text-align:center;margin-top:6px}
.ctasub.claro{color:#C9C2B8;text-align:left;margin-top:9px}
.awardnav{height:28px;display:flex;justify-content:space-between;align-items:center;
  font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--gray2);border-bottom:1px solid var(--rule);padding-bottom:10px}
.awardnav b{font-weight:500;color:var(--ink)}
.awardfeature{height:545px;display:grid;grid-template-columns:307px minmax(0,1fr);gap:70px;
  align-items:center;padding-top:15px}
.awardmediawrap{width:307px;height:522px;position:relative;display:flex;align-items:center;justify-content:center}
.awardmediawrap::before{content:'';position:absolute;left:-18px;top:24px;width:282px;height:488px;
  border-radius:26px;background:var(--award-tint);transform:rotate(-2deg)}
.awardmedia{position:relative;width:282px;height:501px;border-radius:22px;background-color:var(--award-tint);
  background-size:cover;background-position:center;box-shadow:0 18px 42px rgba(38,31,26,.13),0 0 0 1px rgba(20,18,15,.08)}
.awardmedia.avatar{background-position:center top}
.awardmedia.graphic{display:flex;align-items:flex-end;padding:34px;background:linear-gradient(155deg,var(--award-tint),#D9D0C5)}
.awardmedia.graphic span{font-family:'Bricolage Grotesque',sans-serif;font-size:88px;font-weight:700;
  letter-spacing:-.08em;color:var(--award-text)}
.awardmedia.graphic b{position:absolute;right:24px;top:22px;font-family:'Bricolage Grotesque',sans-serif;
  font-size:64px;color:color-mix(in srgb,var(--award) 42%,transparent)}
.awardcopy{min-width:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.awardlabel{font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.3;letter-spacing:.13em;
  text-transform:uppercase;color:var(--award-text);font-weight:700;display:flex;align-items:center;gap:11px}
.awardlabel span{width:34px;height:34px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  background:var(--award-tint);color:var(--award-text);font-family:'Bricolage Grotesque',sans-serif;
  font-size:17px;letter-spacing:0}
.awardperson{display:flex;align-items:center;gap:14px;margin-top:20px}
.awardavatar{width:54px;height:54px;border-radius:50%;background-size:cover;background-position:center;
  box-shadow:0 0 0 3px var(--award-tint);display:flex;align-items:center;justify-content:center;
  font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;color:var(--award-text)}
.awardavatar.fallback{background:var(--award-tint)}
.awardperson h2{font-family:'Bricolage Grotesque',sans-serif;font-size:39px;font-weight:650;
  line-height:1.02;letter-spacing:-.035em}
.awardhandle{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--gray2);text-decoration:none;
  display:inline-block;margin-top:5px}
.awardresult{font-family:'Bricolage Grotesque',sans-serif;font-size:47px;font-weight:600;
  letter-spacing:-.035em;line-height:1.02;margin-top:24px;max-width:700px}
.awardfeature.quote .awardresult{font-size:35px;line-height:1.16}
.awardplain{font-size:21px;color:var(--gray);line-height:1.38;margin-top:12px;max-width:700px}
.awardstudy{margin-top:20px;max-width:700px;padding-top:15px;border-top:1px solid var(--rule)}
.awardstudy>p{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--award-text);font-weight:700}
.awardstudy blockquote{font-size:21px;line-height:1.34;margin-top:8px;color:var(--ink)}
.awardelements{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--gray2);
  letter-spacing:.04em;margin-top:12px}
.awardcta{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.11em;text-transform:uppercase;
  color:var(--award-text);font-weight:700;text-decoration:none;border-bottom:1px solid currentColor;
  padding-bottom:3px;margin-top:18px}
.rostercols{display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:column;grid-template-rows:repeat(4,1fr);
  column-gap:64px;row-gap:6px;margin-top:24px;height:430px}
.rosteritem{display:grid;grid-template-columns:64px minmax(0,1fr);gap:17px;align-items:center;min-height:98px}
.rosteravatar{width:60px;height:60px;border-radius:50%;background-size:cover;background-position:center;
  box-shadow:0 0 0 3px var(--award-tint);display:flex;align-items:center;justify-content:center;
  font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;color:var(--award-text);background-color:var(--award-tint)}
.rosteraward{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--award-text);font-weight:700;display:flex;align-items:center;gap:7px}
.rosteraward span{font-family:'Bricolage Grotesque',sans-serif;font-size:15px}
.rosteritem h3{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:650;line-height:1.05;
  letter-spacing:-.025em;margin-top:4px}
.rosterhandle,.rosterresult{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray2);margin-top:3px}
.rosterresult{color:var(--ink);font-weight:700}
.awardcriteria{display:grid;grid-template-columns:1fr 1fr;gap:30px 58px;margin-top:28px}
.awardcriteria article{display:grid;grid-template-columns:205px 1fr;gap:24px;align-items:start;padding:4px 0}
.criterionname{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--award-text);font-weight:700;display:flex;align-items:center;gap:10px}
.criterionname span{width:32px;height:32px;border-radius:50%;background:var(--award-tint);display:inline-flex;
  align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-size:15px;letter-spacing:0}
.awardcriteria article>p:last-child{font-size:17px;line-height:1.4;color:var(--gray)}
.emblemas{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px 24px;margin-top:8px}
.emb{border-top:3px solid var(--award,var(--ink));padding-top:12px;min-height:150px}
.emb.vazio{border-top:2px dashed var(--rule)}
.embn{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;font-weight:700;display:flex;align-items:center;gap:9px;color:var(--award-text,var(--ink))}
.emblem{display:inline-flex;align-items:center;justify-content:center;width:29px;height:29px;
  border-radius:50%;background:var(--award,var(--pink));color:var(--award-ink,#14120F);font-family:'Bricolage Grotesque',sans-serif;
  font-size:14px;font-weight:800;letter-spacing:-.03em;flex:none}
.emb.vazio .embn{color:var(--gray2)}
.embv{font-size:13px;color:var(--gray2);margin-top:10px;line-height:1.4}
.embcrit{font-size:13.5px;color:var(--gray);line-height:1.35;margin-top:9px}
.embg p{margin-top:10px}
.embg b{display:block;font-size:16px;font-weight:700;letter-spacing:-.01em}
.embg span{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray)}
.podio{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:34px;margin-top:6px}
.podio.cols-1{grid-template-columns:minmax(0,580px);justify-content:center}
.premios{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:22px}
.hcard{display:flex;gap:13px;border-top:4px solid var(--award,var(--ink));padding-top:12px}
.hcard.grande{flex-direction:column;gap:12px}
.hcimg{width:66px;height:86px;flex:none;border-radius:4px;background-size:cover;
  background-position:center;background-color:var(--track);display:block}
.hcimg.avatar-fallback{background-size:178px 178px;background-repeat:no-repeat;background-position:center;
  background-color:color-mix(in srgb,var(--award) 20%,var(--dark));
  box-shadow:inset 0 0 0 5px color-mix(in srgb,var(--award) 55%,transparent)}
.hcimg.empty{background:linear-gradient(145deg,var(--award),var(--dark));display:flex;align-items:center;justify-content:center}
.hcinitials,.hcimg.empty .hcinitials{font-family:'Bricolage Grotesque',sans-serif;font-size:52px;font-weight:800;color:#FFFFFF}
.hcard.grande .hcimg{width:100%;height:236px;border-radius:5px}
.hcbody{flex:1;min-width:0}
.hclabel{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--award-text,var(--pink-text));font-weight:700;display:flex;align-items:center;gap:8px}
.hcname{font-size:24px;font-weight:800;color:var(--ink);letter-spacing:-.015em;line-height:1.08;margin-top:5px}
.hcard:not(.grande) .hcname{font-size:16px}
.hcname span{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:400;
  color:var(--gray2);margin-left:8px;letter-spacing:.02em}
.hcres{font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;margin-top:9px;color:var(--ink)}
.hcard.frase .hcres{font-family:'Instrument Sans';font-size:20px;font-weight:600;letter-spacing:-.01em;line-height:1.28}
.hcplain{font-size:19px;color:var(--gray);margin-top:7px;line-height:1.35}
.hchook{font-size:19px;margin-top:9px;line-height:1.32;color:var(--ink)}
.hcel{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--gray2);margin-top:7px}
.hclink{display:inline-block;margin-top:9px;font-family:'JetBrains Mono',monospace;font-size:9.5px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--pink);font-weight:700;text-decoration:none}
.qbig{border-left:4px solid var(--pink);padding-left:20px;margin-top:14px}
.qbig blockquote{font-size:30px;line-height:1.22;font-weight:700;letter-spacing:-.02em;max-width:1000px}
.qbig figcaption{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--gray2);margin-top:12px}
.qbig .qm{color:var(--pink);font-weight:700;margin-left:14px}
.voltarn{font-size:82px;font-weight:900;letter-spacing:-.04em;line-height:.9}
.voltarl{font-size:17px;color:var(--gray);margin-top:6px}
/* Desconta o cabeçalho do território, que vem acima do par. Sem isso as duas
   colunas somam 54px abaixo do rodapé. */
.split11.pair{height:calc(100% - 120px);align-items:start}
.pairh{font-size:17px;font-weight:700;letter-spacing:-.01em}
.split11.pair .inv{margin-top:14px}
.split11.pair .invlist{columns:2;column-gap:22px}
/* height:100% sozinho ignora que territoryHead() já ocupa espaço ACIMA deste bloco
   dentro do mesmo .body (push() faz head + inner concatenados — head e emptywrap são
   irmãos, não pai/filho). Sem desconto, emptywrap "achava" que tinha a altura toda de
   .body e estourava por baixo exatamente pela altura do cabeçalho. Medido no overflow
   real (12 ocorrências, sempre os mesmos 50px, porque territoryHead() tem estrutura
   fixa) — não é palpite, é o delta que o próprio erro reportou. +4px de folga. */
.emptywrap{display:flex;flex-direction:column;height:calc(100% - 54px)}
.midbox{display:flex;align-items:center;justify-content:flex-start;flex:1;min-height:0}
/* A narrativa é a frase que define a pessoa no mapa, e estava no MENOR corpo da tela:
   15px, duas colunas, 43% da altura usada. Em corpo grande, uma coluna, as 11 frases
   preenchem a tela e ficam legíveis de longe na reunião. */
.nrlist.grandes .nr{padding:11px 0 11px 26px;margin-bottom:9px;position:relative;border-left:0}
.nrlist.grandes .nr::before{content:"";position:absolute;left:2px;top:22px;width:9px;height:9px;
  border-radius:50%;background:var(--pink)}
.nrlist.grandes .nr b{font-size:26px;font-weight:600;letter-spacing:-.018em;line-height:1.24}
.nrlist.grandes .nr span{font-size:11px;margin-top:6px}
.nrlist.grandes.muitas .nr b{font-size:20px;line-height:1.22}
.nrlist.grandes.muitas .nr{padding:7px 0 7px 14px;margin-bottom:5px}
.gapsrow{margin-top:26px;border-top:1px solid var(--rule);padding-top:16px}
.gapsline{display:flex;gap:22px}
.gapsline .box{flex:1}
.kick{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--pink);font-weight:700}
.tdiv{font-size:82px;font-weight:900;letter-spacing:-.035em;line-height:.98;margin:14px 0 20px}
.tdivsub{font-size:19px;color:#B9B1A6;letter-spacing:-.01em}
.tdivscene{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.11em;
  text-transform:uppercase;color:#A79E93;margin-top:26px}
.qwall{columns:2;column-gap:54px;margin-top:24px}
.q{break-inside:avoid;margin-bottom:24px;padding-left:22px;position:relative}
.q::before{content:"";position:absolute;left:2px;top:9px;width:8px;height:8px;border-radius:50%;background:var(--pink)}
.q blockquote{font-size:19px;line-height:1.32;font-weight:600;letter-spacing:-.01em}
.q figcaption{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--gray2);margin-top:7px}
.q .qm{color:var(--pink-text);font-weight:700;margin-left:10px}
.recording-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:38px;
  border-top:1px solid var(--ink);border-bottom:1px solid var(--rule)}
.recording-summary article{padding:30px 34px 34px;min-height:270px}
.recording-summary article+article{border-left:1px solid var(--rule)}
.recording-signal{font-family:'Bricolage Grotesque',sans-serif;font-size:29px;font-weight:750;
  letter-spacing:-.025em;line-height:1.08;margin-top:20px}
.recording-metric{font-family:'JetBrains Mono',monospace;font-size:19px;font-weight:700;margin-top:14px}
.recording-reading{font-size:19px;line-height:1.4;color:var(--gray);margin-top:24px;max-width:280px}
.recording-empty{font-size:19px;color:var(--gray);margin-top:20px}
.inv{margin-top:18px;border-top:1px solid var(--rule);padding-top:12px}
.invhead{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.13em;
  text-transform:uppercase;font-weight:700;margin-bottom:9px}
.invhead span{color:var(--gray2);font-weight:400;letter-spacing:.06em;margin-left:8px}
.invlist{column-gap:34px;list-style:none}
.invlist li{line-height:1.45;color:var(--ink);break-inside:avoid;
  padding-left:10px;position:relative;margin-bottom:2px}
.invlist li::before{content:"·";position:absolute;left:0;color:var(--gray2)}
.invlist.inv-solo{columns:1}
.invlist.inv-solo li{font-family:'Bricolage Grotesque',sans-serif;font-size:32px;font-weight:650;
  line-height:1.18;margin:0;padding:18px 0 18px 28px;border-bottom:0}
.invlist.inv-solo li::before{top:17px;font-family:'Instrument Sans',sans-serif}
.invlist.inv-spacious{columns:2}
.invlist.inv-spacious li{font-size:20px;line-height:1.42;margin-bottom:12px;padding-left:16px}
.invlist.inv-standard{columns:2}
.invlist.inv-standard li{font-size:17px;line-height:1.45;margin-bottom:7px;padding-left:14px}
.invlist.inv-roomy{columns:3}
.invlist.inv-roomy li{font-size:16px;line-height:1.45;margin-bottom:6px;padding-left:13px}
.invlist.inv-compact{columns:3}
.invlist.inv-compact li{font-size:14px;line-height:1.48;margin-bottom:4px;padding-left:12px}
.inv.inv-solo{margin-top:36px;padding-top:20px}
.inv.inv-spacious{margin-top:28px;padding-top:18px}
.inv.inv-standard{margin-top:23px;padding-top:15px}
.inv.standalone{border-top:0;padding-top:0;margin-top:18px}
.inv.standalone .invhead{font-size:10.5px;margin-bottom:14px}
/* 100% da .body ignorava o cabeçalho do território, que vem acima — a foto
   sangrava 62px por cima do rodapé em todos os territórios. */
.hero{display:flex;gap:40px;align-items:center;height:calc(100% - 72px)}
.hvtn{width:248px;height:441px;flex:none;border-radius:6px;display:block;
  background-size:cover;background-position:center;background-color:var(--track);
  box-shadow:0 2px 18px rgba(0,0,0,.13)}
.hvtn.empty{background:var(--track)}
.hinfo{flex:1;min-width:0}
.hkick{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.hname{font-size:36px;font-weight:800;letter-spacing:-.02em;line-height:1.05;margin-top:8px}
.hhandle{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:400;
  color:var(--gray2);margin-left:12px;letter-spacing:.02em}
.hhook{font-size:17px;line-height:1.35;margin-top:16px}
.hhook.big{font-size:23px;line-height:1.3;font-weight:600;letter-spacing:-.01em;margin-top:12px;color:var(--ink)}
.hmets{display:flex;gap:38px;margin-top:26px;border-top:1px solid var(--rule);padding-top:18px}
.hmets b{display:block;font-family:'JetBrains Mono',monospace;font-size:34px;font-weight:700;line-height:1}
.hmets span{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--gray2);display:block;margin-top:6px}
.hreading{display:grid;grid-template-columns:148px minmax(0,1fr);gap:22px;margin-top:22px;
  border-top:1px solid var(--rule);padding-top:16px;align-items:start}
.hreading>span,.hcontext>span,.hel>span{font-family:'JetBrains Mono',monospace;font-size:10px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--pink-text);font-weight:700}
.hreading p{font-size:17px;line-height:1.42;color:var(--ink);max-width:650px}
.hcontext{display:grid;grid-template-columns:148px minmax(0,1fr);gap:22px;margin-top:16px;align-items:start}
.hcontext>div{display:flex;gap:28px;flex-wrap:wrap}
.hcontext p{min-width:112px}
.hcontext b{display:block;font-family:'JetBrains Mono',monospace;font-size:18px;line-height:1;font-weight:700}
.hcontext p span{display:block;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--gray2);margin-top:5px}
.hel{display:grid;grid-template-columns:148px minmax(0,1fr);gap:22px;font-size:14px;line-height:1.35;
  color:var(--gray);margin-top:16px}
.hlink{display:inline-block;margin-top:18px;font-family:'JetBrains Mono',monospace;font-size:11px;
  letter-spacing:.11em;text-transform:uppercase;color:var(--pink-text);font-weight:700;text-decoration:none}
.ev{font-weight:700;letter-spacing:.04em}
.ev.tendencia{color:var(--ink)}
/* O lastro é informação de primeira linha desde que substituiu a risca de corte.
   A diferença entre os três é de PESO, não de opacidade: no cinza claro, uma tabela
   em que toda linha é indício saía com a coluna inteira apagada, parecendo campo
   desabilitado em vez de "vi isso uma vez". */
.ev.sinal{color:var(--ink);font-weight:600}
.ev.indicio{color:var(--gray);font-weight:500}
.vhook{font-size:12.5px;line-height:1.35;margin-top:3px;color:var(--ink)}
.vtag{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--gray2);border:1px solid var(--rule);padding:1px 4px;margin-right:6px;vertical-align:1px}
.h1,.tdiv,.hname,.hcname,.pquote,.pname,.vaila .vt,.predbig,.qbig blockquote,
.nrlist.grandes .nr b,.evname,.combo,.voltarn{font-family:'Bricolage Grotesque',sans-serif}
.mode-anchor{--mode-color:var(--pink)}
.mode-study{--mode-color:var(--gray2)}
.mode-anchor::before,.mode-study::before{content:"";position:absolute;right:0;top:0;width:92px;height:5px;background:var(--mode-color)}
.modeflag{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--pink-text);font-weight:700;margin-bottom:13px}
.terrsummary{height:calc(100% - 72px);display:grid;grid-template-columns:minmax(390px,.78fr) minmax(0,1.22fr);
  gap:72px;align-items:center}
.terrsummary-copy{display:flex;flex-direction:column;justify-content:center;min-width:0}
.terrsummary-copy .tt{max-width:100%}
.terrsummary-copy .tt.long{font-size:42px}
.terrsummary-lead{font-size:20px;line-height:1.4;color:var(--gray);margin-top:22px;max-width:480px}
.terrsummary-empty{font-size:19px;line-height:1.42;color:var(--gray);margin-top:20px;max-width:460px}
.terrsummary-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;margin:34px 0 0;
  border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px 0}
.terrsummary-stats p{padding:0 18px;border-left:1px solid var(--rule)}
.terrsummary-stats p:first-child{padding-left:0;border-left:0}
.terrsummary-stats b{font-family:'Bricolage Grotesque',sans-serif;font-size:31px;display:block;line-height:1}
.delta-up{color:var(--green-text)} .delta-down{color:#A33B2F} .delta-neutral{color:var(--ink)}
.terrsummary-stats span{font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:var(--gray2);display:block;margin-top:6px}
.terrsummary-findings{min-width:0;border-left:1px solid var(--rule);padding-left:54px}
.terrsummary-findings-title{font-family:'Bricolage Grotesque',sans-serif;font-size:24px;letter-spacing:-.015em;
  color:var(--ink);font-weight:700;margin-bottom:24px}
.summary-signals{display:grid;gap:24px;margin-top:4px}
.summary-signal{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;min-width:0}
.summary-signal-head{display:flex;align-items:baseline;justify-content:space-between;gap:18px;min-width:0}
.summary-signal-head p{font-family:'Bricolage Grotesque',sans-serif;font-size:21px;font-weight:700;
  line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.summary-signal-head b{font-family:'JetBrains Mono',monospace;font-size:19px;white-space:nowrap}
.summary-basis{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.35;
  color:var(--gray2);margin-top:20px}
.takeaways{display:grid;gap:12px;margin-top:16px}
.takeaways p{font-size:19px;line-height:1.38;border-left:4px solid var(--pink);padding-left:14px}
.takeaways.down p{border-color:var(--gray2)}
.patternlist{margin-top:32px;border-top:2px solid var(--ink)}
.patternlist article{display:grid;grid-template-columns:52px 265px minmax(0,1fr);gap:24px;
  align-items:baseline;padding:18px 0;border-bottom:1px solid var(--rule)}
.patternlist span{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--pink-text);font-weight:700}
.patternlist h3{font-family:'Bricolage Grotesque',sans-serif;font-size:24px;line-height:1.1;letter-spacing:-.02em}
.patternlist p{font-size:18px;line-height:1.35;color:var(--gray)}
.cautionsection{margin-top:24px}
.cautionintro{display:grid;grid-template-columns:390px minmax(0,1fr);gap:32px;align-items:end;
  padding:15px 0 14px;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.cautionintro p,.cautionempty p{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.cautionintro h3{font-family:'Bricolage Grotesque',sans-serif;font-size:23px;line-height:1.05;margin-top:5px}
.cautionintro>span{font-size:15px;line-height:1.35;color:var(--gray);max-width:650px}
.cautionhead,.cautionlist article{display:grid;grid-template-columns:205px 160px minmax(0,1fr) 138px;gap:22px}
.cautionhead{padding:10px 0 7px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--gray2);font-weight:700}
.cautionlist{border-top:1px solid var(--rule)}
.cautionlist article{align-items:center;padding:10px 0;border-bottom:1px solid var(--rule);min-height:48px}
.cautionlist article>p,.cautionlist article>span{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.25;
  letter-spacing:.05em;text-transform:uppercase;color:var(--gray2);font-weight:700}
.cautionlist h3{font-family:'Instrument Sans',sans-serif;font-size:16px;font-weight:550;line-height:1.25}
.cautionlist article>div{display:flex;align-items:baseline;justify-content:flex-end;gap:8px;white-space:nowrap}
.cautionlist b{font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--ink)}
.cautionlist small{font-family:'JetBrains Mono',monospace;font-size:10px;text-transform:uppercase;color:var(--gray2)}
.cautionempty{margin-top:28px;padding:22px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.cautionempty h3{font-family:'Bricolage Grotesque',sans-serif;font-size:24px;margin-top:8px}
.opportunityline{display:grid;grid-template-columns:390px minmax(0,1fr);gap:32px;align-items:start;
  margin-top:20px;padding:17px 0 0;border-top:4px solid var(--pink)}
.opportunityline p{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.opportunityline span{font-size:13px;line-height:1.35;color:var(--gray);display:block;margin-top:6px}
.opportunityline h3{font-family:'Bricolage Grotesque',sans-serif;font-size:23px;font-weight:600;
  line-height:1.2;letter-spacing:-.015em}
.method-hero{display:grid;grid-template-columns:180px minmax(0,1fr) 230px;gap:42px;align-items:center;
  margin-top:38px;padding:28px 0 25px;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.method-example{min-width:0}
.method-kicker,.method-index{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.13em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.method-topic{font-family:'Bricolage Grotesque',sans-serif;font-size:44px;font-weight:800;
  letter-spacing:-.025em;line-height:1;margin-top:10px}
.method-scale{min-width:0}
.method-scale .signalbar{height:16px}
.method-scale-labels{display:flex;justify-content:space-between;align-items:center;margin-top:10px;
  font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray2)}
.method-scale-labels b{color:var(--ink);font-weight:700}
.method-number b{font-family:'Bricolage Grotesque',sans-serif;font-size:54px;line-height:.92;display:block}
.method-number span{font-size:16px;line-height:1.25;color:var(--gray);display:block;margin-top:9px;max-width:220px}
.method-reading{font-size:22px;line-height:1.32;margin-top:24px;max-width:1050px}
.method-keys{margin-top:28px;border-top:1px solid var(--rule)}
.method-keys article{display:grid;grid-template-columns:58px 190px minmax(0,1fr);gap:18px;
  align-items:baseline;padding:15px 0;border-bottom:1px solid var(--rule)}
.method-keys h3{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;line-height:1.08;
  letter-spacing:-.02em}
.method-keys article>p:last-child{font-size:17px;line-height:1.35;color:var(--gray)}
.method-footer{display:flex;justify-content:space-between;gap:32px;margin-top:19px}
.method-footer p{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.35;
  letter-spacing:.04em;color:var(--gray2)}
.method-footer p:last-child{text-align:right;color:var(--blue-text);font-weight:700}
.maplist{margin-top:27px;border-top:2px solid var(--ink)}
.maplist>div{display:grid;grid-template-columns:54px 1fr 150px;align-items:center;border-bottom:1px solid var(--rule);padding:11px 0}
.maplist>div.mapchild{padding:8px 0 8px 36px;background:#F1ECE4}
.maplist>div.mapchild b{font-family:'Instrument Sans',sans-serif;font-size:18px;font-weight:700}
.maplist span,.maplist em{font-family:'JetBrains Mono',monospace;font-size:12px;font-style:normal;color:var(--gray2);letter-spacing:.1em}
.maplist b{font-family:'Bricolage Grotesque',sans-serif;font-size:25px;letter-spacing:-.015em}
.maplist em{text-align:right;color:var(--ink);font-weight:700}
/* Sem teto de território, o mapa do relatório pode ter muito mais linhas do que as
   ~9 para as quais foi calibrado. compact/dense encolhem padding e fonte na mesma
   ordem de ideia da densidadeDe() das tabelas — mais linha, letra menor. */
.maplist.compact>div{padding:7px 0}
.maplist.compact>div.mapchild{padding:5px 0 5px 36px}
.maplist.compact b{font-size:19px}
.maplist.compact>div.mapchild b{font-size:15px}
.maplist.dense>div{padding:4px 0}
.maplist.dense>div.mapchild{padding:3px 0 3px 36px}
.maplist.dense b{font-size:15px}
.maplist.dense>div.mapchild b{font-size:12.5px}
.maplist.dense span,.maplist.dense em{font-size:10px}
.findinglist{display:grid;gap:0;margin-top:23px}
.findinglist article{display:grid;grid-template-columns:52px minmax(0,1.35fr) minmax(290px,.8fr);
  gap:24px;align-items:center;padding:18px 0}
.findinglist article+article{border-top:1px solid var(--rule)}
.findingnumber{font-family:'JetBrains Mono',monospace;font-size:20px;color:var(--gray2);font-weight:500}
.findingcopy h3{font-family:'Bricolage Grotesque',sans-serif;font-size:23px;font-weight:600;
  letter-spacing:-.025em;line-height:1.08;margin-top:5px}
.findingcopy>p:last-child{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.35;
  color:var(--gray2);margin-top:9px;font-weight:400}
.findingmeter{display:grid;gap:9px}
.findingmeter>div{display:grid;grid-template-columns:82px minmax(0,1fr) 46px;gap:10px;align-items:center}
.findingmeter span,.findingmeter b{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--gray2)}
.findingmeter b{text-align:right;color:var(--ink);font-size:12px}
.findingmeter .current span,.findingmeter .current b{color:var(--pink-text);font-weight:700}
.intelligencecols{margin-top:34px}
.forecastcall{margin-top:25px;background:var(--dark);color:var(--paper);padding:17px 19px}
.forecastcall>p:last-child{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;line-height:1.25;margin-top:8px}
body{background:#8A8580;font-family:'Instrument Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.slide{width:1280px;height:720px;background:var(--paper);color:var(--ink);position:relative;overflow:hidden}
.slide.dark{background:var(--dark);color:var(--paper)}
.body{position:absolute;top:34px;left:56px;right:56px;bottom:48px}
.center{display:flex;flex-direction:column;justify-content:center;height:100%}
.col{display:flex;flex-direction:column;height:100%}
.pushdown{margin-top:auto;padding-top:16px}
.pushdown.bt{border-top:1px solid var(--rule);padding-top:18px}

.thead{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--ink);padding-bottom:9px;margin-bottom:20px}
.thead .nm{font-family:'Bricolage Grotesque',sans-serif;font-size:32px;font-weight:800;letter-spacing:-.025em}
.thead.territory-eyebrow{border-bottom:1px solid var(--rule);padding-bottom:8px;margin-bottom:18px}
.thead.territory-eyebrow .nm{font-size:19px;font-weight:750;letter-spacing:-.012em}
.thead .meta{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.thead .meta b{color:var(--pink-text);font-weight:700}
.dark .thead{border-color:var(--paper)} .dark .thead .meta{color:#9C948B}

h2.tt{font-family:'Bricolage Grotesque',sans-serif;font-size:34px;font-weight:800;letter-spacing:-.028em;line-height:1.02}
h2.tt.sm{font-size:36px}
h2.tt.xl{font-size:46px;max-width:880px}
p.sub{font-size:14.5px;color:var(--gray);margin-top:4px;line-height:1.4}
p.sub.sm{font-size:13px}
.dark p.sub{color:#A79C93}
.mb10{margin-bottom:10px} .mb12{margin-bottom:12px} .mb18{margin-bottom:18px}
.mt7{margin-top:7px} .mt8{margin-top:8px} .mt14{margin-top:14px} .mt16{margin-top:16px} .mt20{margin-top:20px}
.rowhead{display:flex;justify-content:space-between;align-items:baseline}
.sortby{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--gray2);font-weight:700}
.sortby.pink{color:var(--pink-text)}
.dark .sortby{color:#B9B1A6}.dark .sortby.pink{color:#FF6A9D}
.cutnote{margin-top:12px;color:var(--gray2);text-transform:none;letter-spacing:.04em;font-size:9px}
.foot{position:absolute;bottom:18px;left:56px;right:56px;display:flex;justify-content:space-between;
  font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--gray2);border-top:1px solid var(--rule);padding-top:8px}
.dark .foot{border-color:var(--ruled);color:#6E645C}

.coverlayout{display:grid;grid-template-columns:390px minmax(0,1fr);gap:62px;align-items:center;height:100%}
.covercopy{align-self:center;min-width:0;padding-bottom:12px}
.coverkicker{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.2;letter-spacing:.16em;
  text-transform:uppercase;color:#B9B1A6;font-weight:700}
.covertitle{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.065em;
  line-height:.78;margin-top:42px;color:var(--paper)}
.covertitle span{display:block;font-size:86px;letter-spacing:-.055em}
.covertitle b{display:block;font-size:132px;font-weight:800;margin-top:19px}
.coverdate{font-family:'Instrument Sans',sans-serif;font-size:30px;line-height:1.12;color:#D9D1C7;
  letter-spacing:-.025em;margin-top:42px;text-transform:uppercase}
.coverweek{font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.2;letter-spacing:.13em;
  text-transform:uppercase;color:#8F877F;margin-top:13px}
.coverpromise{border-top:1px solid var(--ruled);margin-top:35px;padding-top:18px;max-width:350px}
.coverpromise span{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.2;letter-spacing:.14em;
  text-transform:uppercase;color:#B9B1A6;font-weight:700}
.coverpromise p{font-size:18px;line-height:1.3;color:#D9D1C7;margin-top:8px;max-width:320px}
.cover-slide::before{display:none}
.coverpeople{--cover-cols:4;display:grid;grid-template-columns:repeat(var(--cover-cols),minmax(0,1fr));
  gap:28px 18px;align-content:center;height:570px;min-width:0}
.coverpeople.rows-1{justify-items:center}.coverpeople.rows-1 .coverperson{max-width:190px}
.coverpeople.rows-3{gap:15px 18px}.coverpeople.rows-3 .coverperson-image{width:104px;height:104px}
.coverpeople.rows-3 .coverperson-photo{height:116px}.coverpeople.rows-3 .coverperson h2{font-size:13px}
.coverperson{min-width:0;text-align:center;position:relative;color:var(--paper)}
.coverperson-photo{height:157px;position:relative;display:flex;align-items:flex-start;justify-content:center}
.coverperson-image{width:146px;height:146px;border-radius:50%;background-size:cover;background-position:center;
  background-color:#2A2521;box-shadow:0 0 0 1px rgba(248,245,240,.46),0 13px 32px rgba(0,0,0,.28);
  display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;
  font-size:44px;font-weight:700;letter-spacing:-.055em;color:#D9D1C7}
.coverperson-image.fallback{background-image:radial-gradient(circle at 38% 32%,#403832,#211D1A 68%)}
.coverperson-emblem{position:absolute;right:7px;bottom:6px;width:29px;height:29px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;background:var(--dark);color:var(--paper);
  border:2px solid var(--award);box-shadow:0 0 0 3px var(--dark);font-family:'Bricolage Grotesque',sans-serif;font-size:13px;
  font-weight:800;line-height:1}
.coverperson-index{position:absolute;left:9px;top:12px;font-family:'JetBrains Mono',monospace;
  font-size:10px;color:#8F877F;letter-spacing:.05em}
.coverperson>p{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.15;letter-spacing:.08em;
  text-transform:uppercase;color:#AFA79E;margin-top:13px;white-space:nowrap}
.coverperson h2{font-family:'Bricolage Grotesque',sans-serif;font-size:16px;font-weight:650;line-height:1.05;
  letter-spacing:-.025em;margin:6px auto 0;max-width:158px;display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden}
.coverpeople-empty{grid-column:1/-1;align-self:center;border-top:1px solid var(--ruled);padding-top:24px}
.coverpeople-empty span{font-family:'Bricolage Grotesque',sans-serif;font-size:62px;color:#B9B1A6}
.coverpeople-empty p{font-family:'Bricolage Grotesque',sans-serif;font-size:34px;line-height:1.08;
  max-width:520px;margin-top:20px;color:var(--paper)}
.h1{font-family:'Bricolage Grotesque',sans-serif;font-size:104px;font-weight:800;letter-spacing:-.055em;line-height:.88;margin:18px 0 26px}
.big{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.055em;line-height:.85;color:var(--pink)}
.big .of{font-size:26px;color:var(--gray2)}

.split262{display:grid;grid-template-columns:262px 1px 1fr;gap:28px;height:calc(100% - 52px)}
/* 52px era a altura do cabeçalho simples. O de território mede ~70 e o rowhead
   de título+subtítulo soma mais 46 — daí os 65px que a tela de pautas passava do
   rodapé. O desconto tem que ser o do cabeçalho real, não o do mais curto. */
.split11{display:grid;grid-template-columns:1fr 1px 1fr;gap:26px}
.split11.timing{height:calc(100% - 67px);gap:34px;align-items:start}
.split11.afterhead{min-height:430px}
/* Alinhado ao topo como TODA outra tela. Centralizado, o bloco descia para 40% da
   altura e abria um vazio no topo que lia como erro de render. */
.split11.mid{align-items:flex-start;padding-top:34px}
.split115{display:grid;grid-template-columns:1.15fr 1px 1fr;gap:26px;height:calc(100% - 52px)}
.split125{display:grid;grid-template-columns:1.25fr 1px 1fr;gap:30px;margin-top:26px}
.split125.compact{margin-top:14px}
.split125.compact .tt{font-size:19px}
.split125.compact .sub{font-size:12.5px}
.split125.compact .big{font-size:38px!important}
.split125.compact .predrow{margin-top:8px;gap:16px}
.split125.compact .leg.col{gap:4px}
/* Tabela de visão geral com mais território do que os ~6 pra que foi calibrada
   originalmente — mesma ideia da densidadeDe() das tabelas de ranking. */
table.rk.ovcompact td{padding:4px 8px 4px 0}
table.rk.ovcompact .it{font-size:14px}
table.rk.ovcompact .occ{font-size:10px}
table.rk.ovcompact .mb{height:7px}
table.rk.ovcompact .mv-val{font-size:11.5px}
.split15{display:grid;grid-template-columns:1.5fr 1px 1fr;gap:24px;margin-top:16px}
.split16{display:grid;grid-template-columns:1.6fr 1px 1fr;gap:28px;height:calc(100% - 52px)}
.vr{background:var(--rule);width:1px} .vr.dark,.dark .vr{background:var(--ruled)}

table.rk{width:100%;border-collapse:collapse}
table.rk th{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--gray2);text-align:left;padding:0 8px 7px 0;font-weight:500;border-bottom:1px solid var(--ink)}
.dark table.rk th{border-color:var(--paper);color:#B9B1A6}
table.rk td{padding:7px 8px 7px 0;border-bottom:0;vertical-align:middle}
table.rk tr:not(.cut):nth-child(odd) td{background:rgba(20,18,15,.025)}
table.rk tr:not(.cut) td:first-child{padding-left:8px}
.dark table.rk tr:not(.cut):nth-child(odd) td{background:rgba(248,245,240,.035)}
/* Abaixo de 1,0× continua sendo parte da mesma lista. Um rótulo explícito substitui
   a antiga caixa lateral, que parecia mudar a categoria sem explicar o motivo. */
table.rk tr.cut td{border-bottom:none;padding:0}
.cutlabel{display:flex;align-items:center;gap:12px;margin:5px 0 2px;padding:6px 0;
  border-top:0}
.cutlabel span,.cutlabel b{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.2;
  letter-spacing:.1em;text-transform:uppercase}
.cutlabel span{color:var(--pink-text);font-weight:700}
.cutlabel b{color:var(--gray2);font-weight:500}
.it{font-size:14.5px;font-weight:700;line-height:1.2}
.it.light{color:var(--paper)}
.low .it{font-weight:600}
.occ{font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--gray2);font-weight:500;letter-spacing:.03em;display:block;margin-top:2px}
.mv{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700}
.mv.u{color:var(--pink)} .mv.d{color:var(--gray2)} .mv.n{color:var(--blue)} .mv.e{color:var(--gray2)}
.fit{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;text-align:right;white-space:nowrap}
.fit.fit-creators{font-size:12px}
.fit.fit-creators .fout{font-size:10px}
.fit.light{color:var(--paper)} .fit.pink{color:var(--pink)} .dark .fit.pink{color:#FF77A5}
.fit .fout{font-size:10px;font-weight:500;color:var(--gray2)}
.views-cell{text-align:right;white-space:nowrap}
.viewbar{position:relative;width:94px;height:10px;background:var(--track);display:inline-block;vertical-align:middle}
.viewbar i{position:absolute;inset:0 auto 0 0;background:var(--blue);display:block}
.view-val{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;
  margin-left:8px;vertical-align:middle;display:inline-block;min-width:58px;text-align:right}
.nmcell{font-size:14.5px} .terrcell{font-size:13px;color:var(--gray)}
.mins{color:#A79C93;font-size:13.5px}
.reading{font-size:12.5px;color:var(--gray);text-align:right}

.mb{position:relative;width:74px;height:9px;background:var(--track);display:inline-block;vertical-align:middle}
.mb.nb{width:56px}
.mb i{position:absolute;left:0;top:0;bottom:0;display:block}
.mb::after{content:'';position:absolute;left:33.333%;top:-3px;bottom:-3px;width:1px;background:#9C948B}
.mv-val{font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:700;margin-left:7px;vertical-align:middle}
.signalbar{position:relative;width:100%;height:10px;background:var(--track);display:block}
.signalbar i{position:absolute;left:0;top:0;bottom:0;display:block}
.signalbar::after{content:'';position:absolute;left:33.333%;top:-3px;bottom:-3px;width:1px;background:#807870}
.c-com{background:var(--pink)} .c-sha{background:var(--blue)} .c-sav{background:var(--green)}
.c-lik{background:var(--gold)} .c-ret{background:var(--purple)} .c-alc{background:var(--gray2)}

.leg{display:flex;gap:18px;flex-wrap:wrap;align-items:center}
.leg.col{flex-direction:column;gap:8px;align-items:flex-start}
.leg div{display:flex;gap:6px;align-items:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;line-height:1;letter-spacing:.09em;text-transform:uppercase;color:var(--gray)}
.leg i{width:11px;height:11px;display:block}
.legnote{font-size:13px;color:var(--gray);margin-top:14px;line-height:1.45}
.predrow{display:flex;gap:26px;margin-top:16px;align-items:center}
.prednote{border-left:1px solid var(--rule);padding-left:26px}
.prednote p{font-size:14.5px;line-height:1.45;color:var(--gray)}

.nrlist{margin-top:16px;overflow:hidden}
.nr{padding:1px 0 1px 11px;margin-bottom:11px}
.nr b{font-size:14px;font-weight:700;display:block;line-height:1.25;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nrmore{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--gray2);margin-top:14px}
.nr span{font-family:'JetBrains Mono',monospace;font-size:9.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--gray2);display:block;margin-top:3px}

.grid7{display:grid;grid-template-columns:58px repeat(7,1fr);gap:4px;margin-top:18px}
.grid7 .h{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--gray2);text-align:center;padding-bottom:3px}
.grid7 .hr{font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--gray2);display:flex;align-items:center}
.cell{height:40px;background:var(--pink);position:relative}
.cell.v0{background:var(--track)}
.cell span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:700;color:var(--ink)}
.cell.lite span{color:var(--ink)}

.dur{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;align-items:end;height:266px;margin-top:22px}
.dcol{display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.dbars{display:flex;gap:5px;align-items:flex-end;height:174px}
.dbars i{flex:1;display:block;min-height:1px}
.dvalues{display:grid;gap:2px;margin-top:8px;text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700}
.dvalues .ret{color:#69449F}.dvalues .eng{color:var(--pink-text)}
.dlab{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.05em;color:var(--gray2);text-align:center;margin-top:6px;line-height:1.5}
.dlab span{color:var(--ink);font-weight:700}

table.vd{width:100%;border-collapse:collapse;margin-top:14px}
table.vd th{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--gray2);text-align:right;padding:0 0 6px;font-weight:500;border-bottom:1px solid var(--ink)}
table.vd th:first-child,table.vd th:nth-child(2){text-align:left}
table.vd td{padding:7px 0;border-bottom:1px solid var(--rule);font-family:'JetBrains Mono',monospace;font-size:12.5px;font-weight:700;text-align:right}
table.vd td:first-child{width:34px}
table.vd td:nth-child(2){text-align:left;font-family:'Instrument Sans';font-size:13.5px}
.tn{width:26px;height:34px;border-radius:3px;background:linear-gradient(150deg,#C9BEB2,#7D7266);background-size:cover;background-position:center;display:block}

table.mx{width:100%;border-collapse:collapse}
table.mx th{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--gray2);padding:0 0 8px;font-weight:500;text-align:center;border-bottom:1px solid var(--ink)}
table.mx th:first-child{text-align:left}
table.mx td{padding:0;border-bottom:2px solid var(--paper);text-align:center;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;height:36px}
table.mx td:first-child{text-align:left;font-family:'Instrument Sans';font-size:15px;font-weight:700;padding-right:12px;background:transparent!important}
.m5{background:rgba(240,40,110,.92);color:var(--ink)} .m4{background:rgba(240,40,110,.66);color:var(--ink)}
.m3{background:rgba(240,40,110,.42)} .m2{background:rgba(240,40,110,.22)} .m1{background:rgba(240,40,110,.09);color:var(--gray2)}
.m0{background:transparent;color:var(--gray2)}
.matrix-reading{font-size:17px;line-height:1.4;border-left:4px solid var(--pink);padding-left:14px;margin-top:16px;max-width:980px}

.box{border:1px solid var(--rule);padding:13px 15px}
.dark .box{border-color:var(--ruled)}
.boxbig{font-size:15.5px;font-weight:700;margin-top:8px;line-height:1.35}
.gaps{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.gt{font-size:13.5px;font-weight:700;line-height:1.3}
.gd{font-size:12.5px;color:var(--gray);margin-top:4px;line-height:1.35}
.pt{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--pink-text);font-weight:700}
.dark .pt,.forecastcall .pt{color:#FF6A9D}
.combo{font-size:16.5px;font-weight:700;margin-top:6px;line-height:1.35}
.combometa{font-size:13px;color:var(--gray);margin-top:6px;line-height:1.4}
.dark .combometa{color:#A79C93}
.pautas{margin-top:6px;overflow:hidden}
.pautas p{font-size:12.5px;line-height:1.4;margin-bottom:7px}
.pautabase{display:block;font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.35;
  color:var(--gray2);text-transform:uppercase;letter-spacing:.06em;margin-top:5px}
.pauta-spacious{align-items:start;padding-top:22px}
.pauta-spacious .combo{font-size:28px;line-height:1.22;margin-top:14px}
.pauta-spacious .combometa{font-size:17px;line-height:1.45;margin-top:14px}
.pauta-spacious .pautas p{font-size:20px;line-height:1.42;margin-bottom:20px}
.pauta-spacious .pautabase{font-size:11.5px;margin-top:7px}
.pauta-cont{padding-top:18px}
.pauta-cont-head{display:flex;align-items:baseline;justify-content:space-between;gap:30px;
  padding-bottom:14px;border-bottom:1px solid var(--rule)}
.pauta-cont-head>p:last-child{font-size:14px;line-height:1.4;color:var(--gray);max-width:690px;text-align:right}
.pautas-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:58px;row-gap:24px;margin-top:22px}
.pauta-cont .pautas p{font-size:18px;line-height:1.42;margin:0;min-width:0}
.pauta-cont .pautabase{font-size:11px;margin-top:8px}
.predbig{font-size:30px;font-weight:800;letter-spacing:-.022em;line-height:1.18;margin:14px 0 20px}
.predcav{font-size:14.5px;color:#A79C93;line-height:1.5}
.silent{font-size:13px;color:var(--gray);margin-top:16px;line-height:1.5}

/* Melhores vídeos — card por vídeo, o centro da reunião */
.vids{margin-top:16px}
.vid{display:flex;align-items:center;gap:18px;padding:9px 0;border-bottom:1px solid var(--rule)}
.vnum{font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--gray2);width:16px}
.vtn{width:70px;height:91px;border-radius:4px;flex:none;display:block;
  background:linear-gradient(150deg,#C9BEB2,#7D7266);background-size:cover;background-position:center}
.vinfo{flex:1;min-width:0}
.vname{font-size:17px;font-weight:700;line-height:1.15}
.vmeta{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.06em;color:var(--gray2);margin-top:3px}
.vel{font-size:12.5px;color:var(--gray);margin-top:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.vmets{display:flex;gap:22px;flex:none}
.vmet{display:block;font-size:11px;color:var(--gray);text-align:right;line-height:1.25;min-width:74px}
.vmet b{display:block;font-family:'JetBrains Mono',monospace;font-size:19px;color:var(--ink);letter-spacing:-.02em}
.vlink{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--pink-text);font-weight:700;text-decoration:none;flex:none;width:62px;text-align:right}
.vlink.off{color:var(--gray2)}

/* Matriz agrupada por família */
.mxg td{font-family:'JetBrains Mono',monospace;font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--pink-text);font-weight:700;padding:9px 0 3px!important;background:transparent!important;text-align:left!important}

/* A régua tipográfica do estudo: nenhum metadado mono abaixo de 10px. */
.evlabel,table.rk.d-normal .occ,.selo,.hclabel,.hcel,.hclink,.q figcaption,.invhead,
.hmets span,.vtag,.terrsummary-stats span,.sortby,.foot,table.rk th,.occ,.leg div,.nrmore,
.nr span,.grid7 .h,.grid7 .hr,.cell span,.dlab,table.vd th,table.mx th,.pt,.mxg td{font-size:10px}
.note-fine{font-size:11.5px;color:var(--gray2);line-height:1.45;margin-top:10px}
/* A tabela já contém a régua: aqui fica somente a conclusão, sem duplicar barras. */
.reading{font-size:14px;color:var(--ink);line-height:1.45;margin-top:12px;text-align:left;
  border-left:3px solid var(--pink);padding-left:11px}
.ranking-reading{display:grid;grid-template-columns:128px minmax(0,1fr);gap:16px;
  align-items:baseline;margin-top:14px;padding-top:13px;border-top:1px solid var(--rule)}
.rr-kicker{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--pink-text);font-weight:700}
.rr-line{display:flex;align-items:baseline;gap:14px;min-width:0}
.rr-line b{font-family:'Bricolage Grotesque',sans-serif;font-size:19px;font-weight:650;
  line-height:1.2;letter-spacing:-.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr-line span{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.35;color:var(--gray2)}
.gapscol{display:grid;gap:12px}
.empty{border:1px dashed var(--rule);padding:18px 20px;margin-top:14px}
.dark .empty{border-color:var(--ruled)}
.empty p{font-size:14.5px;font-weight:700;color:var(--gray)}
.empty span{display:block;font-size:12.5px;color:var(--gray2);margin-top:6px;line-height:1.45}
.mode-anchor p.sub{font-size:19px;line-height:1.35;margin-top:7px}
`;

/** Documento completo de um slide, para o Playwright capturar. */
export function renderSlideHtml(slide: RenderedSlide): string {
  return (
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<title>${esc(slide.note)}</title><style>${CSS}</style></head>` +
    `<body>${slide.html}</body></html>`
  );
}

/** Todos os slides num só documento — a leitura de conferência e o PDF. */
export function renderDeckHtml(report: WeeklyReportData, slides: RenderedSlide[]): string {
  const body = slides
    .map(
      (slide) =>
        `<p class="note">${esc(slide.note)}</p>` +
        `<div class="pagewrap" data-slide="${slide.n}" data-chapter="${esc(slide.chapter ?? "")}" ` +
        `data-mode="${esc(slide.readingMode ?? "")}" data-family="${esc(slide.family ?? "")}" ` +
        `data-intentional-whitespace="${slide.intentionalWhitespace ? "true" : "false"}">` +
        `${slide.html}</div>`,
    )
    .join("");

  return (
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">` +
    `<title>Relatório da Semana ${report.cover.isoWeek} · Data2Content</title>` +
    `<style>${CSS}
      body{padding:36px 20px 90px}
      .wrap{max-width:1280px;margin:0 auto}
      .note{font-size:11.5px;color:#fff;opacity:.68;letter-spacing:.07em;text-transform:uppercase;font-weight:600;margin:0 0 7px 4px}
      .pagewrap{margin:0 0 24px}
      .pagewrap .slide{box-shadow:0 10px 34px rgba(0,0,0,.3)}
      @media print{
        body{background:#fff;padding:0}
        .note{display:none}
        .pagewrap{margin:0;page-break-after:always;break-after:page}
        .pagewrap .slide{box-shadow:none}
      }
    </style></head><body><div class="wrap">${body}</div></body></html>`
  );
}
