"use client";
import { useEffect, useState } from 'react';
import type { IMapaData } from '@/app/models/MapaSeed';
import type { MapSuggestion } from '@/app/lib/mapaSeed/mapSuggestions';

/**
 * As sugestões do mapa, UMA POR VEZ.
 *
 * Duas versões anteriores erraram na mesma direção: organizar sem apagar. Em
 * lista, cada sugestão repetia quatro ações e um botão preto grande — com quatro
 * sugestões eram dezesseis controles na tela, além de dois textos dizendo a
 * mesma coisa e três fios por card. Aqui a tela mostra uma decisão, com duas
 * ações à vista; editar, recusar e a evidência ficam a um toque.
 */

const ENDPOINT = '/api/dashboard/mobile-strategic-profile/map-suggestions';

/** O nome da dimensão em português de gente: sem isto, "Direto" não diz nada. */
const SECTION_LABEL: Record<string, string> = {
  narrativa_central: 'Sua frase',
  tom: 'Tom de voz',
  territorios: 'Territórios',
  temas: 'Assuntos',
  narrativas_adjacentes: 'Adjacências',
  assets: 'Da sua vida',
  formatos: 'Formatos',
};

/** Dimensão que é uma frase só troca; lista ganha item novo. */
const SCALAR_SECTIONS = ['tom', 'narrativa_central'];

const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--ds-color-ink)] px-6 text-[14px] font-bold text-white disabled:opacity-45';
const QUIET = 'min-h-[44px] px-1 text-[13px] font-semibold text-[var(--ds-color-text-secondary)] disabled:opacity-45';

export function ProfileMapSuggestions({ mapa, onMapaChange }: { mapa: IMapaData | null; onMapaChange: (mapa: IMapaData | null) => void }) {
  const [liveMap, setLiveMap] = useState(mapa);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postponed, setPostponed] = useState<string[]>([]);
  const [more, setMore] = useState(false);
  const [showObservations, setShowObservations] = useState(false);
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
      setLiveMap(data.mapa); onMapaChange(data.mapa); setEditing(false); setMore(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  };
  const suggestions = liveMap?.suggestions?.filter(item => ['pending', 'observing'].includes(item.state) && !postponed.includes(item.id)
    && (!['tom', 'narrativa_central'].includes(item.section) || liveMap[item.section] !== item.value)) ?? [];
  const observations = liveMap?.observacoes ?? [];
  if (suggestions.length === 0 && observations.length === 0) return null;

  const current = suggestions[0];
  const decided = (liveMap?.suggestions?.filter(item => ['pending', 'observing'].includes(item.state)).length ?? 0) - suggestions.length;
  const total = suggestions.length + decided;
  const scalar = current ? SCALAR_SECTIONS.includes(current.section) : false;
  const postpone = () => { if (current) { setPostponed(previous => [...previous, current.id]); setEditing(false); setMore(false); } };

  return <section className="mt-6" aria-label="Sugestões para revisar">
    {/* Contexto não pede toque: uma linha que abre, em vez de dez linhas abertas. */}
    {observations.length > 0 ? <div className="mb-3">
      <button type="button" aria-expanded={showObservations} onClick={() => setShowObservations(!showObservations)} className="min-h-[44px] text-[12.5px] font-semibold text-[var(--ds-color-text-muted)]">
        A leitura observou {observations.length === 1 ? 'uma coisa' : `${observations.length} coisas`} {showObservations ? '⌃' : '⌄'}
      </button>
      {showObservations ? <div className="mt-1 grid gap-2">
        {observations.map((observation, index) => <p className="text-[13px] leading-[1.45] text-[var(--ds-color-text-secondary)]" key={index}>{observation}</p>)}
      </div> : null}
    </div> : null}

    {error ? <p role="alert" className="mb-3 rounded-[12px] border border-[var(--ds-color-danger)] bg-[var(--ds-color-danger-soft)] px-3.5 py-2.5 text-[12.5px] leading-[1.4] text-[var(--ds-color-danger)]">{error}</p> : null}

    {current ? <article className="rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-4">
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ds-color-text-muted)]">
          {SECTION_LABEL[current.section] ?? 'Seu mapa'}
        </span>
        {total > 1 ? <span className="text-[11.5px] font-semibold text-[var(--ds-color-text-muted)]">{decided + 1} de {total}</span> : null}
      </header>

      {/* O valor sugerido é a manchete; o atual, legenda. Como grade de rótulos
          (HOJE/SUGERIDO) a decisão lia como formulário. */}
      <p className="mt-2 text-[21px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--ds-color-ink)]">{current.value}</p>
      {current.previousValue ? <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--ds-color-text-muted)]">
        hoje: {current.previousValue}
      </p> : <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--ds-color-text-muted)]">
        {scalar ? 'ainda sem escolha sua' : 'entra na sua lista, sem tirar nada'}
      </p>}
      {current.state === 'observing' ? <p className="mt-1.5 text-[12px] text-[var(--ds-color-text-muted)]">Ainda é observação inicial.</p> : null}

      {editing ? <label className="mt-3 block text-[12.5px] font-semibold text-[var(--ds-color-ink)]">Escreva do seu jeito
        <textarea rows={3} autoFocus className="mt-1.5 w-full rounded-[12px] border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-3 text-[14px] font-normal leading-[1.4] text-[var(--ds-color-ink)] outline-none" value={draft} maxLength={scalar ? 200 : 100} onChange={event => setDraft(event.target.value)} />
      </label> : null}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" disabled={busy || (editing && !draft.trim())} onClick={() => void decide(current, 'accept', editing ? draft : undefined)} className={PRIMARY}>{editing ? 'Salvar' : 'Aceitar'}</button>
        {editing
          ? <button type="button" disabled={busy} onClick={() => setEditing(false)} className={QUIET}>Cancelar</button>
          : <button type="button" disabled={busy} onClick={postpone} className={QUIET}>Depois</button>}
        {/* Recusar, editar e a prova cabem atrás de um toque: à vista, as quatro
            ações se repetiam em cada sugestão e dominavam a tela. */}
        {!editing ? <button type="button" aria-expanded={more} aria-label="Mais opções" onClick={() => setMore(!more)} className="ml-auto min-h-[44px] px-2 text-[16px] font-bold text-[var(--ds-color-text-muted)]">⋯</button> : null}
      </div>

      {more && !editing ? <div className="mt-2 grid justify-items-start gap-1 border-t border-[var(--ds-color-line)] pt-2">
        <button type="button" disabled={busy} onClick={() => { setEditing(true); setDraft(current.value); setMore(false); }} className={QUIET}>Editar antes de aceitar</button>
        <button type="button" disabled={busy} onClick={() => void decide(current, 'dismiss')} className={QUIET}>Não usar esta sugestão</button>
        {current.evidence.length > 0 ? <details className="text-[12.5px] text-[var(--ds-color-text-muted)]">
          <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Ver as {current.evidence.length} leituras que sugeriram isso</summary>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pb-1">
            {current.evidence.slice(0, 12).map((ref, index) => <span key={ref.id}>
              {ref.url ? <a href={ref.url} className="underline underline-offset-[3px]" target="_blank" rel="noreferrer">Post {index + 1}</a> : `Vídeo ${index + 1}`}
            </span>)}
          </div>
        </details> : null}
      </div> : null}
    </article> : null}
  </section>;
}
