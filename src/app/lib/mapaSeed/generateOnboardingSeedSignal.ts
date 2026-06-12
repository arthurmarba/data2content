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
  /** Narrativa central — o fio condutor (a intenção), não um assunto. */
  label: string;
  /** 1 frase de espelho que devolve ao criador o que foi entendido da narrativa. */
  summary: string;
  /** Territórios — assuntos que o criador ocupa com legitimidade. */
  territorios: string[];
  /** Temas — situações concretas e recorrentes dentro dos territórios. */
  temas: string[];
  /** Assets — elementos reais da vida que sustentam a legitimidade dos territórios. */
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

NARRATIVA CENTRAL (label)
  O fio condutor — a INTENÇÃO que dá identidade a tudo que o criador faz.
  É o "para quê", não o assunto. NUNCA confunda narrativa com território.
  Ex.: "ensino finanças para quem nunca teve acesso"
       → narrativa: "Democratizar o conhecimento financeiro"
       (e NÃO "Finanças pessoais", que é um território).
  Frase curta (máx. 12 palavras). Sem aspas, sem ponto final.

TERRITÓRIOS (territorios)
  Assuntos que o criador pode ocupar com LEGITIMIDADE — e a legitimidade vem
  de algo real na vida dele (um asset). 2 a 4 itens, específicos e ancorados
  na narrativa. Nada de rótulos genéricos ("cultura", "lifestyle", "dicas").
  Respeite uma identidade que abrange mais de um assunto — não force um nicho
  único se o propósito sugere mais de um território.

TEMAS (temas)
  Situações concretas e recorrentes DENTRO dos territórios — os momentos reais
  de vida que viram pauta. 2 a 4 itens. Mais específicos que um território.
  Ex.: dentro do território "maternidade real", um tema é
       "rotina de autocuidado com pouco tempo".

ASSETS (assets)
  Elementos reais da vida que SUSTENTAM a legitimidade dos territórios:
  profissão, papel familiar, formação, experiência vivida. 1 a 3 itens.
  É a FONTE da legitimidade, não o assunto em si.
  Ex.: o asset "carreira médica" sustenta o território "saúde feminina".

SUMMARY (summary)
  1 frase de espelho — calma, na 2ª pessoa, devolvendo ao criador o que você
  entendeu da narrativa central dele. Sem métricas, sem jargão de crescimento.
  Nunca use "poste mais", "algoritmo" ou "engajamento".

Regras:
- Responda em português do Brasil.
- A declaração é a única fonte. Se for vaga, gere MENOS itens — não preencha
  com suposições para "completar" o mapa.
- Coerência hierárquica obrigatória: os territórios derivam da narrativa; os
  temas vivem dentro dos territórios; os assets sustentam os territórios.
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

    logger.info(`${TAG} Mapa seed gerado: "${label}" (${territorios.length} territórios, ${temas.length} temas, ${assets.length} assets)`);
    return { label, summary, territorios, temas, assets };
  } catch (err) {
    logger.warn(`${TAG} Falha ao gerar mapa seed (não-fatal):`, err);
    return null;
  }
}
