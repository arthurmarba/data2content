import { idsToLabels, sanitizeLegacyProposalValues } from "@/app/lib/classification";
import { v2IdsToLabels } from "@/app/lib/classificationV2";
import { v25IdsToLabels } from "@/app/lib/classificationV2_5";

type PlanningPost = Record<string, any>;

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((entry) => String(entry).trim())
      .filter(Boolean);
  }
  if (!value) return [];
  return [String(value).trim()].filter(Boolean);
};

export function normalizePlanningPost<T extends PlanningPost>(post: T): T & {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
  contentIntent: string[];
  narrativeForm: string[];
  contentSignals: string[];
  stance: string[];
  proofStyle: string[];
  commercialMode: string[];
  metaLabel: string;
} {
  const formatRaw = toArray(post?.format).length ? toArray(post?.format) : toArray(post?.mediaType);
  const format = idsToLabels(formatRaw, "format");
  const proposal = idsToLabels(sanitizeLegacyProposalValues(toArray(post?.proposal)), "proposal");
  const context = idsToLabels(toArray(post?.context), "context");
  const tone = idsToLabels(toArray(post?.tone), "tone");
  const references = idsToLabels(toArray(post?.references ?? post?.reference), "reference");
  const contentIntent = v2IdsToLabels(toArray(post?.contentIntent), "contentIntent");
  const narrativeForm = v2IdsToLabels(toArray(post?.narrativeForm), "narrativeForm");
  const contentSignals = v2IdsToLabels(toArray(post?.contentSignals), "contentSignal");
  const stance = v25IdsToLabels(toArray(post?.stance), "stance");
  const proofStyle = v25IdsToLabels(toArray(post?.proofStyle), "proofStyle");
  const commercialMode = v25IdsToLabels(toArray(post?.commercialMode), "commercialMode");

  const metaLabel = [
    format.length ? `Formato: ${format.join(", ")}` : null,
    proposal.length ? `Proposta: ${proposal.join(", ")}` : null,
    contentIntent.length ? `Intenção: ${contentIntent.join(", ")}` : null,
    narrativeForm.length ? `Narrativa: ${narrativeForm.join(", ")}` : null,
    context.length ? `Contexto: ${context.join(", ")}` : null,
    tone.length ? `Tom: ${tone.join(", ")}` : null,
    references.length ? `Ref: ${references.join(", ")}` : null,
    contentSignals.length ? `Sinais: ${contentSignals.join(", ")}` : null,
    stance.length ? `Postura: ${stance.join(", ")}` : null,
    proofStyle.length ? `Prova: ${proofStyle.join(", ")}` : null,
    commercialMode.length ? `Modo comercial: ${commercialMode.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    ...post,
    format,
    proposal,
    context,
    tone,
    references,
    contentIntent,
    narrativeForm,
    contentSignals,
    stance,
    proofStyle,
    commercialMode,
    metaLabel,
    postDate: post?.postDate,
    stats: post?.stats ?? {},
  };
}
