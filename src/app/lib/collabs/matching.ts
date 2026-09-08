import crypto from 'node:crypto';
import { Types } from 'mongoose';
import Mapa from '@/app/models/MapaSeed';
import User from '@/app/models/User';
import Proposal from '@/app/models/CollabProposal';
import { connectToDatabase } from '@/app/lib/mongoose';
import { listContentIdeasForUser } from '@/app/dashboard/boards/videoUpload/contentIdeasReadService';
import { matchCollabsForPautas } from '@/app/dashboard/boards/videoUpload/perPautaCollabMatchingService';
import { persistProposal } from './proposals';
import { participantUsers, eligible } from './eligibility';
export async function matchingContext(userId: string) {
  await connectToDatabase();
  const [seed, allIdeas] = await Promise.all([Mapa.findOne({ userId: new Types.ObjectId(userId) }).select('mapa').lean(), listContentIdeasForUser(userId)]);
  const decided = await Proposal.find({ participants: userId, $or: [{ expiresAt: { $gt: new Date() } }, { matchedAt: { $ne: null } }] }).select('sourceIdeaId').lean();
  const assigned = new Set(decided.map(proposal => proposal.sourceIdeaId));
  const ideas = allIdeas.filter(idea => idea.status === 'active' && !assigned.has(idea.id)).slice(0, 3);
  const narrative = seed?.mapa?.narrativa_central || '';
  const revision = crypto.createHash('sha256').update(JSON.stringify({ version: 2, mapa: seed?.mapa, ideas: ideas.map(idea => [idea.id, idea.title, idea.hook]), window: Math.floor(Date.now() / 3600000) })).digest('hex');
  return { ideas, narrative, revision };
}
export async function prepareProposals(userId: string) {
  const viewers = await participantUsers([userId]);
  if (viewers.length !== 1 || !viewers.every(user => eligible(user))) return { count: 0, reason: 'discovery_required' };
  const { ideas, narrative, revision } = await matchingContext(userId);
  if (!ideas.length || !narrative) return { count: 0, reason: 'no_ready_ideas' };
  // Individual é a forma de gravar solo, não um veto antecipado a uma contribuição real.
  const matches = await matchCollabsForPautas(userId, ideas.map(idea => ({ ...idea, opportunityKind: 'collab_optional' as const })), narrative, { requireEvidence: true });
  let count = 0;
  for (const idea of ideas) {
    const match = matches.get(idea.id);
    if (!match?.sharedIdea) continue;
    const recentRefusal = await Proposal.exists({ participants: { $all: [userId, match.id] }, [`decisions.${userId}`]: { $in: ['dismissed', 'cancelled'] }, 'idea.territory': idea.territory, updatedAt: { $gt: new Date(Date.now() - 30 * 86400000) } });
    if (recentRefusal) continue;
    const proposal = await persistProposal(userId, idea, match, revision);
    if (proposal) {
      count++;
      await User.updateOne({ _id: match.id }, { $set: { collabLastShownAt: new Date() } });
    }
  }
  return { count, reason: count ? null : 'no_supported_partnership' };
}
