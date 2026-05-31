/**
 * weeklyWhatsAppMessagePromptBuilder.ts
 *
 * Gemini prompt builders for the weekly WhatsApp newsletter.
 *
 * Three tiers — seed / growing / mature — each with different content depth,
 * aligned with the creator's map maturity:
 *
 *   seed     → narrative or territories not yet confirmed; show signal + invite to confirm
 *   growing  → both confirmed, < 6 readings; 2 pauta previews + optional discovery
 *   mature   → both confirmed, ≥ 6 readings; 3 pauta previews + optional discovery
 *
 * Template design (for Meta WABA approval):
 *
 *   d2c_weekly_seed_v1:
 *     Body: "{{1}}, seu mapa está tomando forma.\n\n{{2}}\n\n→ {{3}}"
 *
 *   d2c_weekly_newsletter_v1:
 *     Body: "{{1}}, seu mapa essa semana:\n\n{{2}}\n\n→ {{3}}"
 *
 * Where:
 *   {{1}} = creator first name
 *   {{2}} = AI-generated newsletter body (this module builds the prompt for it)
 *   {{3}} = CTA URL (assembled by the service, not by AI)
 */

// ─── Tier + template names ─────────────────────────────────────────────────────

export type WhatsAppMessageTier = "seed" | "growing" | "mature";

export const WHATSAPP_TEMPLATE_NAMES = {
  seed: "d2c_weekly_seed_v1",
  growing: "d2c_weekly_newsletter_v1",
  mature: "d2c_weekly_newsletter_v1",
} as const satisfies Record<WhatsAppMessageTier, string>;

// ─── Context types ─────────────────────────────────────────────────────────────

export interface WhatsAppSeedContext {
  tier: "seed";
  creatorFirstName: string;
  readingCount: number;
  narrativeLabel: string | null;
  territoriesLabels: string[];
  whyCreate: string | null;
}

export interface WhatsAppGrowingMatureContext {
  tier: "growing" | "mature";
  creatorFirstName: string;
  readingCount: number;
  narrativeLabel: string;
  territoriesLabels: string[];
  confirmedAssets: string[];
  toneLabel: string | null;
  /** Active/saved pautas — AI must use their titles verbatim, never invent new ones. */
  activeIdeas: Array<{
    title: string;
    hook: string;
    territory: string;
    suggestedFormat: string;
  }>;
  /**
   * Most recently endorsed hypothesis (from endorsedHypotheses array).
   * When present, AI should include a 🔍 discovery line.
   */
  latestHypothesis: string | null;
}

export type WhatsAppMessageContext = WhatsAppSeedContext | WhatsAppGrowingMatureContext;

// ─── System prompt ─────────────────────────────────────────────────────────────

export const WHATSAPP_SYSTEM_PROMPT = `\
Você é o mensageiro narrativo semanal da Data2Content — um companheiro estratégico que \
acompanha o trabalho do criador há meses.

Tom: calmo, consultivo e pessoal. Como uma mensagem de texto, não como email marketing.
Nunca use: "engajamento", "alcance", "algoritmo", "métricas", "crescimento", "performance".
Nunca use cumprimentos genéricos como "Espero que esteja bem" ou "Boa semana!".
Português brasileiro. Segunda pessoa (você).
Seja específico — mencione a narrativa ou território pelo nome quando disponível.
Não inclua o link de CTA (ele é adicionado separadamente).
Não finalize com despedida ou assinatura.`.trim();

// ─── Seed prompt ───────────────────────────────────────────────────────────────

/**
 * For creators whose narrative or territories are not yet confirmed.
 * Goal: name one real signal from the map + invite to confirm narrative.
 * Target length: ≤ 280 characters.
 */
