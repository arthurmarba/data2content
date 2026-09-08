import { Types } from "mongoose";
import { z } from "zod";
import CandidateModel from "@/app/models/CampaignRadarCandidate";
import CatalogModel from "@/app/models/CampaignRadarOpportunity";
import { connectToDatabase } from "@/app/lib/mongoose";
import { candidateKeys, candidateMutationSchema, manualOpportunity, observationFingerprint } from "./intake";
import { opportunitySchema, parseCampaignRadarBatch } from "./validation";
import { listCollectionPolicies } from "./collectionPolicy";
import { isSourceApprovedForPlugin, sourceRegistryEntry } from "./sourceRegistry";
import { normalizeOpportunityForCatalog } from "./catalog";
import { persistenceRecord, saoPauloDateKey } from "./repository";
import type { CampaignOpportunity } from "./types";
import RunModel from "@/app/models/CampaignRadarRun";
import { ensureRadarIndexes } from "./indexes";

export class RadarError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function ingestCandidate(value: CampaignOpportunity, intake: "manual" | "automatic", actor: string, now = new Date()) {
  const opportunity = opportunitySchema.parse(value);
  const { key, applicationKey } = candidateKeys(opportunity);
  const database = await connectToDatabase();
  await ensureRadarIndexes();
  const fingerprint = observationFingerprint(opportunity);
  const pending = { ...opportunity, review: { status: "pending" as const, reviewedAt: null, reviewedBy: null, notes: null } };
  // A observação e a retirada do catálogo precisam ser confirmadas juntas.
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await database.startSession();
    try {
      let candidateId: Types.ObjectId | undefined;
      await session.withTransaction(async () => {
        const current = await CandidateModel.findOne({ key }).session(session).lean();
        if (!current) {
          const [created] = await CandidateModel.create([{ key, applicationKey, opportunity: pending,
            originalOpportunity: pending, observationFingerprint: fingerprint, intake, decision: "pending", revision: 0,
            lastSeenAt: now, sightings: 1, history: [{ actor, action: "created", at: now, note: "Entrada para revisão." }],
          }], { session });
          candidateId = created!._id;
          return;
        }
        candidateId = current._id;
        const changed = (current.observationFingerprint ?? observationFingerprint(current.opportunity)) !== fingerprint;
        if (!changed) {
          // Reencontro idêntico preserva inclusive as correções feitas pelo administrador.
          return CandidateModel.findByIdAndUpdate(current._id, {
            $set: { lastSeenAt: now, observationFingerprint: fingerprint }, $inc: { sightings: 1 },
          }, { new: true, session }).lean();
        }
        await CatalogModel.updateOne({ opportunityId: `candidate:${current._id}` }, {
          $set: { activeInCatalog: false },
        }, { session });
        return CandidateModel.findByIdAndUpdate(current._id, {
          $set: { opportunity: { ...pending, discoveredAt: current.opportunity.discoveredAt },
            originalOpportunity: current.originalOpportunity ?? current.opportunity, previousOpportunity: current.opportunity,
            observationFingerprint: fingerprint, lastSeenAt: now, decision: "recheck" },
          $inc: { sightings: 1, revision: 1 },
          $push: { history: { $each: [{ actor, action: "source_changed", at: now,
            note: "As condições na origem mudaram. A versão anterior foi retirada do catálogo para nova revisão." }], $slice: -100 } },
        }, { new: true, session }).lean();
      });
      return CandidateModel.findById(candidateId).lean();
    } catch (error) {
      // Duas primeiras capturas simultâneas disputam a chave única; releia a vencedora.
      if ((error as { code?: number })?.code !== 11000 || attempt === 2) throw error;
    } finally { await session.endSession(); }
  }
  throw new RadarError("Não foi possível registrar a captura. Tente novamente.", 409);
}

export async function createManualCandidate(value: unknown, actor: string) {
  return ingestCandidate(manualOpportunity(value), "manual", actor);
}

export async function importCandidateBatch(value: unknown, actor: string) {
  const batch = parseCampaignRadarBatch(value);
  if (batch.opportunities.length > 500) throw new RadarError("Importe no máximo 500 oportunidades por lote.");
  for (const opportunity of batch.opportunities) await ingestCandidate(opportunity, "manual", actor);
  return { processed: batch.opportunities.length };
}

