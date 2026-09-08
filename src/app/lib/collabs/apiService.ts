import { Types } from 'mongoose';
import Job from '@/app/models/CollabJob';
import Interest from '@/app/models/CollabInterest';
import Proposal from '@/app/models/CollabProposal';
import { getCollabInterestState, markMatchesCelebrated } from '@/app/dashboard/boards/videoUpload/collabInterestService';
import { celebrateProposals, decideProposal, endProposal, readProposals } from './proposals';
import { participantUsers, discoveryState, updateDiscovery, premium, type DiscoveryMode } from './eligibility';
import { matchingContext } from './matching';
import { jobPublic, requestJob, quotaStatus } from './jobs';
import { collabSettings, canGenerate } from './settings';
export async function collabsState(userId: string) {
  const [legacy, current, users, settings, jobs] = await Promise.all([getCollabInterestState(userId), readProposals(userId), participantUsers([userId]), collabSettings(), Job.find({ userId, kind: { $in: ['ideas', 'matching'] }, state: { $in: ['queued', 'running'] } }).limit(2).lean()]);
  const user = users[0];
  const notificationsReady = Boolean(settings.whatsappTemplateApproved && settings.whatsappTemplate && settings.whatsappApiVersion && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OUTBOUND_ENABLED !== 'false');
  const legacyIdea = (id: string, title: string, territory?: string | null) => ({ id, title, territory: territory || '', angle: 'Proposta anterior: revise o plano com a outra pessoa antes de gravar.', hook: '', assets: [], suggestedFormat: 'reel', tone: null, whyItFits: '', scriptPoints: [], scriptClosing: null, scriptBlueprint: null, resonanceNote: null, status: 'saved' as const, generatedAt: new Date(0).toISOString(), scheduledFor: null });
  const legacyIdeas = legacy.decisions.filter(item => item.decision === 'interested').map(item => legacyIdea(item.pautaId, item.pautaTitle || 'Ideia anterior', item.territory));
  const legacyMatches = legacy.matches.map(item => ({ ...item, pautaSnapshot: legacyIdea(item.pautaId, item.pautaSnapshot.title, item.pautaSnapshot.territory) }));
  return { ok: true, ...current, jobs: jobs.map(jobPublic), ideas: [...legacyIdeas, ...current.ideas], decisions: [...legacy.decisions, ...current.decisions], matches: [...legacyMatches, ...current.matches],
    discovery: { state: discoveryState(user), optedIn: discoveryState(user) === 'available', mode: user?.collabDiscoveryMode || 'remoto' },
    whatsappLinked: Boolean(user?.whatsappVerified && !user.whatsappOptOut && notificationsReady),
    whatsappUnavailableReason: !notificationsReady ? 'Os avisos de Collabs pelo WhatsApp ainda não estão ativos. Confira suas combinações aqui.' : user?.whatsappOptOut ? 'Você pausou os avisos no WhatsApp. Suas combinações continuam aqui.' : null,
    hasPremiumAccess: premium(user),
  };
}
export async function collabsPatch(userId: string, body: Record<string, unknown>) {
  if (typeof body.collabDiscoveryOptIn === 'boolean') {
    const mode: DiscoveryMode = body.mode === 'presencial' || body.mode === 'ambos' ? body.mode : 'remoto';
    return updateDiscovery(userId, body.collabDiscoveryOptIn, mode);
  }
  if (Array.isArray(body.exposedProposalIds)) {
    const ids = body.exposedProposalIds.filter((id): id is string => typeof id === 'string' && Types.ObjectId.isValid(id)).slice(0, 30);
    await Proposal.updateMany({ _id: { $in: ids }, participants: userId }, { $addToSet: { exposed: userId } });
    return { ok: true };
  }
  if (typeof body.endProposalId === 'string') return endProposal(userId, body.endProposalId);
  if (typeof body.cancelLegacyPautaId === 'string') {
    await Interest.updateOne({ user: userId, pautaId: body.cancelLegacyPautaId, matchedAt: null }, { $set: { decision: 'dismissed', expiresAt: new Date(Date.now() + 30 * 86400000) } });
    return { ok: true };
  }
  const ids = Array.isArray(body.celebratedPautaIds) ? body.celebratedPautaIds.filter((id): id is string => typeof id === 'string').slice(0, 100) : [];
  if (!ids.length) return { ok: false, reason: 'invalid_request' };
  await Promise.all([celebrateProposals(userId, ids), markMatchesCelebrated(userId, ids)]);
  return { ok: true };
}
export async function collabsDecision(userId: string, body: Record<string, unknown>) {
  const id = typeof body.proposalId === 'string' ? body.proposalId : '';
  const decision = body.decision;
  if (!Types.ObjectId.isValid(id) || !['interested', 'dismissed', 'cancelled'].includes(String(decision)) || !Number.isInteger(body.version)) return { ok: false, reason: 'refresh_required' };
  try { return await decideProposal(userId, id, Number(body.version), decision as 'interested' | 'dismissed' | 'cancelled'); }
  catch (error) { const reason = error instanceof Error ? error.message : ''; return { ok: false, reason: ['proposal_invalid', 'proposal_expired', 'proposal_unavailable', 'already_matched'].includes(reason) ? reason : 'decision_failed' }; }
}
export async function prepareCollabs(userId: string) {
  const state = await collabsState(userId);
  if (!state.hasPremiumAccess || !state.discovery.optedIn) return { ...state, matches: state.suggestions, processing: false, reason: 'discovery_required' };
  const { ideas, narrative, revision } = await matchingContext(userId);
  if (!ideas.length || !narrative || !(await canGenerate(userId))) return { ...state, matches: state.suggestions, processing: false, reason: !narrative ? 'map_incomplete' : 'no_ready_ideas' };
  const settings = await collabSettings();
  const used = await Job.countDocuments({ userId, kind: 'matching', createdAt: { $gte: new Date(Date.now() - 86400000) } });
  if (used >= settings.maxMatchingJobsPerDay) return { ...state, matches: state.suggestions, processing: false, reason: 'next_round_later' };
  const latest = await Job.findOne({ userId, kind: 'matching', 'payload.contextRevision': revision }).sort({ createdAt: -1 }).lean();
  const job = latest && latest.state !== 'failed' ? latest : await requestJob(userId, 'matching', { contextRevision: revision }, latest ? `${revision}:retry:${latest._id}` : revision);
  return { ...state, matches: state.suggestions, job: jobPublic(job), processing: job.state === 'queued' || job.state === 'running', reason: job.state === 'failed' ? 'matching_unavailable' : null };
}
export async function requestIdeas(userId: string, body: Record<string, unknown>, requestKey: string) {
  if (!(await canGenerate(userId))) return { status: 503, data: { ok: false, reason: 'generation_paused', message: 'Novas ideias estão temporariamente indisponíveis. Suas ideias salvas continuam aqui.' } };
  try {
    const job = await requestJob(userId, 'ideas', { count: body.count, focusedTerritory: typeof body.focusedTerritory === 'string' ? body.focusedTerritory.slice(0, 120) : null, focusedFormat: typeof body.focusedFormat === 'string' ? body.focusedFormat.slice(0, 60) : null }, requestKey.slice(0, 100));
    return { status: job.state === 'completed' ? 200 : 202, data: { ok: true, job: jobPublic(job) } };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'request_failed';
    return { status: reason === 'quota_exceeded' ? 429 : 503, data: { ok: false, reason, ...(reason === 'quota_exceeded' ? await quotaStatus(userId) : {}) } };
  }
}
