"use client";
import { useEffect, useState } from 'react';
import type { IMapaData } from '@/app/models/MapaSeed';
import type { MapSuggestion } from '@/app/lib/mapaSeed/mapSuggestions';

/**
 * As sugestões do mapa, uma decisão por card.
 *
 * A versão anterior era um muro de texto: o valor proposto aparecia em negrito
 * sem dizer DE QUE dimensão ele era, o valor atual ficava na letra mais apagada
 * da tela — sendo a comparação o ponto todo — e as quatro ações tinham o mesmo
 * peso de link. Aqui cada sugestão é um card com rótulo, antes/depois e uma
 * ação principal; recusar e adiar continuam disponíveis, em segundo plano.
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

/**
 * Preto e branco: `ds-button--primary` é rosa e o rosa não é a marca.
 * Classe escrita à mão por inteiro — o Tailwind lê o código como texto e não
 * gera estilo para nome de classe montado com variável.
 */
const PRIMARY =
  'inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-[var(--ds-color-ink)] px-4 text-[13.5px] font-bold text-white disabled:opacity-45';
const QUIET =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--ds-color-line-strong)] px-4 text-[13px] font-semibold text-[var(--ds-color-text-secondary)] disabled:opacity-45';

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[62px_minmax(0,1fr)] items-baseline gap-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ds-color-text-muted)]">{label}</span>
      <p
        className={
          strong
            ? 'text-[15px] font-semibold leading-[1.35] text-[var(--ds-color-ink)]'
            : 'text-[13.5px] leading-[1.4] text-[var(--ds-color-text-secondary)]'
        }
      >
        {value}
      </p>
    </div>
  );
}

export function ProfileMapSuggestions({ mapa, onMapaChange }: { mapa: IMapaData | null; onMapaChange: (mapa: IMapaData | null) => void }) {
  const [liveMap, setLiveMap] = useState(mapa);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postponed, setPostponed] = useState<string[]>([]);
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);
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
  const visible = suggestions.slice(0, 6);
  return <section className="mt-6" aria-label="Sugestões para revisar">
    <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-[17px] font-bold tracking-[-0.02em] text-[var(--ds-color-ink)]">Sugestões para revisar</h2>
      {visible.length > 0 ? <span className="text-[12px] font-semibold text-[var(--ds-color-text-muted)]">{visible.length === 1 ? '1 sugestão' : `${visible.length} sugestões`}</span> : null}
    </header>
    <p className="mt-1.5 text-[12.5px] leading-[1.45] text-[var(--ds-color-text-muted)]">Nada muda sem você aceitar.</p>

    {error ? <p role="alert" className="mt-3 rounded-[12px] border border-[var(--ds-color-danger)] bg-[var(--ds-color-danger-soft)] px-3.5 py-2.5 text-[12.5px] leading-[1.4] text-[var(--ds-color-danger)]">{error}</p> : null}

    {/* Divergência entre o que a leitura viu e o que foi confirmado: é aviso,
        não decisão — fica fora da fila de cards, para não pedir toque. */}
    {observations.length > 0 ? <div className="mt-4 rounded-[14px] bg-[var(--ds-color-neutral)] p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ds-color-text-muted)]">O que a leitura observou</p>
      {observations.map((observation, index) => <p className="mt-2 text-[13px] leading-[1.45] text-[var(--ds-color-text-secondary)]" key={index}>{observation}</p>)}
    </div> : null}

    <div className="mt-4 grid gap-3">
      {visible.map(suggestion => {
        const scalar = SCALAR_SECTIONS.includes(suggestion.section);
        const label = SECTION_LABEL[suggestion.section] ?? 'Seu mapa';
        const isEditing = editing === suggestion.id;
        const evidenceOpen = openEvidence === suggestion.id;
        return <article key={suggestion.id} className="rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--ds-color-line-strong)] px-2.5 py-1 text-[11px] font-bold text-[var(--ds-color-ink)]">{label}</span>
            {suggestion.state === 'observing' ? <span className="text-[11px] font-semibold text-[var(--ds-color-text-muted)]">observação inicial</span> : null}
          </div>

          <div className="mt-3 grid gap-2">
            {suggestion.previousValue ? <Field label="Hoje" value={suggestion.previousValue} /> : null}
            <Field label={scalar ? 'Sugerido' : 'Adicionar'} value={suggestion.value} strong />
          </div>

          <p className="mt-3 text-[12.5px] leading-[1.45] text-[var(--ds-color-text-muted)]">{suggestion.reason}</p>

          {isEditing ? <label className="mt-3 block text-[12.5px] font-semibold text-[var(--ds-color-ink)]">Escreva do seu jeito
            <textarea rows={3} autoFocus className="mt-1.5 w-full rounded-[12px] border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-3 text-[14px] font-normal leading-[1.4] text-[var(--ds-color-ink)] outline-none" value={draft} maxLength={scalar ? 200 : 100} onChange={event => setDraft(event.target.value)} />
          </label> : null}

          <div className="mt-3.5 flex flex-wrap gap-2">
            <button type="button" disabled={busy || (isEditing && !draft.trim())} onClick={() => void decide(suggestion, 'accept', isEditing ? draft : undefined)} className={PRIMARY}>{isEditing ? 'Salvar minha versão' : 'Aceitar'}</button>
            {isEditing
              ? <button type="button" disabled={busy} onClick={() => setEditing(null)} className={QUIET}>Cancelar</button>
              : <button type="button" disabled={busy} onClick={() => { setEditing(suggestion.id); setDraft(suggestion.value); }} className={QUIET}>Editar</button>}
          </div>
          {isEditing ? null : <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" disabled={busy} onClick={() => void decide(suggestion, 'dismiss')} className="min-h-[36px] text-[12.5px] font-semibold text-[var(--ds-color-text-secondary)] underline decoration-[var(--ds-color-line-strong)] underline-offset-[3px] disabled:opacity-45">Manter como está</button>
            <button type="button" disabled={busy} onClick={() => setPostponed(previous => [...previous, suggestion.id])} className="min-h-[36px] text-[12.5px] font-medium text-[var(--ds-color-text-muted)] disabled:opacity-45">Ver depois</button>
          </div>}

          {/* Evidência fica a um toque, fechada: é a prova, não a leitura principal. */}
          {suggestion.evidence.length > 0 ? <div className="mt-2 border-t border-[var(--ds-color-line)] pt-2.5">
            <button type="button" aria-expanded={evidenceOpen} onClick={() => setOpenEvidence(evidenceOpen ? null : suggestion.id)} className="min-h-[36px] text-[12px] font-semibold text-[var(--ds-color-text-muted)]">
              {evidenceOpen ? 'Ocultar' : 'Ver'} as {suggestion.evidence.length} leituras que sugeriram isso
            </button>
            {evidenceOpen ? <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {suggestion.evidence.slice(0, 12).map((ref, index) => <span key={ref.id} className="text-[12px] text-[var(--ds-color-text-muted)]">
                {ref.url ? <a href={ref.url} className="underline underline-offset-[3px]" target="_blank" rel="noreferrer">Post {index + 1}</a> : `Vídeo ${index + 1}`}
              </span>)}
            </div> : null}
          </div> : null}
        </article>;
      })}
    </div>
  </section>;
}