export function buildSeedPrompt(ctx: WhatsAppSeedContext): {
  system: string;
  user: string;
} {
  const lines: string[] = [];
  lines.push(`Leituras analisadas até agora: ${ctx.readingCount}`);
  if (ctx.narrativeLabel) {
    lines.push(`Narrativa detectada pelo mapa: "${ctx.narrativeLabel}"`);
  }
  if (ctx.territoriesLabels.length > 0) {
    lines.push(`Territórios detectados: ${ctx.territoriesLabels.slice(0, 2).join(", ")}`);
  }
  if (ctx.whyCreate) {
    lines.push(`Por que o criador cria: "${ctx.whyCreate}"`);
  }

  const user = `\
Dados do mapa do criador ${ctx.creatorFirstName}:
${lines.join("\n")}

Escreva o corpo da newsletter semanal de WhatsApp para este criador.

Estrutura exigida (use exatamente):
[1 frase específica sobre o que o mapa detectou — mencione a narrativa ou território pelo nome se disponível]
[1 frase dizendo que os roteiros da semana já estão prontos e aparecem assim que o criador confirmar sua narrativa]

Regras:
- Seja específico: mencione "${ctx.narrativeLabel ?? ctx.territoriesLabels[0] ?? "o padrão detectado"}" pelo nome
- Máximo 280 caracteres no total
- Sem emojis
- Sem link (adicionado pelo sistema)`.trim();

  return { system: WHATSAPP_SYSTEM_PROMPT, user };
}

// ─── Growing / mature prompt ───────────────────────────────────────────────────

/**
 * For creators with narrative + territories confirmed.
 * Goal: preview 2-3 pauta titles (verbatim) + optional discovery line.
 * Target length: ≤ 460 characters.
 */
export function buildGrowingMaturePrompt(ctx: WhatsAppGrowingMatureContext): {
  system: string;
  user: string;
} {
  const previewCount = ctx.tier === "mature" ? 3 : 2;
  const ideasForPreview = ctx.activeIdeas.slice(0, previewCount);
  const extraCount = Math.max(0, ctx.activeIdeas.length - previewCount);

  // First idea gets its hook shown as a teaser line; the rest show title only.
  // (format, territory) removed — system metadata, not valuable in a WhatsApp message.
  const ideaLines = ideasForPreview
    .map((idea, i) => {
      const titleLine = `→ "${idea.title}"`;
      if (i === 0 && idea.hook) {
        return `${titleLine}\n  "${idea.hook}"`;
      }
      return titleLine;
    })
    .join("\n");

  const extraLine =
    extraCount > 0
      ? `(+ ${extraCount} roteiro${extraCount === 1 ? "" : "s"} completo${extraCount === 1 ? "" : "s"} esperando você)`
      : "";

  const lines: string[] = [];
  lines.push(`Narrativa confirmada: "${ctx.narrativeLabel}"`);
  lines.push(
    `Territórios: ${ctx.territoriesLabels.slice(0, 3).join(", ")}`,
  );
  if (ctx.toneLabel) lines.push(`Tom: ${ctx.toneLabel}`);
  if (ctx.confirmedAssets.length > 0) {
    lines.push(`Assets confirmados: ${ctx.confirmedAssets.slice(0, 4).join(", ")}`);
  }

  const user = `\
Dados do mapa do criador ${ctx.creatorFirstName}:
${lines.join("\n")}

Pautas ativas disponíveis (use os títulos EXATOS abaixo — nunca invente novos):
${ideaLines}
${extraLine ? `${extraLine}` : ""}
${ctx.latestHypothesis ? `\nNova descoberta recente no mapa: "${ctx.latestHypothesis}"` : ""}

Escreva o corpo da newsletter semanal de WhatsApp para este criador.

Estrutura exigida:
✍️ Pautas prontas:
→ "[título EXATO da pauta 1]"
  "[hook EXATO da pauta 1 — a frase de abertura do vídeo]"
→ "[título EXATO da pauta 2]"
[→ "[título EXATO da pauta 3]" — apenas se tier mature]
${extraLine ? `${extraLine}` : ""}
${
  ctx.latestHypothesis
    ? `\n🔍 Descoberta — [1 frase sobre "${ctx.latestHypothesis}" detectado no mapa; convide o criador a confirmar se faz sentido]`
    : ""
}

Regras críticas:
- Copie títulos e hook EXATAMENTE como aparecem acima — sem parafrasear nenhuma palavra
- O hook fica na linha logo abaixo do primeiro título, recuado com dois espaços
- Não inclua formato nem território nas linhas de título
- Não adicione seção de collab (não disponível ainda)
- Não inclua link ou CTA (adicionado pelo sistema)
- Máximo 460 caracteres no total
- Use emojis apenas nos labels de seção (✍️ e 🔍)`.trim();

  return { system: WHATSAPP_SYSTEM_PROMPT, user };
}
