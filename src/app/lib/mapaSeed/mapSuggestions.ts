import type { IMapaData } from '@/app/models/MapaSeed';
import { ENRICHABLE_ARRAY_SECTIONS, type CoreStabilityLocks } from './coreStabilityLocks';

export type SuggestionSection = 'narrativa_central' | 'tom' | typeof ENRICHABLE_ARRAY_SECTIONS[number];
export interface MapEvidenceRef { id: string; url?: string | null }
export interface MapSuggestion {
  id: string;
  section: SuggestionSection;
  value: string;
  previousValue: string | null;
  reason: string;
  state: 'observing' | 'pending' | 'accepted' | 'dismissed';
  evidence: MapEvidenceRef[];
  revisions: string[];
  createdAt: string;
  updatedAt: string;
  source: 'instagram' | 'video';
}
export interface MapSuggestionContext { revision: string; evidence: MapEvidenceRef[]; source: 'instagram' | 'video'; now?: Date }
const normalize = (value: string | undefined) => (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Mantém o núcleo e acumula propostas com evidência. Rodar novamente a mesma
 * leitura nunca aumenta a confiança; confirmação humana continua suficiente. */
export function reconcileMapSuggestions(current: IMapaData, enriched: IMapaData, proposed: Partial<IMapaData>, locks: CoreStabilityLocks | undefined, context?: MapSuggestionContext): IMapaData {
  if (!context || context.evidence.length === 0) return { ...enriched, suggestions: current.suggestions };
  const at = (context.now ?? new Date()).toISOString();
  const suggestions = (current.suggestions ?? []).map(suggestion => ({ ...suggestion }));
  const next = { ...enriched };
  const add = (section: SuggestionSection, value: string, previousValue: string | null, scalar: boolean) => {
    const normalized = normalize(value);
    if (!normalized || current.dismissedChips?.some(item => item.section === section && normalize(item.label) === normalized)) return;
    const existing = suggestions.find(item => item.section === section && normalize(item.value) === normalized);
    // Recusas explícitas não reaparecem. Uma proposta diferente é outra decisão.
    if (existing?.state === 'dismissed' || existing?.state === 'accepted') return;
    const newEvidence = context.evidence.filter(ref => !existing?.evidence.some(old => old.id === ref.id));
    const changed = !existing?.revisions.includes(context.revision) && newEvidence.length > 0;
    const evidence = [...new Map([...(existing?.evidence ?? []), ...context.evidence].map(ref => [ref.id, ref])).values()].slice(-60);
    const revisions = [...(existing?.revisions ?? []), ...(changed ? [context.revision] : [])].slice(-5);
    const state = scalar && (revisions.length < 2 || evidence.length < 2) ? 'observing' as const : 'pending' as const;
    const candidate: MapSuggestion = {
      id: existing?.id ?? `${context.source}:${section}:${context.revision.slice(0, 16)}:${suggestions.length}`,
      section, value: value.slice(0, scalar ? 200 : 100), previousValue,
      reason: scalar ? 'As leituras sugerem uma mudança. Sua escolha atual foi preservada.' : 'Identificado nas leituras; disponível para adicionar ao seu mapa.',
      state, evidence, revisions, createdAt: existing?.createdAt ?? at, updatedAt: at, source: context.source,
    };
    if (existing) Object.assign(existing, candidate); else suggestions.push(candidate);
  };
  for (const section of ['narrativa_central', 'tom'] as const) {
    const value = proposed[section]?.trim();
    if (!value || normalize(value) === normalize(current[section])) continue;
    add(section, value, current[section] || null, true);
    const locked = section === 'narrativa_central' ? locks?.narrativeLocked : locks?.toneLocked;
    const candidate = suggestions.find(item => item.section === section && normalize(item.value) === normalize(value));
    // Preenche um núcleo vazio após duas leituras. Uma frase já existente sempre
    // passa por revisão, inclusive se a confirmação chegar durante o trabalho.
    next[section] = current[section] || (!locked && candidate?.state === 'pending' ? value : current[section]);
  }
  for (const section of ENRICHABLE_ARRAY_SECTIONS) {
    for (const value of proposed[section] ?? []) {
      if (!next[section].some(item => normalize(item) === normalize(value))) add(section, value, null, false);
    }
  }
  // Limite de armazenamento só remove candidatos antigos não decididos. Decisões
  // ficam preservadas; o limite visual de chips não descarta propostas novas.
  const decided = suggestions.filter(item => ['accepted', 'dismissed'].includes(item.state));
  const candidates = suggestions.filter(item => !['accepted', 'dismissed'].includes(item.state))
    .filter(item => new Date(at).getTime() - new Date(item.updatedAt).getTime() <= 90 * 86400000)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 60);
  next.suggestions = [...decided, ...candidates];
  return next;
}
