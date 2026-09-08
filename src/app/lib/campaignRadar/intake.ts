import { createHash } from "node:crypto";
import { z } from "zod";
import { opportunitySchema } from "./validation";
import { sourceRegistryEntry } from "./sourceRegistry";
import { defaultCompensation, inferFormats, inferPlatforms, inferTerritories } from "./normalization";
import type { CampaignOpportunity } from "./types";

const url = z.string().url().max(2000).refine((value) => {
  const parsed = new URL(value);
  return parsed.protocol === "https:" && !parsed.username && !parsed.password;
}, "Informe um link HTTPS sem credenciais.");
export const manualIntakeSchema = z.object({
  sourceId: z.string().max(120).default("manual-editorial").refine((id) => Boolean(sourceRegistryEntry(id)), "Fonte desconhecida."),
  title: z.string().trim().min(3).max(300),
  text: z.string().trim().min(10).max(3000),
  sourceUrl: url, applicationUrl: url,
  brand: z.string().trim().max(160).default(""),
  applicationDeadline: z.string().default(""),
  requirements: z.array(z.string().trim().min(1).max(1500)).max(30).default([]),
  deliverables: z.array(z.string().trim().min(1).max(1500)).max(30).default([]),
  opportunityType: z.enum(["open_application", "creator_program", "invitation_only", "challenge", "ugc", "barter", "informational", "unknown"]).default("unknown"),
  compensationType: z.enum(["unknown", "fixed", "range", "barter", "variable", "prize"]).default("unknown"),
  compensationMinimum: z.number().nonnegative().max(100_000_000).nullable().default(null),
  compensationMaximum: z.number().nonnegative().max(100_000_000).nullable().default(null),
  compensationBasis: z.enum(["unknown", "per_creator", "per_delivery", "per_view", "per_sale", "total_campaign_budget"]).default("unknown"),
  compensationText: z.string().trim().max(1000).default(""),
  compensationConfirmed: z.boolean().default(false),
  requiresAccount: z.boolean().default(true),
}).strict();
export type ManualIntake = z.infer<typeof manualIntakeSchema>;

export function canonicalApplicationUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = "";
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (/^(utm_.+|fbclid|gclid)$/i.test(key)) parsed.searchParams.delete(key);
  }
  parsed.searchParams.sort();
  return parsed.href;
}
export function candidateKeys(opportunity: CampaignOpportunity) {
  const applicationKey = createHash("sha256").update(canonicalApplicationUrl(opportunity.applicationUrl)).digest("hex");
  const key = createHash("sha256").update(JSON.stringify([
    opportunity.sourceId, applicationKey, opportunity.title.normalize("NFKC").toLocaleLowerCase("pt-BR").trim(), opportunity.applicationDeadline,
  ])).digest("hex");
  return { key, applicationKey };
}

export function observationFingerprint(opportunity: CampaignOpportunity): string {
  // Datas da execução e decisões editoriais não são mudanças na chamada.
  const { id, discoveredAt, lastVerifiedAt, review, ...content } = opportunity;
  return createHash("sha256").update(JSON.stringify({ ...content,
    sourceUrl: canonicalApplicationUrl(content.sourceUrl),
    applicationUrl: canonicalApplicationUrl(content.applicationUrl),
  })).digest("hex");
}
export function manualOpportunity(value: unknown, now = new Date()): CampaignOpportunity {
  const input = manualIntakeSchema.parse(value);
  return opportunitySchema.parse({
    id: `manual:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`,
    sourceId: input.sourceId, sourcePlatform: sourceRegistryEntry(input.sourceId)!.sourcePlatform,
    sourceUrl: input.sourceUrl, applicationUrl: input.applicationUrl, applicationLabel: "Conferir candidatura",
    requiresAccount: input.requiresAccount, title: input.title, brand: input.brand || null, summary: input.text,
    opportunityType: input.opportunityType, territories: inferTerritories(input.text), platforms: inferPlatforms(input.text),
    formats: inferFormats(input.text), requirements: input.requirements, deliverables: input.deliverables,
    compensation: { ...defaultCompensation(input.compensationText || null), type: input.compensationType,
      minimum: input.compensationMinimum, maximum: input.compensationMaximum, basis: input.compensationBasis,
      confirmed: input.compensationConfirmed, includesProduct: input.compensationType === "barter" },
    applicationDeadline: input.applicationDeadline || null, publishedAt: null,
    discoveredAt: now.toISOString(), lastVerifiedAt: now.toISOString(), status: "uncertain",
    evidence: [{ field: "captura_manual", excerpt: input.text.slice(0, 1500) }],
    review: { status: "pending", reviewedAt: null, reviewedBy: null, notes: null },
  });
}

export const candidateMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), revision: z.number().int().nonnegative(), input: manualIntakeSchema }).strict(),
  z.object({ action: z.enum(["internal", "approved", "rejected", "recheck"]), revision: z.number().int().nonnegative(),
    note: z.string().trim().min(3).max(2000), verifiedOpen: z.boolean().default(false) }).strict(),
]);
