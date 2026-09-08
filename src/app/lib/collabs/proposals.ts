import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import Proposal, { type CollabProposalRecord } from '@/app/models/CollabProposal';
import Job from '@/app/models/CollabJob';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { resolveCreatorAvatar } from '@/app/lib/avatar/creatorAvatar';
import type { ContentIdeaListItem } from '@/app/dashboard/boards/videoUpload/contentIdeasReadService';
import type { NarrativeCollabMatch } from '@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService';
import { DISCOVERY_FIELDS, eligible, compatibleMode, participantUsers, contactHandle } from './eligibility';

const DAY = 86400000;
export function mapValue<T>(map: Map<string, T> | Record<string, T> | undefined, id: string): T | undefined { return map instanceof Map ? map.get(id) : map?.[id]; }
export function proposalPerspective(proposal: Omit<CollabProposalRecord, "decisions" | "saved"> & { decisions: Map<string, any> | Record<string, any>; saved: Map<string, any> | Record<string, any> }, viewerId: string, partner: any): NarrativeCollabMatch {
  const original = proposal.originUserId === viewerId;
  const snapshot = proposal.partnerSnapshot;
  const flip = (owner: 'viewer' | 'partner' | 'both') => original || owner === 'both' ? owner : owner === 'viewer' ? 'partner' as const : 'viewer' as const;
  return {
    ...snapshot, id: String(partner?._id ?? proposal.participants.find(id => id !== viewerId)),
    name: partner?.name || 'Criador', username: contactHandle(partner), avatarUrl: partner ? resolveCreatorAvatar(partner) : null,
    mediaKitSlug: partner?.mediaKitSlug || null, narrativeExample: '', suggestedNarrativeLabel: '',
    proposalId: String(proposal._id), proposalVersion: proposal.version, expiresAt: proposal.expiresAt.toISOString(),
    narrativeFitReason: `Você: ${original ? snapshot.viewerContribution : snapshot.partnerContribution}. ${partner?.name || 'Outra pessoa'}: ${original ? snapshot.partnerContribution : snapshot.viewerContribution}.`,
    viewerContribution: original ? snapshot.viewerContribution : snapshot.partnerContribution,
    partnerContribution: original ? snapshot.partnerContribution : snapshot.viewerContribution,
    collabBlueprint: snapshot.collabBlueprint ? { ...snapshot.collabBlueprint, openingOwner: flip(snapshot.collabBlueprint.openingOwner), scenes: snapshot.collabBlueprint.scenes.map(scene => ({ ...scene, owner: flip(scene.owner) })) } : null,
  };
}
export function proposalIdea(proposal: Omit<CollabProposalRecord, "decisions" | "saved"> & { decisions: Map<string, any> | Record<string, any>; saved: Map<string, any> | Record<string, any> }, userId: string): ContentIdeaListItem {
  return { ...proposal.idea, id: String(proposal._id), status: mapValue(proposal.saved, userId) || (mapValue(proposal.decisions, userId) === 'interested' ? 'saved' : 'active'), generatedAt: proposal.createdAt.toISOString() };
}
export async function persistProposal(userId: string, idea: ContentIdeaListItem, match: NarrativeCollabMatch, revision: string) {
  await connectToDatabase();
  const users = await participantUsers([userId, match.id]);
  if (users.length !== 2 || !users.every(user => eligible(user)) || !compatibleMode(users[0]!, users[1]!)) return null;
  if (!match.collabBlueprint || !match.viewerContribution || !match.partnerContribution || !match.sharedIdea) return null;
  const participants = [userId, match.id].sort();
  // Reenvios do mesmo contexto reutilizam a proposta. A versão aceita nunca é sobrescrita.
  const key = crypto.createHash('sha256').update(JSON.stringify([participants, idea.id, revision, match.sharedIdea])).digest('hex');
  const document = {
    key, version: 1, participants, originUserId: userId, sourceIdeaId: idea.id, contextRevision: revision,
    idea: { ...idea, ...match.sharedIdea, assets: [], mapAnchors: [], scriptBlueprint: null, resonanceNote: null,
      whyItFits: match.narrativeFitReason, scriptPoints: [], scriptClosing: null,
      opportunityBrief: { version: 1, kind: 'collab_optional', whyNow: null, collabReason: match.narrativeFitReason,
        evidenceSummary: 'Proposta a partir dos assuntos e das contribuições compartilhadas pelos dois participantes.', evidenceLevel: 'exploratory', postsAnalyzed: 0, timing: null } },
    partnerSnapshot: match, expiresAt: new Date(Date.now() + 45 * DAY),
  };
  return Proposal.findOneAndUpdate({ key }, { $setOnInsert: document }, { upsert: true, new: true }).lean();
}

