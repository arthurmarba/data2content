// src/app/lib/mapaSeed/generateOnboardingSeedSignal.ts
// Fase 3 — gera o sinal seed do onboarding (preview do mapa) a partir das
// respostas Q1 (identidade), Q2 (sentimento) e Q3 (declaração de propósito).
//
// Este é o "espelho" mostrado no step first_signal do onboarding mobile para
// criadores que ainda não têm sinais do Instagram/vídeos. Quando o criador
// declara um propósito (Q3), a IA INTERPRETA esse propósito para derivar uma
// narrativa central específica — algo que o fallback determinístico
// (buildSeedSignal, lookup table) não consegue.
//
// Sem propósito → este serviço não é chamado (o client usa buildSeedSignal).
// Modelo: gpt-4o (claudeService · intensity medium).

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface OnboardingSeedSignalInput {
  /** Código de identidade narrativa (Q1) — ex: "conto_historias". */
  whyYouCreate: string;
  /** Código do sentimento desejado (Q2) — ex: "inspirado". */
  desiredFeeling: string;
  /** Declaração de propósito livre (Q3) — texto do criador. */
  creatorPurpose: string;
}

export interface OnboardingSeedSignal {
  /** Frase curta de narrativa central — hipótese inicial do mapa. */
  label: string;
  /** 1–2 frases que expandem a hipótese, em linguagem de espelho. */
  summary: string;
  /** Assuntos com os quais o criador tem legitimidade (extraídos do propósito). */
  territorios: string[];
  /** Situações concretas recorrentes detectadas no propósito. */
  temas: string[];
  /** Elementos de vida mencionados (profissão, família, rotina, etc.). */
  assets: string[];
}

// ─── Mapas de rótulo (código → humano) ────────────────────────────────────────
// Espelham WHY_OPTIONS / FEELING_OPTIONS do MobileOnboardingFlow. Mantidos aqui
// para que o prompt receba linguagem natural, não códigos internos.

const WHY_LABELS: Record<string, string> = {
  ensino_conhecimento: "Ensina ou compartilha conhecimento",
  conto_historias:     "Conta histórias da própria vida",
  entretenimento:      "Entretém com humor e leveza",
  inspiro_acao:        "Inspira as pessoas a agir ou mudar algo",
  // Legacy
  compartilho_aprendizado: "Compartilha o que aprende",
  ensino_habilidade:       "Ensina uma habilidade",
};

const FEELING_LABELS: Record<string, string> = {
  inspirado: "inspirada",
  informado: "informada",
  entendido: "compreendida",
  entretido: "entretida",
  motivado:  "motivada a agir",
};

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(input: OnboardingSeedSignalInput): string {
  const whyLabel = WHY_LABELS[input.whyYouCreate] ?? input.whyYouCreate;
  const feelingLabel = FEELING_LABELS[input.desiredFeeling] ?? input.desiredFeeling;
  const purpose = input.creatorPurpose.trim();

  return `Você é um sistema de mapeamento narrativo para criadores de conteúdo.

A partir de três sinais declarados por um criador no onboarding, sintetize a
HIPÓTESE INICIAL do mapa narrativo dele — um espelho de quem ele é como
criador, não uma análise de performance.

Sinais declarados:
[1] Identidade — o que define o que ele cria: ${whyLabel}
[2] Sentimento que quer deixar em quem assiste: que a pessoa saia ${feelingLabel}
[3] Propósito (declaração livre, nas palavras do criador): "${purpose}"

O propósito [3] é o sinal MAIS IMPORTANTE. Use-o para derivar uma narrativa
central específica e pessoal — não genérica. Por exemplo:
  • Propósito "equilibrar maternidade, medicina e movimento" → narrativa sobre
    autocuidado e equilíbrio, territórios [saúde feminina, maternidade real],
    temas [rotina com filhos, corpo pós-parto], assets [carreira médica, experiência de mãe].

Gere os seguintes campos:

- label: frase curta (máx. 12 palavras) que captura a narrativa central.
  Deve refletir claramente o PROPÓSITO declarado, não só a identidade genérica.
  Sem aspas, sem ponto final.

- summary: 1 a 2 frases (máx. 40 palavras) que expandem a hipótese em linguagem
  de espelho — calma, sem jargão de crescimento, sem métricas. Termine indicando
  que a primeira leitura de um vídeo vai revelar muito mais.
  Não use "poste mais", "algoritmo" ou "engajamento".

- territorios: lista de 2 a 4 assuntos que o criador pode ocupar com
  legitimidade, derivados do propósito. Específicos e ancorados na narrativa
  — não rótulos genéricos como "cultura" ou "entretenimento".

- temas: lista de 2 a 4 situações concretas e recorrentes detectadas no propósito
  — os momentos reais de vida que viram pauta.

- assets: lista de 1 a 3 elementos concretos da vida do criador (profissão,
  papel familiar, rotina, experiência vivida) mencionados ou fortemente
  implicados no propósito.

Regras:
- Responda em português do Brasil.
- Não invente fatos que não estejam nos sinais.
- Se o propósito for vago, as listas podem ter menos itens — não preencha com suposições.
- Retorne APENAS JSON válido, sem markdown nem explicação.

Formato esperado:
{
  "label": "string",
  "summary": "string",
  "territorios": ["string"],
  "temas": ["string"],
  "assets": ["string"]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera o sinal seed do onboarding via IA. Best-effort: retorna null em qualquer
 * falha (validação, IA indisponível, JSON inválido) para que o chamador caia no
 * fallback determinístico sem bloquear o fluxo do criador.
 *
 * Só deve ser chamado quando há um propósito declarado (Q3). Sem propósito,
 * o ganho sobre o fallback determinístico não justifica a latência/custo.
 */
export async function generateOnboardingSeedSignal(
  input: OnboardingSeedSignalInput,
): Promise<OnboardingSeedSignal | null> {
  const TAG = "[mapaSeed][generateOnboardingSeedSignal]";

  if (!input.creatorPurpose?.trim()) {
    // Sem propósito não há o que interpretar — fallback determinístico no client.
    return null;
  }

  try {
    const raw = await callClaudeJSON<Partial<OnboardingSeedSignal>>(buildPrompt(input), {
      intensity: "medium",
      maxTokens: 600,
    });

    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";

    if (!label || !summary) {
      logger.warn(`${TAG} IA retornou sinal incompleto:`, raw);
      return null;
    }

    const territorios = Array.isArray(raw.territorios)
      ? raw.territorios.filter((t): t is string => typeof t === "string" && t.trim() !== "")
      : [];
    const temas = Array.isArray(raw.temas)
      ? raw.temas.filter((t): t is string => typeof t === "string" && t.trim() !== "")
      : [];
    const assets = Array.isArray(raw.assets)
      ? raw.assets.filter((a): a is string => typeof a === "string" && a.trim() !== "")
      : [];

    logger.info(`${TAG} Sinal seed gerado: "${label}" (${territorios.length} territórios, ${temas.length} temas, ${assets.length} assets)`);
    return { label, summary, territorios, temas, assets };
  } catch (err) {
    logger.warn(`${TAG} Falha ao gerar sinal seed (fallback determinístico):`, err);
    return null;
  }
}
