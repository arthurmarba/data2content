// src/app/lib/mapaSeed/generateWhatsappMessage.ts
// Gera a mensagem semanal de WhatsApp a partir do estado real do mapa.
// Modelo: gpt-4o-mini · medium
//
// Estrutura por maturidade:
//   seed          → sinal do mapa + convite a confirmar/enriquecer
//   enriquecido   → preview de 2 pautas + descoberta (se houver evento real)
//
// Regras do produto:
//   - Nada aparece se não existir de verdade
//   - CTA nomeado pelo benefício, não pela página
//   - Tom consultivo e pessoal — não newsletter corporativa
//   - Máx. ~300 chars (WhatsApp lê melhor mensagens curtas)

import { callClaude } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData } from "@/app/models/MapaSeed";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface WhatsappMessageContext {
  mapa: IMapaData;
  creatorName: string;
  /** Títulos das pautas salvas/ativas recentes (máx. 2) — só para mapa enriquecido */
  pautasTitulos?: string[];
  /** Descoberta real do mapa (ex: novo território identificado) — opcional */
  descoberta?: string | null;
  /** URL base da plataforma para montar o CTA */
  baseUrl?: string;
}

export interface WhatsappMessageResult {
  body: string;
  segmento: "seed" | "rico";
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildPromptSeed(ctx: WhatsappMessageContext): string {
  const { creatorName, mapa, baseUrl } = ctx;
  const url = baseUrl ?? "https://data2content.com.br";

  return `Você é um assistente estratégico calmo para criadores de conteúdo.

Escreva UMA mensagem de WhatsApp para ${creatorName}.

Contexto:
- O criador acabou de iniciar seu mapa narrativo na plataforma Data2Content.
- Narrativa central do mapa: "${mapa.narrativa_central}"
- Territórios identificados: ${mapa.territorios.slice(0, 2).join(", ")}
- Mapa ainda em formação (maturidade: seed)

Objetivo da mensagem:
- Refletir algo real do mapa de volta para o criador (não elogiar)
- Convidar a enriquecer o mapa (conectar Instagram ou subir um vídeo)
- CTA: link direto para a plataforma, nomeado pelo benefício

Regras de escrita:
- Tom: como um estrategista que te conhece, não como um app de notificação
- Máx. 280 caracteres no total (incluindo CTA)
- Não use: "parabéns", "incrível", "seu conteúdo vai bombar"
- Não use emojis excessivos — no máximo 1
- Termine com: "Ver seu mapa → ${url}/mapa"

Retorne apenas o texto da mensagem. Sem aspas, sem explicação.`;
}

function buildPromptRico(ctx: WhatsappMessageContext): string {
  const { creatorName, mapa, pautasTitulos, descoberta, baseUrl } = ctx;
  const url = baseUrl ?? "https://data2content.com.br";
  const pautas = (pautasTitulos ?? []).slice(0, 2);
  const temPautas = pautas.length > 0;
  const temDescoberta = !!descoberta;

  return `Você é um assistente estratégico calmo para criadores de conteúdo.

Escreva UMA mensagem de WhatsApp para ${creatorName}.

Contexto do mapa:
- Narrativa central: "${mapa.narrativa_central}"
- Territórios: ${mapa.territorios.slice(0, 3).join(", ")}
- Tom: ${mapa.tom}
${temPautas ? `- Pautas disponíveis esta semana:\n  1. "${pautas[0]}"${pautas[1] ? `\n  2. "${pautas[1]}"` : ""}` : ""}
${temDescoberta ? `- Descoberta do mapa: ${descoberta}` : ""}

Estrutura da mensagem (use apenas o que existir):
${temPautas ? "1. Preview das pautas (título apenas, sem spoiler completo)" : ""}
${temDescoberta ? `${temPautas ? "2" : "1"}. Descoberta: mencione brevemente` : ""}
- Último: CTA direto nomeado pelo benefício

Regras:
- Tom: consultivo e pessoal, não newsletter corporativa
- Máx. 320 caracteres no total
- Não mencione métricas, views ou seguidores
- Não use: "poste mais", "bata o algoritmo"
- No máximo 1 emoji
- CTA final: "Ver suas pautas → ${url}/pautas"

Retorne apenas o texto da mensagem. Sem aspas, sem explicação.`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function generateWhatsappMessage(
  ctx: WhatsappMessageContext
): Promise<WhatsappMessageResult> {
  const TAG = "[mapaSeed][generateWhatsappMessage]";
  const isSeed = ctx.mapa.maturidade === "seed";
  const segmento: WhatsappMessageResult["segmento"] = isSeed ? "seed" : "rico";

  logger.info(`${TAG} Gerando mensagem WhatsApp | segmento=${segmento} | creator=${ctx.creatorName}`);

  const prompt = isSeed ? buildPromptSeed(ctx) : buildPromptRico(ctx);

  const body = await callClaude(prompt, {
    intensity: "medium",
    maxTokens: 256,
  });

  if (!body.trim()) {
    throw new Error("Mensagem WhatsApp gerada vazia.");
  }

  // Truncar se ultrapassar limite seguro
  const truncated = body.trim().slice(0, 400);

  logger.info(`${TAG} Mensagem gerada (${truncated.length} chars): "${truncated.slice(0, 60)}..."`);

  return { body: truncated, segmento };
}
