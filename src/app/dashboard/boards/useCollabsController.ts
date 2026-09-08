'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContentIdeaListItem } from './videoUpload/contentIdeasReadService';
import type { NarrativeCollabMatch } from './videoUpload/narrativeCollabMatchingService';
import type { PautaActionState } from './components/videoUpload/appPreview/DiagnosticoCollabsFeed';

const BASE = '/api/dashboard/mobile-strategic-profile';
export interface CollabsSnapshot {
  jobs?: Array<{ id: string; state: string; kind: string }>;
  ideas: ContentIdeaListItem[];
  suggestions: Record<string, NarrativeCollabMatch>;
  replacedIdeaIds: string[];
  decisions: Array<{ pautaId: string; decision: 'interested' | 'dismissed'; collab?: NarrativeCollabMatch; expiresAt?: string }>;
  matches: Array<{ pautaId: string; pautaSnapshot?: ContentIdeaListItem; collab: NarrativeCollabMatch; isNew?: boolean }>;
  discovery: { state: 'available' | 'paused' | 'unknown'; optedIn: boolean; mode: 'remoto' | 'presencial' | 'ambos' };
  whatsappLinked: boolean;
  whatsappUnavailableReason?: string | null;
  hasPremiumAccess: boolean;
}
export async function collabsJson(url: string, init?: RequestInit) {
  const response = await fetch(`${BASE}/${url}`, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw Object.assign(new Error(data.message || data.reason || 'request_failed'), { reason: data.reason, data });
  return data;
}
const empty: CollabsSnapshot = { ideas: [], suggestions: {}, replacedIdeaIds: [], decisions: [], matches: [], discovery: { state: 'unknown', optedIn: false, mode: 'remoto' }, whatsappLinked: false, hasPremiumAccess: false };
const unique = (ideas: ContentIdeaListItem[]) => [...new Map(ideas.map(idea => [idea.id, idea])).values()];

export function useCollabsController(userId: string | null) {
  const [ideas, setIdeas] = useState<ContentIdeaListItem[]>([]);
  const [state, setState] = useState<CollabsSnapshot>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ usedBatches: number; reservedBatches: number; limitBatches: number; resetAt: string } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [generation, setGeneration] = useState(false);
  const [generationBlocker, setGenerationBlocker] = useState<'quota_exceeded' | 'map_incomplete' | 'failed' | null>(null);
  const [matching, setMatching] = useState(false);
  const [newRound, setNewRound] = useState(false);
  const [actions, setActions] = useState(new Map<string, PautaActionState>());
  const [undo, setUndo] = useState<{ id: string; status: string; decision?: boolean } | null>(null);
  const loaded = useRef(false), requestSequence = useRef(0), lastLoadedAt = useRef(0), inflight = useRef(new Set<string>());
  const alive = useRef(true), pendingIdeas = useRef<ContentIdeaListItem[]>([]), watchedJobs = useRef(new Set<string>());
  const stateRef = useRef(state); stateRef.current = state;
  const ideasRef = useRef(ideas); ideasRef.current = ideas;
  const epoch = useRef(0);
  const load = useCallback(async (acceptRound = false) => {
    if (!userId) return;
    const request = ++requestSequence.current;
    const results = await Promise.allSettled([collabsJson('content-ideas?activeOnly=true'), collabsJson('content-ideas?status=library'), collabsJson('collabs/interest')]);
    if (!alive.current || request !== requestSequence.current) return;
    const [active, saved, interest] = results;
    let snapshot = stateRef.current;
    if (interest?.status === 'fulfilled') {
      snapshot = { ...empty, ...interest.value };
      // A origem aceita é soberana, inclusive para decisões legadas.
      snapshot.suggestions = { ...snapshot.suggestions };
      for (const decision of snapshot.decisions) if (decision.collab) snapshot.suggestions[decision.pautaId] = decision.collab;
      for (const match of snapshot.matches) snapshot.suggestions[match.pautaId] = match.collab;
      setState(snapshot);
    }
    if (active?.status === 'fulfilled' || saved?.status === 'fulfilled') {
      const activeIdeas: ContentIdeaListItem[] = active?.status === 'fulfilled' ? active.value.ideas : ideasRef.current.filter(idea => idea.status === 'active');
      const savedIdeas: ContentIdeaListItem[] = saved?.status === 'fulfilled' ? saved.value.ideas : ideasRef.current.filter(idea => idea.status === 'saved' || idea.status === 'posted');
      const replacement = new Set(snapshot.replacedIdeaIds);
      const next = unique([...activeIdeas.filter((idea: ContentIdeaListItem) => !replacement.has(idea.id)), ...savedIdeas, ...snapshot.ideas, ...snapshot.matches.flatMap(match => match.pautaSnapshot ? [match.pautaSnapshot] : [])]);
      if (active?.status === 'fulfilled') setQuota(active.value.quota || null);
      if (saved?.status === 'fulfilled') setNextCursor(saved.value.nextCursor || null);
      pendingIdeas.current = next;
      if (!loaded.current || acceptRound) { setIdeas(next); setNewRound(false); }
      else {
        const previousIds = new Set(ideasRef.current.map(idea => idea.id));
        if (next.some(idea => idea.status === 'active' && !previousIds.has(idea.id))) setNewRound(true);
        setIdeas(previous => {
        const nextById = new Map(next.map(idea => [idea.id, idea]));
        return unique([...previous.map(idea => nextById.get(idea.id) || idea), ...next.filter(idea => idea.status !== 'active')]);
      }); }
      loaded.current = true; setReady(true);
    } else if (interest?.status === 'fulfilled') { setIdeas(previous => unique([...previous, ...snapshot.ideas, ...snapshot.matches.flatMap(match => match.pautaSnapshot ? [match.pautaSnapshot] : [])])); setReady(true); }
    setError(results.some(result => result.status === 'rejected') ? 'Uma parte das informações não carregou. Suas ideias e parcerias disponíveis continuam aqui.' : null);
    lastLoadedAt.current = Date.now();
  }, [userId]);
  const watch = useCallback(async (job: { id: string; state: string; kind: string; result?: any }) => {
    if (watchedJobs.current.has(job.id)) return;
    watchedJobs.current.add(job.id);
    const startedEpoch = epoch.current;
    const isIdeas = job.kind === 'ideas';
    const setBusy = isIdeas ? setGeneration : setMatching;
    setBusy(true);
    try {
      let current = job;
      for (let attempt = 0; attempt < 36 && alive.current && epoch.current === startedEpoch; attempt++) {
        if (current.state === 'completed') { await load(false); setNotice(isIdeas ? (current.result?.partial ? `Esta rodada entregou ${current.result.ideas.length} ideias aprovadas. Abra quando quiser.` : 'Suas novas ideias estão prontas. Abra a nova rodada quando quiser.') : 'A busca de parcerias terminou. Confira as novas sugestões disponíveis.'); return; }
        if (current.state === 'failed') throw new Error((current as any).reason || 'processing_failed');
        await new Promise(resolve => window.setTimeout(resolve, Math.min(2000 + attempt * 500, 6000)));
        if (!alive.current || epoch.current !== startedEpoch) return;
        if (document.visibilityState === 'hidden') continue;
        current = (await collabsJson(`collabs/jobs/${job.id}`)).job;
      }
      setNotice('O preparo continua em segundo plano. Você pode voltar depois ou atualizar o estado.');
    } catch (error) { if (alive.current && epoch.current === startedEpoch) { const incomplete = error instanceof Error && error.message === 'map_incomplete'; setError(incomplete ? 'Complete a narrativa e os territórios no Perfil para gerar ideias.' : 'Não foi possível concluir o preparo agora. Tente novamente.'); if (isIdeas) setGenerationBlocker(incomplete ? 'map_incomplete' : 'failed'); } }
    finally { watchedJobs.current.delete(job.id); if (alive.current) setBusy(false); }
  }, [load]);
  const prepare = useCallback(async () => {
    if (inflight.current.has('matching')) return;
    inflight.current.add('matching');
    try { const data = await collabsJson('collabs/per-pauta', { method: 'POST' }); if (data.job) void watch(data.job); else if (data.reason === 'discovery_required') setNotice('Ative sua disponibilidade para receber novas sugestões de parceria.'); else setNotice('Nenhuma nova parceria disponível nesta rodada. Suas ideias solo continuam aqui.'); }
    catch { setError('A busca de parceiros está indisponível. Suas pautas continuam acessíveis.'); }
    finally { inflight.current.delete('matching'); }
  }, [watch]);
  useEffect(() => {
    alive.current = true; epoch.current++; watchedJobs.current.clear(); inflight.current.clear();
    loaded.current = false;
    setReady(false); setIdeas([]); setState(empty); stateRef.current = empty; setGeneration(false); setMatching(false); setUndo(null); setActions(new Map());
    void load(true);
    const refresh = () => { if (document.visibilityState !== 'hidden' && Date.now() - lastLoadedAt.current >= 30000) void load(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { alive.current = false; requestSequence.current++; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  useEffect(() => { for (const job of state.jobs || []) void watch(job); }, [state.jobs, watch]);
  const generationKey = useRef<string | null>(null);
  const preparedFor = useRef('');
  useEffect(() => {
    if (ready && state.discovery.optedIn && preparedFor.current !== userId) { preparedFor.current = userId || ''; void prepare(); }
  }, [prepare, ready, state.discovery.optedIn, userId]);
  const generate = useCallback(async (focus?: { territory?: string; format?: string }) => {
    if (inflight.current.has('ideas')) return;
    inflight.current.add('ideas'); setGeneration(true); setGenerationBlocker(null); setError(null);
    try {
      const data = await collabsJson('content-ideas/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': generationKey.current || (generationKey.current = crypto.randomUUID()) }, body: JSON.stringify({ focusedTerritory: focus?.territory, focusedFormat: focus?.format }) });
      if (data.job) { generationKey.current = null; await watch(data.job); }
    } catch (error: any) {
      setGenerationBlocker(error.reason === 'quota_exceeded' ? 'quota_exceeded' : /map|narrative|territories/.test(error.reason) ? 'map_incomplete' : 'failed');
      if (error.data?.resetAt) setQuota(error.data);
      setError(error.reason === 'quota_exceeded' ? 'Você usou as rodadas deste mês. Suas ideias salvas continuam disponíveis.' : 'Não foi possível preparar novas ideias agora. Tente novamente.');
    } finally { inflight.current.delete('ideas'); setGeneration(false); }
  }, [watch]);
  const mutate = useCallback(async (id: string, kind: 'save' | 'unsave' | 'dismiss' | 'collab-interest' | 'collab-decline', status?: string) => {
    if (inflight.current.has(id)) return;
    inflight.current.add(id); setActions(previous => new Map(previous).set(id, { kind, phase: 'pending' }));
    try {
      const collab = stateRef.current.suggestions[id];
      if (kind === 'collab-interest' || kind === 'collab-decline') {
        await collabsJson('collabs/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: collab?.proposalId, version: collab?.proposalVersion, decision: kind === 'collab-interest' ? 'interested' : 'dismissed' }) });
        setUndo({ id, status: 'active', decision: true });
      } else {
        const previous = ideas.find(idea => idea.id === id)?.status || 'active';
        await collabsJson(`content-ideas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
        setIdeas(current => current.map(idea => idea.id === id ? { ...idea, status: status as ContentIdeaListItem['status'] } : idea));
        setUndo({ id, status: previous });
      }
      await load();
      setActions(previous => { const next = new Map(previous); next.delete(id); return next; });
    } catch { setActions(previous => new Map(previous).set(id, { kind, phase: 'failed', message: 'Não foi possível salvar sua escolha. Tente novamente.' })); }
    finally { inflight.current.delete(id); }
  }, [ideas, load]);
  const cancel = useCallback(async (id: string) => {
    const collab = stateRef.current.suggestions[id];
    try {
      if (stateRef.current.matches.some(match => match.pautaId === id)) { setNotice('A parceria já foi confirmada. Abra o plano para encerrar a combinação.'); return; }
      await collabsJson('collabs/interest', { method: collab?.proposalId ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collab?.proposalId ? { proposalId: collab.proposalId, version: collab.proposalVersion, decision: 'cancelled' } : { cancelLegacyPautaId: id }) });
      await load(); setUndo(null);
    } catch { setError('Não foi possível cancelar o interesse agora. Tente novamente.'); }
  }, [load]);
  const changeDiscovery = useCallback(async (available: boolean, mode: string) => {
    try { await collabsJson('collabs/interest', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ collabDiscoveryOptIn: available, mode }) }); preparedFor.current = ''; await load(); }
    catch (error: any) { setError(error.message?.includes('Confira') || error.data?.message ? error.data.message : 'Confira seu acesso Pro e seu @ do Instagram no Perfil para aparecer nas sugestões.'); }
  }, [load]);
  const end = useCallback(async (id: string) => {
    try { await collabsJson('collabs/interest', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endProposalId: id }) }); await load(); }
    catch { setError('Não foi possível encerrar a parceria. Tente novamente.'); throw new Error('end_failed'); }
  }, [load]);
  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try { const data = await collabsJson(`content-ideas?status=library&cursor=${nextCursor}`); setIdeas(previous => unique([...previous, ...data.ideas])); setNextCursor(data.nextCursor); }
    catch { setError('Não foi possível carregar mais ideias salvas. Tente novamente.'); }
  }, [nextCursor]);
  return { ideas, state, ready, error, notice, quota, nextCursor, generation, generationBlocker, matching, newRound, actions, undo,
    load, prepare, generate, mutate, cancel, changeDiscovery, loadMore, end,
    acceptRound: () => { setIdeas(previous => unique([...previous.filter(idea => idea.status === 'saved' || idea.status === 'posted'), ...pendingIdeas.current])); setNewRound(false); },
    undoLast: () => { if (undo?.decision) void cancel(undo.id); else if (undo) { void mutate(undo.id, undo.status === 'saved' ? 'save' : 'unsave', undo.status); setUndo(null); } },
  };
}
