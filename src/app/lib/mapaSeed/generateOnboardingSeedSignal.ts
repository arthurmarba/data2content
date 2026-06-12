// src/app/lib/mapaSeed/generateOnboardingSeedSignal.ts
//
// Interpreta a declaração de propósito do onboarding (texto livre: "por que você
// cria conteúdo?") e extrai o primeiro rascunho do mapa narrativo do criador,
// na hierarquia do produto: Narrativa central → Territórios → Temas → Assets.
//
// O output alimenta diretamente o MapaSeed (rota /onboarding cria o documento com
// narrativa_central/territorios/temas/assets). É o primeiro mapa do criador, antes
// de qualquer enriquecimento por Instagram ou vídeo.
//
// IMPORTANTE: o onboarding atual é uma ÚNICA pergunta livre — a declaração de
// propósito. Os campos whyYouCreate/desiredFeeling são valores fixos herdados do
// fluxo antigo de múltipla escolha (sempre "ensino_conhecimento"/"inspirado"), NÃO
// escolhas do criador. Por isso a IA interpreta SOMENTE o propósito: injetar aqueles
// códigos como se fossem declarados enviesava o mapa (puxava tudo para "ensino").
//
// Best-effort: retorna null em qualquer falha (sem propósito, IA indisponível, JSON
// inválido) para nunca bloquear o onboarding.
// Modelo: gpt-4o (claudeService · intensity medium).

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface OnboardingSeedSignalInput {
  /**
   * @deprecated Não é mais interpretado. Valor fixo herdado do onboarding antigo
   * de múltipla escolha. Mantido por compatibilidade de assinatura com o caller.
   */
  whyYouCreate?: string;
  /**
   * @deprecated Não é mais interpretado. Valor fixo herdado do onboarding antigo.
   */
  desiredFeeling?: string;
  /** Declaração de propósito livre — a ÚNICA fonte de verdade do mapa seed. */
  creatorPurpose: string;
}

