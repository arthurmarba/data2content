"use client";
import { useEffect, useState } from 'react';
import type { IMapaData } from '@/app/models/MapaSeed';
import type { MapSuggestion } from '@/app/lib/mapaSeed/mapSuggestions';

const ENDPOINT = '/api/dashboard/mobile-strategic-profile/map-suggestions';
export function ProfileMapSuggestions({ mapa, onMapaChange }: { mapa: IMapaData | null; onMapaChange: (mapa: IMapaData | null) => void }) {
  const [liveMap, setLiveMap] = useState(mapa);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postponed, setPostponed] = useState<string[]>([]);
  useEffect(() => setLiveMap(mapa), [mapa]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!controller.signal.aborted && response.ok && data.mapa) setLiveMap(data.mapa);
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const decide = async (suggestion: MapSuggestion, action: 'accept' | 'dismiss', value?: string) => {
    setBusy(true); setError(null);
    try {
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: suggestion.id, action, expectedUpdatedAt: suggestion.updatedAt, ...(value ? { value } : {}) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Não foi possível salvar.');
      if (!data.mapa || typeof data.mapa !== 'object') throw new Error('A resposta não trouxe o mapa atualizado. Reabra a narrativa.');
      setLiveMap(data.mapa); onMapaChange(data.mapa); setEditing(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const suggestions = liveMap?.suggestions?.filter(item => ['pending', 'observing'].includes(item.state) && !postponed.includes(item.id)
    && (!['tom', 'narrativa_central'].includes(item.section) || liveMap[item.section] !== item.value)) ?? [];
  const observations = liveMap?.observacoes ?? [];
  if (suggestions.length === 0 && observations.length === 0) return null;
  return <section className="mt-5 rounded-[16px] border border-[var(--ds-color-line)] p-5" aria-label="Sugestões para revisar">
    <h2 className="font-semibold">Sugestões para revisar</h2>
    <p className="ds-caption mt-2">Sua escolha atual continua valendo até você aceitar ou editar uma sugestão.</p>
    {observations.map((observation, index) => <p className="ds-caption mt-2" key={index}>{observation}</p>)}
    {error ? <p role="alert" className="mt-3 text-[var(--ds-color-danger)]">{error}</p> : null}
    {suggestions.slice(0, 6).map(suggestion => <div key={suggestion.id} className="mt-4 border-t border-[var(--ds-color-line)] pt-4">
      {suggestion.previousValue ? <p className="ds-caption">Atual: {suggestion.previousValue}</p> : null}
      <p className="mt-2 font-medium">{suggestion.value}</p>
      <p className="ds-caption mt-2">{suggestion.reason} {suggestion.state === 'observing' ? 'Ainda é uma observação inicial.' : ''}</p>
      <details className="mt-2 text-[12px]"><summary>Leituras consideradas ({suggestion.evidence.length})</summary>
        {suggestion.evidence.slice(0, 12).map((ref, index) => <p key={ref.id}>{ref.url ? <a href={ref.url} className="underline" target="_blank" rel="noreferrer">Post {index + 1}</a> : `Leitura de vídeo ${index + 1}`}</p>)}
      </details>
      {editing === suggestion.id ? <label className="mt-3 block text-[13px]">Editar sugestão<textarea rows={3} className="mt-1 w-full rounded border p-2" value={draft} maxLength={['tom', 'narrativa_central'].includes(suggestion.section) ? 200 : 100} onChange={event => setDraft(event.target.value)} /></label> : null}
      <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
        <button disabled={busy || (editing === suggestion.id && !draft.trim())} onClick={() => void decide(suggestion, 'accept', editing === suggestion.id ? draft : undefined)} className="font-semibold underline">{editing === suggestion.id ? 'Salvar minha versão' : 'Aceitar'}</button>
        <button disabled={busy} onClick={() => { setEditing(suggestion.id); setDraft(suggestion.value); }}>Editar</button>
        <button disabled={busy} onClick={() => void decide(suggestion, 'dismiss')}>Manter como está</button>
        <button disabled={busy} onClick={() => setPostponed(previous => [...previous, suggestion.id])}>Revisar depois</button>
      </div>
    </div>)}
  </section>;
}