export async function listCandidates(params: URLSearchParams) {
  const { page, decision } = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    decision: z.enum(["all", "pending", "internal", "approved", "rejected", "recheck"]).default("pending"),
  }).parse(Object.fromEntries(params));
  await connectToDatabase();
  const filter = decision === "all" ? {} : { decision };
  const [items, total, counts, runs] = await Promise.all([
    CandidateModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 25).limit(25).select({ history: { $slice: -20 } }).lean(),
    CandidateModel.countDocuments(filter),
    CandidateModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$decision", count: { $sum: 1 } } }]),
    RunModel.find().sort({ startedAt: -1 }).limit(7).lean(),
  ]);
  const duplicateCounts = items.length ? await CandidateModel.aggregate<{ _id: string; count: number }>([
    { $match: { applicationKey: { $in: items.map((item) => item.applicationKey) } } },
    { $group: { _id: "$applicationKey", count: { $sum: 1 } } },
  ]) : [];
  return { items: items.map((item) => ({ ...item,
    possibleDuplicates: Math.max(0, (duplicateCounts.find((row) => row._id === item.applicationKey)?.count ?? 1) - 1),
    distributionAllowed: isSourceApprovedForPlugin(item.opportunity.sourceId),
  })), page, total, hasMore: page * 25 < total, counts, sources: listCollectionPolicies(), runs };
}

export function assertPublishable(opportunity: CampaignOpportunity, verifiedOpen: boolean, now = new Date()) {
  const source = sourceRegistryEntry(opportunity.sourceId);
  if (!source || !["public", "partial_public"].includes(source.inventoryVisibility) || !isSourceApprovedForPlugin(source.sourceId)) {
    throw new RadarError("A fonte ainda não tem distribuição liberada. Use ‘Somente interno’.");
  }
  if (!verifiedOpen || !opportunity.applicationDeadline || opportunity.applicationDeadline < saoPauloDateKey(now)) {
    throw new RadarError("Confirme a chamada aberta e informe um prazo de candidatura válido antes de publicar.");
  }
  if (["unknown", "informational", "invitation_only", "challenge"].includes(opportunity.opportunityType)) {
    throw new RadarError("Este tipo é um sinal interno ou convite; não pode entrar como oportunidade aberta.");
  }
}

export async function mutateCandidate(id: string, value: unknown, actor: string, now = new Date()) {
  if (!Types.ObjectId.isValid(id)) throw new RadarError("Registro inválido.");
  const input = candidateMutationSchema.parse(value);
  const database = await connectToDatabase();
  const session = await database.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await CandidateModel.findOne({ _id: id, revision: input.revision }).session(session).lean();
      if (!current) throw new RadarError("O registro mudou. Atualize a lista antes de salvar.", 409);
      const opportunity = input.action === "edit" ? manualOpportunity(input.input, now) : opportunitySchema.parse(current.opportunity);
      if (input.action === "edit") {
        opportunity.discoveredAt = current.opportunity.discoveredAt;
        opportunity.publishedAt = current.opportunity.publishedAt;
        opportunity.lastVerifiedAt = current.opportunity.lastVerifiedAt;
      }
      opportunity.id = `candidate:${id}`;
      const action = input.action;
      if (action === "approved") assertPublishable(opportunity, input.verifiedOpen, now);
      const decision = action === "edit" ? "pending" : action;
      const note = action === "edit" ? "Campos editados; nova revisão necessária." : input.note;
      opportunity.review = { status: action === "approved" ? "approved" : action === "rejected" ? "rejected" : "pending",
        reviewedAt: action === "edit" ? null : now.toISOString(), reviewedBy: action === "edit" ? null : actor, notes: note };
      if (action === "approved") { opportunity.status = "open"; opportunity.lastVerifiedAt = now.toISOString(); }
      const result = await CandidateModel.updateOne({ _id: id, revision: input.revision }, {
        $set: { opportunity, decision, applicationKey: candidateKeys(opportunity).applicationKey,
          ...(action === "edit" ? { originalOpportunity: current.originalOpportunity ?? current.opportunity,
            previousOpportunity: current.opportunity } : {}) }, $inc: { revision: 1 },
        $push: { history: { $each: [{ actor, action, at: now, note }], $slice: -100 } },
      }, { session });
      if (result.modifiedCount !== 1) throw new RadarError("Edição concorrente. Atualize a lista.", 409);
      if (action === "approved") {
        const normalized = normalizeOpportunityForCatalog(opportunity, saoPauloDateKey(now));
        normalized.catalogBatchId = `campaign-radar-admin:${id}`;
        await CatalogModel.updateOne({ opportunityId: opportunity.id }, { $set: persistenceRecord(normalized) }, { upsert: true, session });
      } else {
        await CatalogModel.updateOne({ opportunityId: opportunity.id }, { $set: { activeInCatalog: false } }, { session });
      }
    });
  } finally { await session.endSession(); }
  return { updated: true };
}
