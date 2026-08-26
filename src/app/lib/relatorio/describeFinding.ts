/**
 * describeFinding.ts — o multiplicador dito em português.
 *
 * "2,2×" é compacto e cabe na tabela, mas ninguém aprende o que ele compara olhando
 * para ele. A frase abaixo diz a mesma coisa sem exigir nada:
 *
 *   "O post típico com filho em cena recebeu 1,2 vezes mais comentários por pessoa
 *    alcançada do que o post típico de Maternidade/Paternidade nesta semana."
 *
 * Ela é DERIVADA do mesmo número que a tabela mostra — não é texto de IA nem redação à
 * parte. Se a tabela e a frase divergirem, é bug.
 *
 * A unidade muda por métrica, e é isso que torna a frase necessária: curtidas e
 * comentários são POR PESSOA ALCANÇADA; retenção é contra o ESPERADO PARA A DURAÇÃO;
 * alcance é contra o PRÓPRIO CRIADOR. Um "2,2×" solto esconde essas três coisas
 * diferentes atrás do mesmo símbolo.
 */

import type { ElementKind, RankingRow, ReportMetric } from "./types";

/** Como o elemento entra na frase: "o post típico COM filho em cena". */
const KIND_PHRASE: Record<ElementKind, (label: string) => string> = {
  asset: (label) => `com ${label.toLowerCase()}`,
  assunto: (label) => `sobre ${label.toLowerCase()}`,
  tom: (label) => `com tom ${label.toLowerCase()}`,
  formato: (label) => `em ${label.toLowerCase()}`,
  horario: (label) => `publicado ${label.toLowerCase()}`,
  duracao: (label) => `de ${label}`,
  territorio: (label) => `de ${label}`,
  // As abertas. "Fala" é a única que entra entre aspas: é citação, não categoria.
  tema: (label) => `sobre ${label.toLowerCase()}`,
  objeto: (label) => `com ${label.toLowerCase()} em cena`,
  fala: (label) => `que disse "${label}"`,
  local: (label) => `gravado em ${label.toLowerCase()}`,
  enquadramento: (label) => `em ${label.toLowerCase()}`,
  estetica: (label) => `com ${label.toLowerCase()}`,
  gancho: (label) => `com abertura em ${label.toLowerCase()}`,
};

/**
 * O que a métrica mede, na unidade certa. Três famílias, e cada uma compara com uma
 * coisa diferente — misturá-las num "×" genérico é o que confunde.
 */
const METRIC_PHRASE: Record<ReportMetric, string> = {
  curtidas: "curtidas por pessoa alcançada",
  comentarios: "comentários por pessoa alcançada",
  compartilhamentos: "compartilhamentos por pessoa alcançada",
  salvamentos: "salvamentos por pessoa alcançada",
  engajamento: "engajamento por pessoa alcançada",
  retencao: "tempo assistido, comparado ao esperado para a duração",
  alcance: "alcance, comparado ao que o próprio criador costuma alcançar",
};

/** Métricas em que a comparação NÃO é com o território, e a frase muda de forma. */
const SELF_REFERENCED: ReadonlySet<ReportMetric> = new Set(["retencao", "alcance"]);

function formatMultiplier(index: number): string {
  return index.toFixed(1).replace(".", ",");
}

/**
 * Frase descritiva de UMA linha de ranking.
 *
 * Devolve null quando o índice está perto de 1: "1,0 vezes mais" não é achado, é ruído
 * escrito por extenso, e o slide fica melhor sem.
 */
export function describeFinding(
  row: RankingRow,
  metric: ReportMetric,
  territoryLabel: string,
): string | null {
  const found = row.metrics.find((m) => m.metric === metric);
  if (!found) return null;
  const index = found.index;
  // Faixa morta: entre 0,9× e 1,1× não há o que dizer.
  if (index >= 0.9 && index <= 1.1) return null;

  const elemento = KIND_PHRASE[row.kind](row.label);
  const unidade = METRIC_PHRASE[metric];

  if (SELF_REFERENCED.has(metric)) {
    // Retenção e alcance já são índices contra a própria base do post/criador —
    // dizer "do que o post típico do território" seria mentira.
    const verbo = index > 1 ? "ficou acima" : "ficou abaixo";
    const quanto =
      index > 1
        ? `${formatMultiplier(index)} vezes o esperado`
        : `${Math.round((1 - index) * 100)}% abaixo do esperado`;
    return (
      `O post típico ${elemento} ${verbo} da régua: ${quanto} em ` +
      `${unidade.split(",")[0]}.`
    );
  }

  if (index > 1) {
    return (
      `O post típico ${elemento} recebeu ${formatMultiplier(index)} vezes mais ${unidade} ` +
      `do que o post típico de ${territoryLabel} nesta semana.`
    );
  }

  const menos = Math.round((1 - index) * 100);
  return (
    `O post típico ${elemento} recebeu ${menos}% menos ${unidade} ` +
    `do que o post típico de ${territoryLabel} nesta semana.`
  );
}

/**
 * A leitura de uma TABELA: a frase da linha mais forte que tenha algo a dizer.
 *
 * Uma frase por tabela, não uma por linha — o §4 do briefing proíbe parágrafo no
 * slide, e sete frases empilhadas viram parágrafo.
 */
export function describeTable(
  rows: readonly RankingRow[],
  metric: ReportMetric,
  territoryLabel: string,
): string | null {
  for (const row of rows) {
    if (row.pullsDown) continue;
    const sentence = describeFinding(row, metric, territoryLabel);
    if (sentence) return sentence;
  }
  // Nenhuma linha acima da risca disse algo; tenta a mais fraca, que também informa.
  const worst = [...rows].reverse().find((row) => row.pullsDown);
  return worst ? describeFinding(worst, metric, territoryLabel) : null;
}
