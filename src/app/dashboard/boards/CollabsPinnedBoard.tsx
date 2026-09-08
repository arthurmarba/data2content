"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bookmark, CircleDot, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import Board from "@/app/dashboard/components/Board";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
import { DiagnosticoCollabsFeed, type CollabsBootstrapStatus } from "./components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import { DiagnosticoIdeaDetailSheet } from "./components/videoUpload/appPreview/DiagnosticoIdeaDetailSheet";
import { DiagnosticoCollabMatchOverlay } from "./components/videoUpload/appPreview/DiagnosticoCollabMatchOverlay";
import { MediaKitSheet } from "./components/videoUpload/appPreview/MediaKitSheet";
import type { ContentIdeaListItem } from "./videoUpload/contentIdeasReadService";
import { useCollabsController, collabsJson } from "./useCollabsController";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

export default function CollabsPinnedBoard({ showTitleMarker = true, isHighlighted = false, dedicatedView = false, embedded = false, onBackToPerfil, onConnectWhatsApp, focusedTerritory }: {
  showTitleMarker?: boolean; isHighlighted?: boolean; dedicatedView?: boolean; embedded?: boolean;
  onBackToPerfil?: () => void; onConnectWhatsApp?: () => void; focusedTerritory?: string | null;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const c = useCollabsController(session?.user?.id || null);
  const [openIdeaId, setOpenIdeaId] = React.useState<string | null>(null);
  const [openMatchId, setOpenMatchId] = React.useState<string | null>(null);
  const [mediaKitSlug, setMediaKitSlug] = React.useState<string | null>(null);
  const [territory, setTerritory] = React.useState(focusedTerritory || '');
  const [format, setFormat] = React.useState('');
  const [ending, setEnding] = React.useState(false);
  const pautas = c.ideas, isPro = c.state.hasPremiumAccess;
  const bootstrapStatus: CollabsBootstrapStatus = c.ready ? 'ready' : c.error ? 'error' : 'loading';
  const collabs = React.useMemo(() => new Map(Object.entries(c.state.suggestions)), [c.state.suggestions]);
  const decisions = React.useMemo(() => new Map(c.state.decisions.map(item => [item.pautaId, item.decision])), [c.state.decisions]);
  const shown = React.useRef(new Set<string>());
  const cardShown = React.useCallback((id: string) => {
    const proposalId = collabs.get(id)?.proposalId;
    if (!proposalId || shown.current.has(proposalId)) return;
    shown.current.add(proposalId);
    void collabsJson('collabs/interest', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exposedProposalIds: [proposalId] }) }).catch(() => shown.current.delete(proposalId));
  }, [collabs]);
  const selectedIdea = pautas.find(idea => idea.id === openIdeaId);
  const selectedMatch = c.state.matches.find(match => match.pautaId === openMatchId);
  const matchIdea = selectedMatch?.pautaSnapshot || pautas.find(idea => idea.id === openMatchId);
  const back = onBackToPerfil || (() => router.push(CREATOR_PROFILE_ROUTE));
  const upgrade = () => router.push('/pro');
  const closeMatch = () => {
    if (selectedMatch?.isNew) void collabsJson('collabs/interest', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ celebratedPautaIds: [selectedMatch.pautaId] }) }).then(() => c.load()).catch(() => {});
    setOpenMatchId(null);
  };
  const action = (id: string, kind: 'save' | 'unsave' | 'dismiss' | 'collab-interest' | 'collab-decline') => void c.mutate(id, kind, kind === 'save' ? 'saved' : kind === 'dismiss' ? 'dismissed' : 'active');
  const feed = <div className="min-w-0">
    <div className="space-y-3 border-b border-zinc-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={c.state.discovery.optedIn} disabled={!c.ready} onChange={event => void c.changeDiscovery(event.target.checked, c.state.discovery.mode)} /> Disponível para collabs</label>
        <label className="flex items-center gap-2">Como gravar<select aria-label="Modo de colaboração" className="min-h-11 rounded-lg border p-2" value={c.state.discovery.mode} onChange={event => void c.changeDiscovery(c.state.discovery.optedIn, event.target.value)}><option value="remoto">Remoto</option><option value="presencial">Presencial</option><option value="ambos">Ambos</option></select></label>
      </div>
      <p className="text-xs text-zinc-600">{c.state.discovery.optedIn ? 'Seu interesse é privado. A parceria só é confirmada quando os dois aceitam a mesma proposta.' : 'Ative para aparecer nas sugestões. Suas ideias e parcerias anteriores continuam acessíveis.'}</p>
      <details><summary className="cursor-pointer py-2">Escolher o foco das próximas ideias</summary><div className="flex flex-wrap gap-2 py-2"><label className="flex flex-col gap-1">Território<input className="min-h-11 rounded-lg border p-2" maxLength={120} value={territory} onChange={event => setTerritory(event.target.value)} placeholder="Um território do Seu Mapa" /></label><label className="flex flex-col gap-1">Formato<select className="min-h-11 rounded-lg border p-2" value={format} onChange={event => setFormat(event.target.value)}><option value="">Variar formatos</option><option value="reel">Reel</option><option value="carrossel">Carrossel</option><option value="story">Story</option></select></label></div></details>
      {c.quota && <p className="text-xs text-zinc-600">{c.quota.limitBatches === Number.MAX_SAFE_INTEGER ? 'Sem limite comercial de' : Math.max(0, c.quota.limitBatches - c.quota.usedBatches - c.quota.reservedBatches)} rodadas disponíveis · renova em {new Date(c.quota.resetAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
      {c.error && <div role="alert">{c.error} <button className="min-h-11 underline" onClick={() => void c.load()}>Tentar novamente</button></div>}
      <div role="status" aria-live="polite">{c.generation ? 'Preparando suas ideias. Você pode continuar usando a página.' : c.matching ? 'Procurando parcerias que acrescentem algo à pauta.' : c.notice}</div>
      {c.newRound && <button className="ds-button ds-button--primary" onClick={c.acceptRound}>Abrir nova rodada</button>}
      {c.undo && <button className="min-h-11 underline" onClick={c.undoLast}>Desfazer última escolha</button>}
      {c.state.discovery.optedIn && <button disabled={c.matching} className="min-h-11 underline disabled:opacity-50" onClick={() => void c.prepare()}>Atualizar sugestões de parceria</button>}
    </div>
    <DiagnosticoCollabsFeed pautas={pautas} isPro={isPro} canUseIdeas whatsappLinked={c.state.whatsappLinked} whatsappUnavailableReason={c.state.whatsappUnavailableReason}
      isGeneratingIdeas={c.generation} ideaGenerationBlocker={c.generationBlocker} ideaQuotaResetAt={c.quota?.resetAt}
      pautaCollabs={collabs} bootstrapStatus={bootstrapStatus} bootstrapError={c.error} onRetryBootstrap={() => void c.load()}
      collabDecisions={decisions} confirmedMatches={c.state.matches} pautaActionStates={c.actions}
      onRetryPautaAction={id => { const kind = c.actions.get(id)?.kind; if (kind) action(id, kind); }}
      onCardShown={cardShown} onOpenIdea={id => { cardShown(id); setOpenIdeaId(id); }} onSavePauta={id => action(id, 'save')} onUnsavePauta={id => action(id, 'unsave')}
      onAcceptCollabPauta={id => action(id, 'collab-interest')} onDeclineCollabPauta={id => action(id, 'collab-decline')} onDismissPauta={id => action(id, 'dismiss')}
      onOpenMatch={setOpenMatchId} onConnectWhatsApp={onConnectWhatsApp || (() => router.push('/dashboard/whatsapp'))}
      onUpgrade={upgrade} onGenerate={() => void c.generate({ territory, format })} onBackToPerfil={back} showHeaderTitle={!dedicatedView}
      hasMoreSaved={Boolean(c.nextCursor)} onLoadMoreSaved={() => void c.loadMore()} onCancelInterest={id => void c.cancel(id)}
    />
  </div>;
  const overlays = <>
    {selectedIdea && <DiagnosticoIdeaDetailSheet idea={selectedIdea} collab={decisions.get(selectedIdea.id) === 'dismissed' ? null : collabs.get(selectedIdea.id)} isPro
      decisionPending={Boolean(collabs.get(selectedIdea.id)) && !decisions.has(selectedIdea.id) && !c.state.matches.some(match => match.pautaId === selectedIdea.id)}
      onDecide={decision => { action(selectedIdea.id, decision === 'interested' ? 'collab-interest' : 'collab-decline'); setOpenIdeaId(null); }}
      onSaveIdea={() => { action(selectedIdea.id, 'save'); setOpenIdeaId(null); }}
      awaitingOtherSide={decisions.get(selectedIdea.id) === 'interested' && !c.state.matches.some(match => match.pautaId === selectedIdea.id)}
      onOpenCreatorMediaKit={setMediaKitSlug} onUpgrade={upgrade} onClose={() => setOpenIdeaId(null)}
      onMarkPosted={() => { void c.mutate(selectedIdea.id, 'save', 'posted'); setOpenIdeaId(null); }}
    />}
    {selectedMatch && matchIdea && <DiagnosticoCollabMatchOverlay pauta={matchIdea} collab={selectedMatch.collab} viewerName={session?.user?.name || 'Você'} viewerAvatarUrl={session?.user?.image || null}
      variant={selectedMatch.isNew ? 'celebration' : 'revisit'} onOpenIdea={id => { closeMatch(); setOpenIdeaId(id); }} onClose={closeMatch}
      onEnd={selectedMatch.collab.proposalId ? async () => { if (ending) return; setEnding(true); try { await c.end(selectedMatch.collab.proposalId!); closeMatch(); } finally { setEnding(false); } } : undefined} />}
    {mediaKitSlug && <MediaKitSheet slug={mediaKitSlug} onClose={() => setMediaKitSlug(null)} />}
  </>;
  if (embedded) return <>{feed}{overlays}</>;
  if (dedicatedView) return <><div className={`grid h-full min-h-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] ${d2cFontVariables}`}><CollabsWorkspaceSummary bootstrapStatus={bootstrapStatus} pautas={pautas} suggestedMatches={collabs.size} confirmedMatches={c.state.matches.length} /><section aria-label="Ideias e parcerias" className="ds-notebook-section !mb-0 min-h-0 min-w-0 overflow-y-auto !p-0">{feed}</section></div>{overlays}</>;
  return <><Board title="Collabs" showTitleMarker={showTitleMarker} titleMarkerVariant="chip" variant="card" showChevron={false} showOptions={false} contentClassName={`bg-white ${d2cFontVariables}`} titleClassName="text-zinc-950" isHighlighted={isHighlighted}>{feed}</Board>{overlays}</>;
}

function CollabsWorkspaceSummary({
  bootstrapStatus,
  pautas,
  suggestedMatches,
  confirmedMatches,
}: {
  bootstrapStatus: CollabsBootstrapStatus;
  pautas: ContentIdeaListItem[];
  suggestedMatches: number;
  confirmedMatches: number;
}) {
  const savedCount = pautas.filter((pauta) => pauta.status === "saved").length;
  const activeCount = pautas.filter((pauta) => pauta.status === "active").length;
  const loading = bootstrapStatus === "idle" || bootstrapStatus === "loading";

  return (
    <aside className="ds-notebook-section !mb-0 hidden max-h-full min-w-0 self-start overflow-y-auto [scrollbar-width:thin] lg:block" aria-label="Resumo de ideias e parcerias">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ds-color-brand-soft)] text-[var(--ds-color-brand-strong)]">
          <UsersRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="ds-notebook-label">Rodada atual</p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--ds-color-ink)]">
            {loading ? "Atualizando ideias" : `${activeCount} ${activeCount === 1 ? "ideia para avaliar" : "ideias para avaliar"}`}
          </p>
        </div>
      </div>

      <dl className="mt-6 divide-y divide-[var(--ds-color-line)] border-y border-[var(--ds-color-line)]">
        <CollabsStat icon={CircleDot} label="Ideias disponíveis" value={loading ? "—" : String(pautas.length)} />
        <CollabsStat icon={Bookmark} label="Ideias salvas" value={loading ? "—" : String(savedCount)} />
        <CollabsStat icon={Sparkles} label="Parcerias sugeridas" value={loading ? "—" : String(suggestedMatches)} />
        <CollabsStat icon={UsersRound} label="Parcerias combinadas" value={loading ? "—" : String(confirmedMatches)} />
      </dl>

      <div className="mt-6">
        <p className="ds-notebook-label">Como usar</p>
        <ol className="mt-4 space-y-4">
          {[
            "Abra uma ideia e veja o plano.",
            "Salve o que você quer gravar.",
            "Quando uma parceria realmente ajudar, veja quem pode gravar com você.",
          ].map((instruction, index) => (
            <li key={instruction} className="flex gap-3 text-[13px] leading-5 text-[var(--ds-color-text-secondary)]">
              <span className="shrink-0 font-bold text-[var(--ds-color-brand-strong)]">{index + 1}.</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="ds-notebook-note mt-6">
        As ideias usam os assuntos do Seu Mapa. As parcerias só aparecem quando outra pessoa acrescenta algo.
      </p>
    </aside>
  );
}

function CollabsStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 py-3">
      <Icon className="h-4 w-4 shrink-0 text-[var(--ds-color-text-muted)]" aria-hidden="true" />
      <dt className="min-w-0 flex-1 text-[12px] text-[var(--ds-color-text-secondary)]">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-[var(--ds-color-ink)]">{value}</dd>
    </div>
  );
}
