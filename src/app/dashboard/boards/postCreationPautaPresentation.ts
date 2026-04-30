import type { PlannerUISlot } from "@/hooks/usePlannerData";
import { getCategoryByValue } from "@/app/lib/classification";

function normalizeText(value?: string | null): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function humanizeValue(value?: string | null): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  return normalized
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function lowerFirst(value: string): string {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function resolveThemeKeyword(slot: PlannerUISlot): string {
  return (
    normalizeText(slot.themeKeyword) ||
    normalizeText(slot.themes?.[0]) ||
    normalizeText(slot.title) ||
    "conteúdo"
  );
}

function resolveProposal(slot: PlannerUISlot): { id: string; label: string } {
  const raw = slot.categories?.proposal?.[0] || "";
  const category = raw ? getCategoryByValue(raw, "proposal") : null;
  return {
    id: category?.id || raw || "proposal",
    label: category?.label || humanizeValue(raw) || "Proposta",
  };
}

function resolveContext(slot: PlannerUISlot): { id: string; label: string } {
  const raw = slot.categories?.context?.[0] || "";
  const category = raw ? getCategoryByValue(raw, "context") : null;
  return {
    id: category?.id || raw || "context",
    label: category?.label || humanizeValue(raw) || "Contexto",
  };
}

export function buildPautaPhraseFromPlannerSlot(slot: PlannerUISlot): string {
  const theme = resolveThemeKeyword(slot);
  const proposal = resolveProposal(slot);
  const context = resolveContext(slot);
  const contextLabel = lowerFirst(context.label);

  switch (proposal.id) {
    case "announcement":
    case "news":
      return `O que mudou em ${theme} para ${contextLabel}`;
    case "behind_the_scenes":
      return `Bastidores de ${theme} em ${contextLabel}`;
    case "call_to_action":
      return `O próximo passo em ${theme} para ${contextLabel}`;
    case "clip":
      return `O corte sobre ${theme} que mais conecta com ${contextLabel}`;
    case "comparison":
      return `Comparação de ${theme} em ${contextLabel}`;
    case "giveaway":
      return `A ativação de ${theme} que engaja ${contextLabel}`;
    case "humor_scene":
      return `${theme} em ${contextLabel}: a cena que todo mundo vive`;
    case "lifestyle":
      return `${theme} na rotina de ${contextLabel}`;
    case "message_motivational":
      return `${theme}: a virada para ${contextLabel}`;
    case "participation":
      return `A participação sobre ${theme} que aproxima ${contextLabel}`;
    case "positioning_authority":
      return `O que ninguém te conta sobre ${theme} em ${contextLabel}`;
    case "publi_divulgation":
      return `Como apresentar ${theme} para ${contextLabel}`;
    case "q&a":
      return `Perguntas sobre ${theme} em ${contextLabel}`;
    case "react":
      return `Minha reação sobre ${theme} em ${contextLabel}`;
    case "review":
      return `Diagnóstico de ${theme} para ${contextLabel}`;
    case "tips":
      return `3 dicas de ${theme} para ${contextLabel}`;
    case "trend":
      return `A trend de ${theme} que faz sentido para ${contextLabel}`;
    case "unboxing":
      return `Unboxing de ${theme} para ${contextLabel}`;
    default: {
      const normalizedProposal = proposal.id.toLowerCase();
      if (normalizedProposal.includes("framework")) return `Framework de ${theme} para ${contextLabel}`;
      if (normalizedProposal.includes("checklist")) return `Checklist de ${theme} para ${contextLabel}`;
      if (normalizedProposal.includes("diagn")) return `Diagnóstico de ${theme} para ${contextLabel}`;
      if (normalizedProposal.includes("compar")) return `Comparação de ${theme} em ${contextLabel}`;
      return `${proposal.label} de ${theme} para ${contextLabel}`;
    }
  }
}

