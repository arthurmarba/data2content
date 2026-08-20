// src/app/lib/creatorWeeklyReport/patternActions.ts
//
// A resposta de cada padrão dita como AÇÃO.
//
// A capa do card mostrava o rótulo da linha do ranking — "Quinta", "Plano
// próximo", "Caneca de café". É o que a tabela sabe, não o que a pessoa faz. Um
// substantivo solto obriga quem lê a traduzir sozinha ("e daí, eu gravo com a
// caneca?"), e essa tradução é justamente o trabalho que a leitura devia ter
// feito. "Tenha a caneca de café em cena" já sai executável.
//
// Determinístico e sem IA: um verbo por dimensão, aplicado ao rótulo que o
// motor promoveu. Onde não há verbo que caiba, a ação é o próprio rótulo — vale
// mais devolver o substantivo do que forçar uma frase torta.

import type { PatternHighlight } from "./patternHighlights";

/**
 * O motor devolve o rótulo curto ("Qui"); as fixtures e alguns relatórios já
 * gravados trazem o nome inteiro ("Quinta"). As duas formas caem aqui, porque
 * quem lê o card não deve descobrir qual delas o banco guardou.
 */
const WEEKDAY_FULL: Record<string, { article: "na" | "no"; name: string }> = {
  dom: { article: "no", name: "domingo" },
  domingo: { article: "no", name: "domingo" },
  seg: { article: "na", name: "segunda" },
  segunda: { article: "na", name: "segunda" },
  "segunda-feira": { article: "na", name: "segunda" },
  ter: { article: "na", name: "terça" },
  terca: { article: "na", name: "terça" },
  "terça": { article: "na", name: "terça" },
  qua: { article: "na", name: "quarta" },
  quarta: { article: "na", name: "quarta" },
  qui: { article: "na", name: "quinta" },
  quinta: { article: "na", name: "quinta" },
  sex: { article: "na", name: "sexta" },
  sexta: { article: "na", name: "sexta" },
  "sáb": { article: "no", name: "sábado" },
  sab: { article: "no", name: "sábado" },
  "sábado": { article: "no", name: "sábado" },
  sabado: { article: "no", name: "sábado" },
};

function lower(value: string) {
  return value.toLocaleLowerCase("pt-BR");
}

/** "Qui" → "Poste na quinta". O rótulo curto é da tabela; a frase é da pessoa. */
function weekdayAction(value: string): string {
  const day = WEEKDAY_FULL[lower(value.trim())];
  return day ? `Poste ${day.article} ${day.name}` : `Poste ${lower(value)}`;
}

/** "4–8h" e "Das 4h às 8h" → "Poste entre 4h e 8h". */
function slotAction(value: string): string {
  // `\b` não ajuda aqui: em " às ", nem o espaço nem o "à" são caracteres de
  // palavra para o regex, então a borda nunca fecha. Alternância simples resolve.
  const match = value.match(/(\d{1,2})\s*h?\s*(?:[–\-—]|às|as|a)\s*(\d{1,2})\s*h/i);
  if (!match) return `Poste ${lower(value)}`;
  return `Poste entre ${match[1]}h e ${match[2]}h`;
}

/**
 * Elenco já vem do registro canônico com "em cena" no rótulo ("Parceiro em
 * cena"). Repetir o complemento produziria "Ponha parceiro em cena em cena".
 */
function castAction(value: string): string {
  const text = lower(value);
  return text.endsWith("em cena") ? `Ponha ${text}` : `Ponha ${text} em cena`;
}

function objectAction(value: string): string {
  const text = lower(value);
  return text.endsWith("em cena") ? `Tenha ${text}` : `Tenha ${text} em cena`;
}

const ACTION_TEMPLATES: Record<string, (value: string) => string> = {
  weekday: weekdayAction,
  "time-slot": slotAction,
  time: slotAction,
  place: (value) => `Grave em ${lower(value)}`,
  objects: objectAction,
  cast: castAction,
  framing: (value) => `Grave em ${lower(value)}`,
  tone: (value) => `Fale ${lower(value)}`,
  aesthetics: (value) => `Use ${lower(value)}`,
  "subjects-best": (value) => `Fale de ${lower(value)}`,
  subjects: (value) => `Fale de ${lower(value)}`,
  "subjects-repeated": (value) => `Fale de ${lower(value)}`,
  // O gancho é a frase que a própria criadora disse. Nenhum verbo melhora isso —
  // a aspas é a ação.
  "openings-best": (value) => `“${value}”`,
  best: (value) => `“${value}”`,
};

/**
 * A frase de ação de um padrão. Para `reading`/`empty` não existe resposta a
 * transformar em ação: o card fala da própria dimensão, com o texto que
 * `patternHighlights` já escreveu.
 */
export function patternActionOf(highlight: PatternHighlight): string {
  if (highlight.kind !== "answer") return highlight.value;
  const template = ACTION_TEMPLATES[highlight.groupId];
  return template ? template(highlight.value) : highlight.value;
}
