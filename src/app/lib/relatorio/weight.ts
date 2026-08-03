/**
 * weight.ts — a repetição vira força, e substitui o corte.
 *
 * O DESENHO ANTERIOR, e por que caiu. Havia quatro portões (mínimo de 8 aparições na
 * janela, 3 criadores, 2 na semana, 2 criadores na semana) e tudo o que não passasse
 * sumia do relatório. Isso resolvia um problema real — "Inspirar/Motivar 4,4× · 1
 * criador" é ruído vendido como tendência — mas criava dois piores:
 *
 *   • O relatório ficava quase igual toda semana, porque o que passa num portão
 *     estatístico é justamente o que é estável. Um produto semanal precisa mudar.
 *   • Detalhe visto uma vez sumia por inteiro, quando ele é interessante — só não é
 *     interessante COMO TENDÊNCIA.
 *
 * O DESENHO ATUAL: nada é excluído. A frequência não decide SE a linha aparece, decide
 * ONDE ela aparece. Um elemento visto uma vez com 3,0× não é uma tendência de 3,0×; é
 * um indício. Então o índice é puxado na direção de 1,0× na hora de ordenar, tanto mais
 * quanto menos ele se repetiu:
 *
 *     força = 1 + (índice − 1) × n / (n + K)
 *
 * É encolhimento bayesiano com a cara mais simples possível: `n/(n+K)` é o quanto se
 * acredita na amostra, e 1,0× (a mediana do território) é o palpite de quem não sabe de
 * nada. Com K = 5:
 *
 *     visto  1×, índice 3,0×  →  força 1,33   (indício)
 *     visto  4×, índice 2,2×  →  força 1,53
 *     visto 20×, índice 1,5×  →  força 1,40   (tendência)
 *
 * A caneca vista uma vez APARECE na tabela com seu 3,0× honesto — mas não passa na
 * frente da boneca vista quatro vezes. E se na semana seguinte aparecerem mais três
 * canecas indo bem, ela sobe sozinha. O ranking aprende com a repetição em vez de
 * alguém arbitrar um mínimo.
 *
 * O QUE A TABELA MOSTRA continua sendo o índice verdadeiro e o número de vezes, lado a
 * lado. A força é invisível: ela só ordena. Mostrar três números por linha seria trocar
 * um problema de confiança por um de leitura.
 */

/**
 * Quantas observações valem tanto quanto o palpite de partida.
 *
 * K = 5 vem da escala real da base: um território típico tem ~20 vídeos na semana e
 * ~140 na janela. Com K = 5, algo visto 5 vezes já carrega metade da própria força, o
 * que é rápido o bastante para uma tendência nova emergir em duas ou três semanas, e
 * lento o bastante para um viral solitário não liderar tabela.
 */
export const WEIGHT_K = 5;

/**
 * Quantos posts de UMA pessoa podem valer como amostra.
 *
 * A Regra 2 diz que tendência é coletiva. Sem isto, um criador prolífico fabrica
 * confiança sozinho: dez posts dele viram "n = 10" e a linha sobe como se dez pessoas
 * tivessem feito a mesma coisa. Caso real medido — "Inspirar/Motivar 4,4× · visto 2× ·
 * 1 criador" liderava Maternidade.
 *
 * O corte antigo resolvia isso EXCLUINDO a linha. Agora ela aparece (marcada como
 * indício, com "1 criador" escrito ao lado), mas o lastro dela é limitado: uma pessoa
 * nunca soma mais que três observações de confiança, por mais que poste.
 */
export const MAX_POSTS_PER_CREATOR = 3;

/**
 * O tamanho de amostra que a força enxerga.
 *
 * Não é o número de posts: é o número de posts limitado pelo número de PESSOAS. Vinte
 * posts de duas pessoas valem seis; quatro posts de quatro pessoas valem quatro.
 */
export function effectiveSampleSize(occurrences: number, creators: number): number {
  if (occurrences <= 0 || creators <= 0) return 0;
  return Math.min(occurrences, creators * MAX_POSTS_PER_CREATOR);
}

/**
 * Índice encolhido pelo tamanho da amostra. É a chave de ordenação de toda tabela.
 *
 * `n` é o tamanho efetivo da amostra DA SEMANA, não da janela — porque o número que a
 * linha exibe é o da semana, e a confiança tem que ser a confiança naquele número. A
 * janela dá contexto ("137× na janela") e não entra aqui.
 */
export function forceOf(index: number, n: number): number {
  if (!Number.isFinite(index) || n <= 0) return 1;
  return 1 + (index - 1) * (n / (n + WEIGHT_K));
}

/**
 * Distância da força em relação ao 1,0×, que é o que realmente ordena.
 *
 * Uma linha com força 0,4× é tão informativa quanto uma com 1,6× — as duas dizem algo
 * forte, uma para cada lado. Ordenar por `force` cru jogaria tudo o que puxa para baixo
 * para o fim da tabela, onde ninguém lê, e é justamente ali que mora "pare de fazer
 * isso". A ordenação normal usa isto; quem quiser separar os dois lados olha o sinal do
 * índice.
 */
export function forceMagnitude(index: number, n: number): number {
  return Math.abs(forceOf(index, n) - 1);
}

/**
 * Quanta confiança a linha carrega, de 0 a 1 — o `n/(n+K)` isolado.
 *
 * Serve para o documento poder dizer em palavras o que a ordenação diz em silêncio:
 * abaixo de ~0,3 a linha é indício, acima de ~0,7 é tendência.
 */
export function confidenceOf(n: number): number {
  if (n <= 0) return 0;
  return n / (n + WEIGHT_K);
}

/** As três faixas de leitura, para o documento rotular a linha em português. */
export type EvidenceLevel = "indicio" | "sinal" | "tendencia";

export function evidenceLevelOf(n: number): EvidenceLevel {
  const confidence = confidenceOf(n);
  // As faixas em observações efetivas: até 2 é indício, de 3 a 7 é sinal, 8+ é
  // tendência. O 8 não é coincidência — era o mínimo de aparições do briefing, que
  // agora deixou de ser um portão e virou o ponto onde a linha ganha o nome de
  // tendência. Nada é excluído por não chegar lá; só é chamado de outra coisa.
  if (confidence < 0.35) return "indicio";
  if (confidence < 0.6) return "sinal";
  return "tendencia";
}

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  indicio: "indício",
  sinal: "sinal",
  tendencia: "tendência",
};
