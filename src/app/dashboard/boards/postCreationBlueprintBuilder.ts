import type { PlannerUISlot } from "@/hooks/usePlannerData";

import type { PostCreationBlueprint, PostCreationBlueprintScene } from "./postCreationFunnel";
import { buildPautaPhraseFromPlannerSlot } from "./postCreationPautaPresentation";

function truncateText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.7 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function formatCategoryLabel(value?: string | null) {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function getDayLabel(dayOfWeek?: number) {
  const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  if (typeof dayOfWeek !== "number") return "Dia";
  if (dayOfWeek === 7) return labels[0];
  return labels[dayOfWeek] || "Dia";
}

function getBlockLabel(hour?: number) {
  if (typeof hour !== "number") return "Horário";
  return `${String(hour).padStart(2, "0")}h`;
}

function formatPlannerFormatLabel(format?: string) {
  if (!format) return "Formato";
  const normalized = format.toLowerCase();
  if (normalized === "reel") return "Reels direto";
  if (normalized === "carousel") return "Carrossel";
  if (normalized === "story") return "Stories";
  return format;
}

function inferNarrativeLabel(slot?: PlannerUISlot | null) {
  const narrative = slot?.narrativeForm?.[0];
  if (narrative) return formatCategoryLabel(narrative);
  if (slot?.scriptShort && /erro|ajuste|prova/i.test(slot.scriptShort)) {
    return "Erro -> ajuste -> prova";
  }
  if (slot?.scriptShort && /bastidor|rotina/i.test(slot.scriptShort)) {
    return "Bastidor -> ajuste -> conversa";
  }
  return "Erro -> ajuste -> prova";
}

function buildSceneSet(slot: PlannerUISlot, titleOverride?: string | null): PostCreationBlueprintScene[] {
  const theme =
    titleOverride?.trim() ||
    slot.themeKeyword?.trim() ||
    slot.themes?.[0]?.trim() ||
    slot.title?.trim() ||
    "a pauta escolhida";
  const formatLabel = formatPlannerFormatLabel(slot.format);
  const proposalLabel = formatCategoryLabel(slot.categories?.proposal?.[0] || null) || "Diagnóstico";
  const contextLabel = formatCategoryLabel(slot.categories?.context?.[0] || null) || "contexto real";
  const toneLabel = formatCategoryLabel(slot.categories?.tone || null) || "direto";
  const narrativeLabel = inferNarrativeLabel(slot);
  const summary = truncateText(slot.scriptShort || slot.rationale || theme, 120);

  return [
    {
      id: "scene-1",
      title: "Gancho",
      visual:
        slot.format === "carousel"
          ? `Primeiro slide com promessa curta sobre ${theme}.`
          : slot.format === "story"
            ? `Story inicial olhando para a câmera com texto curto sobre ${theme}.`
            : `Close no rosto com texto na tela abrindo ${theme}.`,
      message: `Abrir nomeando a dor ou erro ligado a ${theme}.`,
      direction: `Tom ${toneLabel.toLowerCase()}, frase curta e ritmo rápido.`,
      rationale: `Gancho curto sustenta melhor ${proposalLabel.toLowerCase()} em ${formatLabel.toLowerCase()}.`,
    },
    {
      id: "scene-2",
      title: "Contexto",
      visual:
        slot.format === "carousel"
          ? `Segundo slide com exemplo concreto ou contraste visual.`
          : `Mostrar exemplo real, bastidor ou tela que prove o problema.`,
      message: `Contextualizar a pauta em ${contextLabel.toLowerCase()} com exemplo observável.`,
      direction: `Didático, sem enrolar, deixando claro por que isso importa.`,
      rationale: `Contexto visível evita que a pauta fique abstrata demais.`,
    },
    {
      id: "scene-3",
      title: "Virada prática",
      visual:
        slot.format === "carousel"
          ? `Slide central com critério, framework ou antes/depois.`
          : `Abrir bloco de notas, print ou antes/depois com o ajuste principal.`,
      message: `Entregar o ajuste principal seguindo ${narrativeLabel.toLowerCase()}.`,
      direction: `Objetivo e aplicável, com critério simples para copiar.`,
      rationale: `Essa parte transforma a pauta em algo útil e salvável.`,
    },
    {
      id: "scene-4",
      title: "Fechamento",
      visual:
        slot.format === "story"
          ? `Story final com pergunta curta e CTA de resposta.`
          : `Voltar para câmera com pergunta final ou CTA curto na tela.`,
      message: `Fechar puxando continuação natural da conversa sobre ${theme}.`,
      direction: `Tom conversado, sem CTA burocrático.`,
      rationale: `Pergunta específica tende a gerar resposta melhor do que CTA genérico.`,
    },
  ].map((scene) => ({
    ...scene,
    visual: truncateText(scene.visual, 110),
    message: truncateText(scene.message, 110),
    direction: truncateText(scene.direction, 96),
    rationale: truncateText(scene.rationale, 110),
  }));
}

export function buildBlueprintFromPlannerSlot(
  slot: PlannerUISlot | null,
  options?: { titleOverride?: string | null }
): PostCreationBlueprint | null {
  if (!slot) return null;

  const formatLabel = formatPlannerFormatLabel(slot.format);
  const proposalLabel = formatCategoryLabel(slot.categories?.proposal?.[0] || null) || "Proposta";
  const contextLabel = formatCategoryLabel(slot.categories?.context?.[0] || null);
  const whyThisPathBase = slot.rationale?.trim() || "Combinação editorial apoiada pelo planner.";
  const titleOverride = options?.titleOverride?.trim() || null;

  return {
    whatToPost: titleOverride || buildPautaPhraseFromPlannerSlot(slot),
    whyThisPath: truncateText(
      contextLabel
        ? `${whyThisPathBase} Formato ${formatLabel.toLowerCase()} com ${proposalLabel.toLowerCase()} no contexto ${contextLabel.toLowerCase()}.`
        : `${whyThisPathBase} Formato ${formatLabel.toLowerCase()} com ${proposalLabel.toLowerCase()}.`,
      180
    ),
    whenToPost: `${getDayLabel(slot.dayOfWeek)}, ${getBlockLabel(slot.blockStartHour)}`,
    howItShouldWork: truncateText(slot.scriptShort || inferNarrativeLabel(slot), 160),
    scenes: buildSceneSet(slot, titleOverride),
  };
}