export interface OnboardingSeedSignal {
  /** Narrativa central — o fio condutor (intenção ou movimento humano), não um assunto. */
  label: string;
  /** Territórios — assuntos/nichos (substantivos) que o criador ocupa com legitimidade. */
  territorios: string[];
  /** Temas — cenas concretas e recorrentes dentro de um território. */
  temas: string[];
  /** Assets de vida — elementos reais da vida (papéis, relações, trajetória) que alimentam os temas. */
  assets: string[];
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(purpose: string): string {
  return `Você é o sistema de mapeamento narrativo da Data2Content.

Um criador acabou de escrever, com as próprias palavras, por que cria conteúdo.
Essa declaração é a ÚNICA fonte de verdade — não invente nada que não esteja
nela ou fortemente implícito nela. Transforme-a no primeiro rascunho do mapa
narrativo dele, seguindo a hierarquia do produto:

    Narrativa central → Territórios → Temas → Assets

O que o criador escreveu:
"${purpose}"

Extraia os campos abaixo, respeitando rigorosamente a definição de cada camada.
A distinção entre as camadas é o que torna o mapa preciso.

A cadeia, num único exemplo do começo ao fim:
    Narrativa "sair do piloto automático"
      → Território "paternidade"
        → Tema "sair do escritório a tempo de ver os filhos acordados"
          → Asset de vida "casado, pai de dois"
Mais adiante, os TEMAS se cruzam com os ASSETS e com os interesses da AUDIÊNCIA
para virar pautas de conteúdo. Por isso temas e assets precisam ser CONCRETOS —
cenas e elementos reais da vida, não conceitos abstratos.

NARRATIVA CENTRAL (label)
  O fio condutor — a INTENÇÃO ou o MOVIMENTO HUMANO que dá identidade a tudo
  que o criador faz. É o "para quê" / o lugar de onde ele fala — não o assunto.
  Pode ser uma MISSÃO ("democratizar o conhecimento financeiro") OU uma
  TENSÃO / JORNADA DE VIDA ("sair do piloto automático", "se reconstruir depois
  de uma virada"). NUNCA confunda narrativa com território (o assunto).
  Ex.: "sair do piloto automático" é a narrativa; "paternidade" é o território
       onde ela ganha palco.
  Frase curta (máx. 12 palavras). Sem aspas, sem ponto final.

TERRITÓRIOS (territorios)
  Os ASSUNTOS (nichos) que o criador ocupa com LEGITIMIDADE. Pense:
  "se isso fosse um nicho de conteúdo, qual seria?".
  • FORMA: substantivo / sintagma nominal curto (1 a 3 palavras). É uma ÁREA
    DE ASSUNTO — nunca um objetivo, processo ou ação.
    Bons territórios: "paternidade", "finanças pessoais", "saúde feminina".
  • NUNCA comece com verbo. "Encontrar a narrativa", "Monetizar conteúdo",
    "Transformar paixão em lucro" são OBJETIVOS/AÇÕES — isso é narrativa ou
    tema, NÃO território. Se um candidato for uma meta ou ação, reduza ao
    assunto-raiz:
      "Encontrar a narrativa pessoal"        → "Narrativa pessoal"
      "Monetização de conteúdo com publicidade" → "Publicidade e marcas"
  • Nada de rótulos genéricos ("cultura", "lifestyle", "dicas").
  • 2 a 4 itens, ancorados na narrativa. A legitimidade vem de algo real na
    vida do criador (um asset).
  Respeite uma identidade que abrange mais de um assunto — não force um nicho
  único se o propósito sugere mais de um território.

TEMAS (temas)
  CENAS concretas e recorrentes DENTRO de um território — momentos reais da
  vida que dariam um vídeo. Não é um sub-assunto abstrato; é uma situação
  específica, quase filmável. 2 a 4 itens.
  Ex.: no território "paternidade", um tema é
       "sair do escritório a tempo de ver os filhos acordados".

ASSETS DE VIDA (assets)
  ELEMENTOS REAIS da vida do criador que viram matéria-prima de conteúdo —
  o que existe DE FATO na vida dele e pode ser cruzado com os temas:
    papéis e relações (casado, pai de dois, filho de imigrantes),
    trajetória (ex-corporativo, autodidata, mudou de carreira),
    contexto (mora no interior, trabalha de casa), experiências vividas.
  1 a 3 itens. NÃO é o assunto nem uma credencial abstrata — é vida concreta.
  Ex.: "casado" e "pai de dois" alimentam temas do território "paternidade".

Regras:
- Responda em português do Brasil.
- A declaração é a única fonte. Se for vaga, gere MENOS itens — não preencha
  com suposições para "completar" o mapa.
- Coerência hierárquica obrigatória: os territórios derivam da narrativa; os
  temas são cenas dentro dos territórios; os assets são elementos da vida real
  do criador que alimentam os temas.
- Retorne APENAS JSON válido, sem markdown nem explicação.

Formato esperado:
{
  "label": "string",
  "territorios": ["string"],
  "temas": ["string"],
  "assets": ["string"]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Gera o mapa seed do onboarding via IA a partir da declaração de propósito.
 * Best-effort: retorna null em qualquer falha para que o onboarding nunca trave.
 *
 * Só deve ser chamado quando há um propósito declarado. Sem propósito, não há o
 * que interpretar e o MapaSeed não é semeado nesta etapa.
 */
export async function generateOnboardingSeedSignal(
  input: OnboardingSeedSignalInput,
): Promise<OnboardingSeedSignal | null> {
  const TAG = "[mapaSeed][generateOnboardingSeedSignal]";

  const purpose = input.creatorPurpose?.trim();
  if (!purpose) {
    // Sem propósito não há o que interpretar.
    return null;
  }

  try {
    const raw = await callClaudeJSON<Partial<OnboardingSeedSignal>>(buildPrompt(purpose), {
      intensity: "medium",
      maxTokens: 600,
    });

    const label = typeof raw.label === "string" ? raw.label.trim() : "";

    if (!label) {
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

    logger.info(`${TAG} Mapa seed gerado: "${label}" (${territorios.length} territórios, ${temas.length} temas, ${assets.length} assets)`);
    return { label, territorios, temas, assets };
  } catch (err) {
    logger.warn(`${TAG} Falha ao gerar mapa seed (não-fatal):`, err);
    return null;
  }
}
