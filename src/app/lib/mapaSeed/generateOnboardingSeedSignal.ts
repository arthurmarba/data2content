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
import { MAPA_LAYERS_GUIDE, MAPA_COERENCIA_RULE } from "./mapaLayersGuide";

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
A distinção entre as camadas é o que torna o mapa preciso. Aqui, como o criador
fala dele mesmo, a narrativa já tende a sair na 1ª pessoa — preserve isso.

${MAPA_LAYERS_GUIDE}

No formato de saída, a NARRATIVA CENTRAL vai no campo "label".

Regras:
- Responda em português do Brasil.
- A declaração é a única fonte. Se for vaga, gere MENOS itens — não preencha
  com suposições para "completar" o mapa.
- ${MAPA_COERENCIA_RULE}
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
