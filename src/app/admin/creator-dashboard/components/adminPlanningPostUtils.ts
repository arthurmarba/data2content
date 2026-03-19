import { idsToLabels } from "@/app/lib/classification";

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
  metaLabel: string;
} {
  const formatRaw = toArray(post?.format).length ? toArray(post?.format) : toArray(post?.mediaType);
  const format = idsToLabels(formatRaw, "format");
  const proposal = idsToLabels(toArray(post?.proposal), "proposal");
  const context = idsToLabels(toArray(post?.context), "context");
  const tone = idsToLabels(toArray(post?.tone), "tone");
  const references = idsToLabels(toArray(post?.references ?? post?.reference), "reference");

  const metaLabel = [
    format.length ? `Formato: ${format.join(", ")}` : null,
    proposal.length ? `Proposta: ${proposal.join(", ")}` : null,
    context.length ? `Contexto: ${context.join(", ")}` : null,
    tone.length ? `Tom: ${tone.join(", ")}` : null,
    references.length ? `Ref: ${references.join(", ")}` : null,
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
    metaLabel,
    postDate: post?.postDate,
    stats: post?.stats ?? {},
  };
}
