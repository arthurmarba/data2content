import { Types } from 'mongoose';
import { readProposals } from '@/app/lib/collabs/proposals';
import { D2C_INTELLIGENCE_SCHEMA_VERSION } from './intelligenceContract';
/** O MCP lê as mesmas propostas já preparadas. Consultar nunca inicia IA. */
export async function suggestMcpCollabCreators(params: {
  userId: string; topic?: string; goal?: string; format?: 'reel' | 'carousel' | 'photo' | 'story' | 'any'; mode?: 'any' | 'remoto' | 'presencial'; limit?: number;
}) {
  if (!Types.ObjectId.isValid(params.userId)) return null;
  const state = await readProposals(params.userId);
  const declined = new Set(state.decisions.filter(item => item.decision === 'dismissed').map(item => item.pautaId));
  const topic = params.topic?.toLocaleLowerCase('pt-BR').trim();
  const items = state.ideas.flatMap(idea => {
    const collab = state.suggestions[idea.id];
    if (!collab || declined.has(idea.id) || collab.proposalState) return [];
    if (params.mode && params.mode !== 'any' && params.mode !== collab.collabMode) return [];
    if (topic && !`${idea.title} ${idea.territory} ${idea.angle}`.toLocaleLowerCase('pt-BR').includes(topic)) return [];
    return [{ proposalId: collab.proposalId, version: collab.proposalVersion, idea: { title: idea.title, angle: idea.angle, hook: idea.hook, territory: idea.territory },
      publicProfile: { name: collab.name, username: collab.username, avatarUrl: collab.avatarUrl, mediaKitUrl: collab.mediaKitSlug ? `https://data2content.ai/mediakit/${encodeURIComponent(collab.mediaKitSlug)}` : null },
      fitReason: collab.narrativeFitReason, sharedSignals: collab.sharedSignal ? [collab.sharedSignal] : [], complementarySignals: [collab.viewerContribution, collab.partnerContribution].filter(Boolean),
      recordingDirection: collab.collabRecordingIdea, blueprint: collab.collabBlueprint, mode: collab.collabMode, suggestedFormat: idea.suggestedFormat,
      confidence: 'exploratory', evidence: { source: 'shared_proposal', privateMetricsExposed: false },
    }];
  }).slice(0, Math.max(1, Math.min(5, Math.trunc(params.limit || 3))));
  return { schemaVersion: 'mcp_collab_suggestions_v1', intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION, items,
    reason: items.length ? null : 'no_prepared_proposals', nextStep: items.length ? null : 'Abra Collabs para preparar sugestões ou ajustar sua disponibilidade.',
    eligibility: { activeSubscriber: true, explicitCollabOptIn: true, preciseLocationExposed: false, privateMetricsExposed: false },
  };
}