/** Nunca devolve acceptedBy, decisões de outra pessoa ou flags que revelem recusa unilateral. */
export async function readProposals(userId: string) {
  await connectToDatabase();
  const docs = await Proposal.find({ participants: userId, $or: [{ matchedAt: { $ne: null } }, { expiresAt: { $gt: new Date() } }, { [`saved.${userId}`]: 'saved' }] }).sort({ createdAt: -1 }).lean();
  const users = await participantUsers([...new Set(docs.flatMap(doc => doc.participants)), userId]);
  const byId = new Map(users.map(user => [String(user._id), user]));
  const viewer = byId.get(userId);
  const ideas: ContentIdeaListItem[] = [], matches: Array<{ pautaId: string; pautaSnapshot: ContentIdeaListItem; collab: NarrativeCollabMatch; isNew: boolean }> = [];
  const suggestions: Record<string, NarrativeCollabMatch> = {};
  const decisions: Array<{ pautaId: string; decision: 'interested' | 'dismissed'; collab: NarrativeCollabMatch; expiresAt: string }> = [];
  const replacedIdeaIds: string[] = [];
  for (const doc of docs) {
    const partner = byId.get(doc.participants.find(id => id !== userId)!);
    const decision = mapValue(doc.decisions, userId);
    const confirmed = !!doc.matchedAt && !doc.endedAt;
    const currentlyEligible = eligible(viewer) && eligible(partner) && !!compatibleMode(viewer!, partner!);
    const available = doc.expiresAt > new Date() && currentlyEligible && !doc.endedAt;
    // Um interesse próprio conserva o snapshot. A interface não revela o motivo de indisponibilidade do outro.
    if (!confirmed && !available && decision !== 'interested' && mapValue(doc.saved, userId) !== 'saved') continue;
    const idea = proposalIdea(doc, userId), collab = proposalPerspective(doc, userId, partner);
    ideas.push(idea);
    if (doc.originUserId === userId) replacedIdeaIds.push(doc.sourceIdeaId);
    if (doc.endedAt || doc.expiresAt <= new Date()) collab.proposalState = doc.endedAt ? 'ended' : 'expired';
    if (confirmed) matches.push({ pautaId: idea.id, pautaSnapshot: idea, collab, isNew: !doc.celebrated.includes(userId) });
    else if (decision) decisions.push({ pautaId: idea.id, decision: decision === 'interested' && !collab.proposalState ? 'interested' : 'dismissed', collab, expiresAt: doc.expiresAt.toISOString() });
    if (confirmed || available || decision === 'interested') suggestions[idea.id] = collab;
  }
  return { ideas, matches, suggestions, decisions, replacedIdeaIds };
}

export async function decideProposal(userId: string, id: string, version: number, decision: 'interested' | 'dismissed' | 'cancelled') {
  if (!Types.ObjectId.isValid(id)) return { ok: false, reason: 'proposal_invalid' };
  await connectToDatabase();
  let updated: CollabProposalRecord | null = null;
  await mongoose.connection.transaction(async session => {
    const doc = await Proposal.findOne({ _id: id, participants: userId, version }).session(session);
    if (!doc) throw new Error('proposal_invalid');
    if (doc.matchedAt && !doc.endedAt) {
      if (decision !== 'interested') throw new Error('already_matched');
      updated = doc.toObject(); return;
    }
    if (doc.endedAt || doc.expiresAt <= new Date()) throw new Error('proposal_expired');
    if (decision === 'interested') {
      // Escrever a revisão na mesma transação faz uma pausa concorrente invalidar
      // esta leitura. A repetição automática relê acesso e disponibilidade.
      const users = await User.find({ _id: { $in: doc.participants } }).select(DISCOVERY_FIELDS).session(session).lean();
      if (users.length !== 2 || !users.every(user => eligible(user)) || !compatibleMode(users[0]!, users[1]!)) throw new Error('proposal_unavailable');
      await User.updateMany({ _id: { $in: doc.participants } }, { $inc: { collabDecisionRevision: 1 } }, { session });
    }
    doc.decisions.set(userId, decision);
    if (decision === 'interested') {
      doc.saved.set(userId, 'saved');
      doc.acceptedBy = [...new Set([...doc.acceptedBy, userId])];
    } else {
      if (decision === 'cancelled') doc.saved.set(userId, 'active');
      doc.acceptedBy = doc.acceptedBy.filter(id => id !== userId);
    }
    if (doc.participants.every(id => doc.acceptedBy.includes(id))) {
      doc.matchedAt = new Date();
      // Evento e match são gravados juntos. O remetente do aviso consulta consentimento no worker.
      for (const recipient of doc.participants) {
        const key = `notification:${doc._id}:${recipient}`;
        await Job.updateOne({ key }, { $setOnInsert: { key, userId: recipient, kind: 'notification', payload: { proposalId: String(doc._id) }, state: 'queued', attempts: 0, nextAttemptAt: new Date() } }, { upsert: true, session });
      }
    }
    await doc.save({ session });
    updated = doc.toObject();
  });
  const result = updated as CollabProposalRecord | null;
  if (!result) return { ok: false, reason: 'proposal_invalid' };
  if (result.matchedAt) {
    const pending = await Job.find({ kind: 'notification', 'payload.proposalId': id, state: 'queued' }).select('_id').lean();
    const { publishJob } = await import('./jobs');
    await Promise.allSettled(pending.map(job => publishJob(String(job._id))));
  }
  const partner = (await participantUsers(result.participants)).find(user => String(user._id) !== userId);
  return { ok: true, matched: !!result.matchedAt, match: result.matchedAt ? proposalPerspective(result, userId, partner) : null };
}
export async function saveProposal(userId: string, id: string, status: string) {
  if (!Types.ObjectId.isValid(id) || !['active', 'saved', 'dismissed', 'posted'].includes(status)) return null;
  await connectToDatabase();
  const doc = await Proposal.findOneAndUpdate({ _id: id, participants: userId }, { $set: { [`saved.${userId}`]: status } }, { new: true }).lean();
  return doc ? { ok: true, status, updatedAt: doc.updatedAt.toISOString() } : null;
}
export async function celebrateProposals(userId: string, ids: string[]) {
  await connectToDatabase();
  await Proposal.updateMany({ _id: { $in: ids.filter(Types.ObjectId.isValid).slice(0, 100) }, participants: userId, matchedAt: { $ne: null } }, { $addToSet: { celebrated: userId } });
}
export async function endProposal(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) return { ok: false };
  await connectToDatabase();
  const result = await Proposal.updateOne({ _id: id, participants: userId, matchedAt: { $ne: null }, endedAt: null }, { $set: { endedAt: new Date() } });
  return { ok: result.matchedCount > 0 };
}
