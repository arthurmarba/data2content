"use client";

// Aba "Collabs" — uma pilha, decisões diferentes.
//
//   IDEIA SOLO = salvar ou descartar a ideia.
//   PARCERIA   = gravar com a pessoa indicada ou avaliar a ideia sem ela.
//
// O plano completo preserva a escolha entre gravar sozinho e em parceria.
// Free vê a pilha com o criador misterioso (cadeado abre paywall, zero custo
// de match). Seções que dependem de dado real somem quando não há dado.
//
// Ver docs/brief-collabs-gamificada-fable.md para as decisões travadas.

import { useEffect, useMemo, useState } from "react";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import {
  DiagnosticoCollabStack,
  type CollabStackDecision,
  type CollabStackItem,
} from "./DiagnosticoCollabStack";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  SAFE_TOP,
  CARD_RADIUS,
  CS_INK_HEX,
  CS_LINE,
  CS_NEUTRAL_HEX,
  CS_FONT_DISPLAY,
  CS_DISPLAY_TRACKING,
} from "./diagnosticoTokens";

const WA_GREEN = "#25D366";

// Mesma relação do Perfil: canvas quente e conteúdo em superfície branca.
const FEED_BG = "var(--ds-color-neutral)";
const FEED_CARD_SHADOW = "var(--ds-shadow-raised)";

export type PautaActionKind = "save" | "unsave" | "dismiss" | "collab-interest" | "collab-decline";
export type PautaActionPhase = "pending" | "failed" | "confirmed";

export interface PautaActionState {
  kind: PautaActionKind;
  phase: PautaActionPhase;
  message?: string;
}

export type CollabsBootstrapStatus = "idle" | "loading" | "ready" | "error";

function WhatsAppIcon({ color = "currentColor", size = 14 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 8.5c0 4 3 7 6.5 7 .8 0 1.3-.6 1.3-1.2 0-.3-1.6-1.2-1.9-1.2-.4 0-.7.7-1 .7-.6 0-2.4-1.6-2.4-2.3 0-.3.6-.5.6-1 0-.3-.8-1.9-1.2-1.9-.5 0-1.2.5-1.2 1.1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  pautas: ContentIdeaListItem[];
  isPro: boolean;
  whatsappLinked: boolean;
  isGeneratingIdeas: boolean;
  /** "map_incomplete" => sem mapa (estado travado que devolve ao Perfil). */
  ideaGenerationBlocker?: "premium_required" | "quota_exceeded" | "map_incomplete" | "failed" | null;
  /** ISO da virada da cota mensal (só presente em quota_exceeded). */
  ideaQuotaResetAt?: string | null;
  /** Criador compatível por pauta (id da pauta → match). Ausente/null = sem collab. */
  pautaCollabs?: Map<string, NarrativeCollabMatch | null>;
  /** A rodada só pode ficar interativa depois de todas as fontes serem hidratadas. */
  bootstrapStatus?: CollabsBootstrapStatus;
  bootstrapError?: string | null;
  onRetryBootstrap?: () => void;
  /** Decisões de swipe do criador nesta sessão (pautaId → interested/dismissed). */
  collabDecisions?: ReadonlyMap<string, CollabStackDecision>;
  /** Matches confirmados (os dois toparam). Vazio = fileira Combinadas não aparece. */
  confirmedMatches?: ReadonlyArray<{ pautaId: string; collab: NarrativeCollabMatch }>;
  /** Reabre a tela do match (revisit) a partir de Combinadas / status no card. */
  onOpenMatch?: (pautaId: string) => void;
  onOpenIdea?: (id: string) => void;
  /** Estado local de mutação; impede que falhas de persistência recoloquem o card no deck. */
  pautaActionStates?: ReadonlyMap<string, PautaActionState>;
  onRetryPautaAction?: (id: string) => void;
  /** Salva explicitamente a pauta no acervo. */
  onSavePauta?: (id: string) => void;
  /** Remove explicitamente a pauta do acervo. */
  onUnsavePauta?: (id: string) => void;
  /** Aceita a collab: salva a pauta e registra interesse no servidor. */
  onAcceptCollabPauta?: (id: string) => void;
  /** Recusa somente a pessoa sugerida; a ideia volta ao deck para ser avaliada sozinha. */
  onDeclineCollabPauta?: (id: string) => void;
  /** Descarta a ideia, e não apenas a pessoa sugerida. */
  onDismissPauta?: (id: string) => void;
  onConnectWhatsApp?: () => void;
  onUpgrade?: (context?: PaywallContext) => void;
  onGenerate?: () => void;
  /** Volta para a aba Perfil (estado sem mapa). */
  onBackToPerfil?: () => void;
  /** Evita repetir o título quando a experiência já possui um cabeçalho de página. */
  showHeaderTitle?: boolean;
}

function BookmarkSolidIcon({ size = 15, color = TEXT_PRIMARY_HEX }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z" stroke={color} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

function CollabGlyph({ size = 18, color = TEXT_PRIMARY_HEX }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" stroke={color} strokeWidth="1.9" />
      <circle cx="16.5" cy="9.5" r="2.4" stroke={color} strokeWidth="1.9" />
      <path d="M3.5 19c0-2.8 2.4-4.6 5-4.6 1.5 0 2.9.6 3.8 1.5" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M13.8 18.6c.2-2.3 2-3.7 4.2-3.7 1.4 0 2.7.6 3.5 1.6" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

// Ação compacta do header, na mesma anatomia usada pelo Perfil.
function HeaderIconButton({
  onClick,
  ariaLabel,
  badge,
  badgeTone,
  pulseKey,
  children,
}: {
  onClick: () => void;
  ariaLabel: string;
  badge?: number;
  badgeTone: "match" | "neutral";
  /** Muda pra re-disparar o pulso (voo pra mochila). */
  pulseKey?: number;
  children: React.ReactNode;
}) {
  const badgeBg = badgeTone === "match" ? "var(--ds-color-success)" : CS_INK_HEX;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="ds-icon-button"
      style={{
        position: "relative", width: 40, height: 40, flexShrink: 0,
        display: "inline-grid", placeItems: "center", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 ? (
        <span
          key={pulseKey}
          style={{
            position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px",
            borderRadius: 999, background: badgeBg, color: "var(--ds-color-on-brand)", fontSize: 10, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "2px solid var(--ds-color-surface)",
            animation: pulseKey !== undefined ? "d2c-pocket-pop 0.4s ease" : undefined,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function FeedHeader({
  savedCount,
  hasSavedItems,
  matchCount,
  loading,
  showTitle,
  onOpenSalvas,
  onOpenCombinadas,
}: {
  /** Pautas salvas (pra gravar). */
  savedCount: number;
  /** Inclui operações ainda sincronizando, para a gaveta nunca desaparecer. */
  hasSavedItems: boolean;
  /** Collabs combinadas. */
  matchCount: number;
  loading?: boolean;
  showTitle: boolean;
  onOpenSalvas: () => void;
  onOpenCombinadas: () => void;
}) {
  return (
    // Hero em Bricolage (creator-studio) — piloto do design system da landing.
    // Compacto de propósito: nesta tela o header é coadjuvante do deck — cada
    // pt gasto aqui é pt tirado do card (que é a experiência inteira da aba).
    <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "12px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {/* O contador do marcador "pulsa" quando um card cai na mochila. */}
      <style>{`@keyframes d2c-pocket-pop{0%{transform:scale(1)}40%{transform:scale(1.45)}100%{transform:scale(1)}}`}</style>
      <div style={{ minWidth: 0, flex: 1 }}>
        {showTitle ? (
          <h1 style={{
            fontFamily: CS_FONT_DISPLAY,
            fontSize: "clamp(26px, 8.5vw, 33px)",
            fontWeight: 700, color: CS_INK_HEX, margin: 0,
            letterSpacing: CS_DISPLAY_TRACKING, lineHeight: 1.1,
          }}>
            Collabs
          </h1>
        ) : null}
      </div>
      {/* Dois pontos de entrada: matches (novidade) e salvas (acervo).
          O acesso à comunidade/reunião agora mora no card dedicado do Perfil.
          Combinadas fica SEMPRE visível — mesmo sem match, é onde o
          criador confirma que ainda não deu match (a sheet mostra o estado
          vazio em vez do ícone simplesmente sumir, o que lia como "essa função
          não existe"). Salvas some quando vazio porque é um acervo — sem nada
          guardado não há o que abrir. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {loading ? (
          <>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 9999, background: CS_NEUTRAL_HEX }} />
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 9999, background: CS_NEUTRAL_HEX }} />
          </>
        ) : (
          <>
            <HeaderIconButton
              onClick={onOpenCombinadas}
              ariaLabel={matchCount > 0 ? `Ver parcerias confirmadas (${matchCount})` : "Ver parcerias confirmadas — nenhuma ainda"}
              badge={matchCount}
              badgeTone="match"
            >
              <CollabGlyph />
            </HeaderIconButton>
            {hasSavedItems ? (
              <HeaderIconButton
                onClick={onOpenSalvas}
                ariaLabel={savedCount > 0 ? `Ver ideias salvas (${savedCount})` : "Ver ideia sendo salva"}
                badge={savedCount}
                badgeTone="neutral"
                pulseKey={savedCount}
              >
                <BookmarkSolidIcon size={17} />
              </HeaderIconButton>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Guardadas — a gaveta que reúne combinadas + pautas salvas ─────────────────
//
// O deck apresenta; as gavetas guardam. Parcerias confirmadas (verde, com
// atalho para o plano) em cima; Ideias salvas embaixo; o alerta de
// WhatsApp mora no rodapé — "te aviso quando der match" ao lado dos matches.

// Casca comum das gavetas — handle, título, ×, corpo rolável. Cada gaveta é
// single-purpose (Parcerias confirmadas OU Ideias salvas), sem poluição.
function CollabSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[270] flex items-end justify-center ds-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ds-sheet ds-enter-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex justify-center pt-4" aria-hidden="true">
          <div className="ds-sheet__handle !m-0" />
        </div>
        <div className="flex items-center justify-between px-5 pb-4 pt-1">
          <h2 className="font-display text-[1.5rem] font-bold leading-tight tracking-[-0.035em] text-zinc-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="ds-icon-button ds-icon-button--ghost !h-9 !w-9"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

// Painel Combinadas — só matches (o evento) + o alerta de WhatsApp no rodapé.
function CombinadasSheet({
  matches,
  pautaById,
  isPro,
  whatsappLinked,
  onOpenMatch,
  onConnectWhatsApp,
  onUpgrade,
  onClose,
}: {
  matches: ReadonlyArray<{ pautaId: string; collab: NarrativeCollabMatch }>;
  pautaById: Map<string, ContentIdeaListItem>;
  isPro: boolean;
  whatsappLinked: boolean;
  onOpenMatch?: (pautaId: string) => void;
  onConnectWhatsApp?: () => void;
  onUpgrade?: (context?: PaywallContext) => void;
  onClose: () => void;
}) {
  return (
    <CollabSheet title="Parcerias confirmadas" onClose={onClose}>
      <div style={{ padding: "0 16px" }}>
        {matches.length > 0 ? (
          <ConfirmedMatchesRow matches={matches} pautaById={pautaById} onOpenMatch={onOpenMatch} framed={false} withHeading={false} />
        ) : (
          // Sem match ainda: a sheet abre mesmo assim e diz isso — o botão do
          // header nunca some, então tocar nele não pode levar a uma tela em
          // branco sem explicação.
          <div style={{ padding: "8px 4px 22px", textAlign: "center" }}>
            <span style={{
              display: "inline-grid", placeItems: "center", width: 52, height: 52,
              borderRadius: 12, background: "var(--ds-color-brand-soft)", marginBottom: 12,
            }} aria-hidden="true">
              <CollabGlyph size={22} color="var(--ds-color-brand-strong)" />
            </span>
            <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.3 }}>
              Nenhuma parceria confirmada ainda
            </p>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "5px 0 0" }}>
              Quando outra pessoa escolher a mesma ideia, ela aparecerá aqui.
            </p>
          </div>
        )}
      </div>
      {/* Alerta de WhatsApp — "te aviso quando der match" mora junto dos matches. */}
      <div style={{ borderTop: `1px solid ${CS_LINE}`, margin: "16px 0 0", padding: "13px 20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: TEXT_BODY_HEX, lineHeight: 1.4 }}>
          Avisamos no WhatsApp quando outra pessoa escolher a mesma ideia.
        </span>
        {whatsappLinked ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
            borderRadius: 8, padding: "6px 11px", background: "var(--ds-color-success-soft)", color: "var(--ds-color-success)",
            fontSize: 11, fontWeight: 600,
          }}>
            <WhatsAppIcon color={WA_GREEN} />
            Ativo
          </span>
        ) : (
          <button
            type="button"
            onClick={() => (isPro ? onConnectWhatsApp?.() : onUpgrade?.("whatsapp"))}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
              borderRadius: 8, padding: "7px 13px", background: "transparent", color: TEXT_PRIMARY_HEX,
              fontSize: 12, fontWeight: 600, border: `1.5px solid ${TEXT_PRIMARY_HEX}`,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <WhatsAppIcon />
            Receber
          </button>
        )}
      </div>
    </CollabSheet>
  );
}

// Painel Ideias salvas — salvas-solo + aguardando. Uma parceria confirmada não
// mora aqui: o plano dela vive em Parcerias confirmadas — uma casa por item.
function SalvasSheet({
  shelfPautas,
  awaitingByPauta,
  whatsappLinked,
  pautaActionStates,
  onOpenIdea,
  onUnsavePauta,
  onRetryPautaAction,
  onClose,
}: {
  shelfPautas: ContentIdeaListItem[];
  awaitingByPauta: Map<string, NarrativeCollabMatch>;
  whatsappLinked: boolean;
  pautaActionStates?: ReadonlyMap<string, PautaActionState>;
  onOpenIdea?: (id: string) => void;
  onUnsavePauta?: (id: string) => void;
  onRetryPautaAction?: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <CollabSheet title="Ideias salvas" onClose={onClose}>
      <div style={{ padding: "0 16px 20px" }}>
        {shelfPautas.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {shelfPautas.map((pauta) => (
              <PautaCard
                key={pauta.id}
                pauta={pauta}
                awaitingCollab={awaitingByPauta.get(pauta.id) ?? null}
                whatsappLinked={whatsappLinked}
                actionState={pautaActionStates?.get(pauta.id) ?? null}
                onOpenIdea={onOpenIdea}
                onUnsavePauta={onUnsavePauta}
                onRetryPautaAction={onRetryPautaAction}
              />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13.5, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, textAlign: "center", padding: "8px 16px 12px" }}>
            As ideias que você salvar aparecerão aqui.
          </p>
        )}
      </div>
    </CollabSheet>
  );
}

// ─── Skeleton da pilha (match por-pauta carregando) ───────────────────────────

function StackSkeleton() {
  return (
    <div role="status" aria-label="Preparando suas ideias">
      <span className="sr-only">Preparando suas ideias…</span>
      <style>{`@keyframes d2c-collab-pulse{0%,100%{opacity:.55}50%{opacity:.25}}`}</style>
      <div style={{ padding: "0 2px 10px" }}>
        <div style={{ height: 11, width: 96, borderRadius: 6, background: "var(--ds-color-line-strong)", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
      </div>
      <div style={{ position: "relative", height: 168 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotate(-2.5deg) scale(0.955) translateY(9px)", borderRadius: 20, background: "var(--ds-color-surface)", border: `1px solid ${CS_LINE}`, animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: "var(--ds-color-surface)", border: `1px solid ${CS_LINE}`, boxShadow: FEED_CARD_SHADOW, padding: "16px 18px" }}>
          <div style={{ height: 10, width: "38%", borderRadius: 6, background: "var(--ds-color-line-strong)", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
          <div style={{ height: 14, width: "82%", borderRadius: 6, background: "var(--ds-color-line)", margin: "10px 0 0", animation: "d2c-collab-pulse 1.2s ease-in-out infinite" }} />
          <div style={{ height: 14, width: "60%", borderRadius: 6, background: "var(--ds-color-line)", margin: "6px 0 0", animation: "d2c-collab-pulse 1.3s ease-in-out infinite" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 34 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9999, background: "var(--ds-color-line-strong)", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
            <div style={{ height: 10, width: "45%", borderRadius: 6, background: "var(--ds-color-line)", animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CollabsLoadError({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      style={{
        minHeight: 260,
        borderRadius: 22,
        padding: "28px 24px",
        background: "var(--ds-color-surface)",
        border: `1px solid ${CS_LINE}`,
        boxShadow: FEED_CARD_SHADOW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 48, height: 48, borderRadius: 9999, display: "grid", placeItems: "center",
          background: "var(--ds-color-danger-soft)", color: "var(--ds-color-danger)", fontSize: 22, fontWeight: 800,
        }}
      >
        !
      </span>
      <p style={{ margin: "14px 0 0", fontSize: 16, fontWeight: 750, color: TEXT_PRIMARY_HEX }}>
        Não conseguimos preparar suas ideias
      </p>
      <p style={{ margin: "6px 0 0", maxWidth: 280, fontSize: 13, lineHeight: 1.5, color: TEXT_SECONDARY_HEX }}>
        {message || "Suas ideias continuam salvas. Tente carregar novamente."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ds-button ds-button--primary ds-button--small"
          style={{
            marginTop: 18, fontFamily: "inherit", cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      ) : null}
    </div>
  );
}

// ─── Combinadas (match feito — status, privado entre os dois) ─────────────────
//
// Cards horizontais, NÃO avatares soltos: círculo+nome era a mesma linguagem da
// stories row (descoberta) a poucos px de distância — mesma forma, significado
// diferente. O card verde-suave comunica "conversa em andamento" e carrega a
// pauta junto, que é o que dá contexto ao toque.

function ConfirmedMatchesRow({
  matches,
  pautaById,
  onOpenMatch,
  framed = true,
  withHeading = true,
}: {
  matches: ReadonlyArray<{ pautaId: string; collab: NarrativeCollabMatch }>;
  pautaById: Map<string, ContentIdeaListItem>;
  onOpenMatch?: (pautaId: string) => void;
  /** false quando renderizada dentro da gaveta (o padding externo é dela). */
  framed?: boolean;
  /** false quando a gaveta já tem o título "Combinadas" — evita duplicar. */
  withHeading?: boolean;
}) {
  return (
    <div style={{ padding: framed ? "20px 16px 0" : 0 }}>
      {withHeading ? (
        <span style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--ds-color-success)", padding: "0 2px", marginBottom: 10 }}>
          Parcerias confirmadas
        </span>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map((entry) => {
          const { pautaId, collab } = entry;
          const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
          const initials = firstName.slice(0, 1).toUpperCase();
          const pauta = pautaById.get(pautaId);
          const snapshot = (entry as typeof entry & { pautaSnapshot?: { title?: string } }).pautaSnapshot;
          const pautaTitle = pauta ? cleanIdeaText(pauta.title) : cleanIdeaText(snapshot?.title ?? "");
          return (
            <button
              key={pautaId}
              type="button"
              onClick={onOpenMatch ? () => onOpenMatch(pautaId) : undefined}
              aria-label={pautaTitle ? `Abrir plano da parceria com ${collab.name}: ${pautaTitle}` : `Abrir plano da parceria com ${collab.name}`}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%",
                borderRadius: 12, padding: "10px 14px 10px 10px", textAlign: "left",
                background: "var(--ds-color-success-soft)", border: "1px solid color-mix(in srgb, var(--ds-color-success) 18%, transparent)",
                cursor: onOpenMatch ? "pointer" : "default", fontFamily: "inherit",
              }}
            >
              <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 9999, overflow: "hidden",
                  background: "var(--ds-color-ink)", color: "var(--ds-color-on-brand)", display: "grid", placeItems: "center",
                  fontSize: 14, fontWeight: 700,
                }}>
                  <StableCreatorAvatar
                    name={collab.name}
                    avatarUrl={collab.avatarUrl}
                    creatorId={collab.id}
                    mediaKitSlug={collab.mediaKitSlug}
                    fallbackText={initials}
                  />
                </div>
                <span style={{
                  position: "absolute", bottom: -2, right: -2, width: 16, height: 16,
                  borderRadius: 9999, background: "var(--ds-color-success)", border: "2px solid var(--ds-color-success-soft)",
                  display: "grid", placeItems: "center",
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" stroke="var(--ds-color-on-brand)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.2 }}>
                  Parceria com {firstName} confirmada
                </span>
                {pautaTitle ? (
                  <span style={{ display: "block", fontSize: 12, color: "var(--ds-color-success)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pautaTitle}
                  </span>
                ) : null}
                <span style={{ display: "block", marginTop: 4, fontSize: 11.5, color: TEXT_SECONDARY_HEX }}>
                  Próximo passo: combinar a gravação.
                </span>
              </div>
              {onOpenMatch ? <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ds-color-success)", flexShrink: 0 }}>Abrir plano ›</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card de lista (ideia salva — vive só em "Ideias salvas") ─────────────────

function RemoveBookmarkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4.75A1.75 1.75 0 0 1 8.75 3h6.5A1.75 1.75 0 0 1 17 4.75V20l-5-3.15L7 20V4.75z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 9.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Você topou a collab; o outro lado ainda não respondeu. O modelo é silencioso
// por design (interesse paralelo — nada de convite/aceite/nudge), mas silêncio
// TOTAL lia como "morreu": o selo sozinho não dizia o que acontece a seguir.
// A linha de expectativa fecha o loop — diz o que falta (o outro topar) e onde
// a resposta chega (WhatsApp ou aqui) — sem pedir nada de ninguém.
function AwaitingCollabRow({ collab, whatsappLinked }: { collab: NarrativeCollabMatch; whatsappLinked?: boolean }) {
  const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
  return (
    <div style={{ marginTop: 10 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11, fontWeight: 700, color: "var(--ds-color-warning)",
        background: "var(--ds-color-warning-soft)", borderRadius: 8, padding: "4px 10px",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.4" />
          <path d="M12 8v4.2l2.8 1.6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        Interesse registrado
      </span>
      <p style={{ fontSize: 11.5, color: TEXT_SECONDARY_HEX, lineHeight: 1.45, margin: "6px 0 0" }}>
        Se houver interesse dos dois lados, {whatsappLinked ? "avisamos você no WhatsApp" : "a collab aparecerá aqui"}.
      </p>
    </div>
  );
}

function PautaActionRow({
  state,
  onRetry,
}: {
  state: PautaActionState;
  onRetry?: () => void;
}) {
  const pending = state.phase === "pending";
  const label = pending
    ? state.kind === "collab-interest"
      ? "Registrando parceria..."
      : state.kind === "collab-decline"
        ? "Atualizando sugestão..."
      : state.kind === "unsave"
        ? "Removendo..."
        : state.kind === "dismiss"
          ? "Descartando..."
          : "Salvando..."
    : state.message ?? (
        state.kind === "collab-interest"
          ? "Parceria não sincronizada"
          : state.kind === "collab-decline"
            ? "Não foi possível atualizar a sugestão"
          : state.kind === "unsave"
            ? "Removida da lista. Sincronização pendente."
            : state.kind === "dismiss"
              ? "Não foi possível descartar a ideia."
              : "Não foi possível salvar agora"
      );
  const retryLabel = "Tentar de novo";
  const warningTone = false;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        marginTop: 10, borderRadius: 12, padding: "8px 10px",
        background: pending ? "var(--ds-color-neutral)" : warningTone ? "var(--ds-color-warning-soft)" : "var(--ds-color-danger-soft)",
        color: pending ? TEXT_SECONDARY_HEX : warningTone ? "var(--ds-color-warning)" : "var(--ds-color-danger)",
        fontSize: 11.5, fontWeight: 650,
      }}
    >
      <span>{label}</span>
      {!pending && onRetry ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          style={{
            flexShrink: 0, border: "none", background: "transparent", color: warningTone ? "var(--ds-color-warning)" : "var(--ds-color-danger)",
            fontFamily: "inherit", fontSize: 11.5, fontWeight: 800, padding: 0, cursor: "pointer",
          }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function PautaCard({
  pauta,
  awaitingCollab,
  whatsappLinked,
  actionState,
  onOpenIdea,
  onUnsavePauta,
  onRetryPautaAction,
}: {
  pauta: ContentIdeaListItem;
  /** Você topou; o outro lado ainda não — selo roxo + linha de expectativa. */
  awaitingCollab?: NarrativeCollabMatch | null;
  whatsappLinked?: boolean;
  actionState?: PautaActionState | null;
  onOpenIdea?: (id: string) => void;
  /** Tira a pauta de "Ideias salvas". Card só existe aqui já salvo —
   * não é alternância salvar/dessalvar, é remoção da lista. */
  onUnsavePauta?: (id: string) => void;
  onRetryPautaAction?: (id: string) => void;
}) {
  const title = cleanIdeaText(pauta.title);
  const actionPending = actionState?.phase === "pending";
  const canRemove = onUnsavePauta && !awaitingCollab && !actionPending;
  return (
    // Eco compacto do card do deck — mesma família (branco, chip de meta,
    // título, selo), sem os botões de decisão. A mochila guarda; o deck decide.
    <div style={{ borderRadius: CARD_RADIUS, background: "var(--ds-color-surface)", border: `1px solid ${CS_LINE}`, boxShadow: FEED_CARD_SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", position: "relative" }}>
        {/* Só remove de verdade quando a pauta é PURAMENTE salva — combinada
            ou aguardando ficam na lista mesmo se o "saved" virar false (é um
            compromisso de collab, não desaparece só por destogglar o salvo).
            Botão de excluir só aparece onde a ação realmente funciona. */}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onUnsavePauta?.(pauta.id)}
            aria-label="Tirar das ideias salvas"
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 1,
              display: "grid", placeItems: "center", width: 34, height: 34,
              borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
              background: "transparent", color: TEXT_SECONDARY_HEX, fontFamily: "inherit",
            }}
          >
            <RemoveBookmarkIcon />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenIdea ? () => onOpenIdea(pauta.id) : undefined}
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, paddingRight: canRemove ? 36 : 0, cursor: onOpenIdea ? "pointer" : "default", fontFamily: "inherit" }}
        >
          <p style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: 0, lineHeight: 1.3, margin: 0, overflowWrap: "normal", wordBreak: "normal", hyphens: "none" }}>
            {title}
          </p>
          <span style={{ display: "block", marginTop: 7, fontSize: 12, color: TEXT_SECONDARY_HEX, lineHeight: 1.35 }}>
            {[pauta.suggestedFormat, pauta.opportunityBrief?.timing?.shortLabel].filter(Boolean).join(" · ")}
          </span>
          {onOpenIdea ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--ds-color-brand-strong)" }}>
              Abrir plano <span aria-hidden="true">›</span>
            </span>
          ) : null}
        </button>
        {awaitingCollab ? (
          <AwaitingCollabRow collab={awaitingCollab} whatsappLinked={whatsappLinked} />
        ) : null}
        {actionState ? (
          <PautaActionRow state={actionState} onRetry={onRetryPautaAction ? () => onRetryPautaAction(pauta.id) : undefined} />
        ) : null}
      </div>
    </div>
  );
}

function GenerateButton({
  isPro,
  isGeneratingIdeas,
  onGenerate,
  onUpgrade,
  label,
}: Pick<Props, "isPro" | "isGeneratingIdeas" | "onGenerate" | "onUpgrade"> & { label: string }) {
  if (isGeneratingIdeas) {
    return (
      <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, textAlign: "center", margin: 0 }}>
        Gerando novas ideias…
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={isPro ? onGenerate : () => onUpgrade?.("planning")}
      className="ds-button ds-button--primary ds-button--small"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

function RoundBlockerNotice({
  blocker,
  quotaResetAt,
}: {
  blocker: NonNullable<Props["ideaGenerationBlocker"]>;
  quotaResetAt?: string | null;
}) {
  // Cota estourada trava a rodada até a virada do mês — tom de aviso (âmbar), sem
  // botão de retry (tentar de novo não destrava). Falha transitória é vermelha; o
  // próprio "Carregar nova rodada" acima já serve de retry.
  const isQuota = blocker === "quota_exceeded";
  const isPremium = blocker === "premium_required";
  const warningTone = isQuota;
  const resetLabel = quotaResetAt
    ? new Date(quotaResetAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : null;
  const message = isQuota
    ? resetLabel
      ? `Você usou todas as suas gerações de ideias deste mês. Novas a partir de ${resetLabel}.`
      : "Você usou todas as suas gerações de ideias deste mês."
    : isPremium
      ? "Gerar novas rodadas de ideias é um recurso Pro."
      : "Não foi possível carregar a nova rodada agora. Tente novamente.";
  return (
    <div
      role="alert"
      style={{
        borderRadius: 14, padding: "10px 12px", textAlign: "left",
        background: warningTone ? "var(--ds-color-warning-soft)" : "var(--ds-color-danger-soft)",
        color: warningTone ? "var(--ds-color-warning)" : "var(--ds-color-danger)",
        fontSize: 12.5, fontWeight: 650, lineHeight: 1.4,
      }}
    >
      {message}
    </div>
  );
}

function RoundCompleteActions({
  isPro,
  isGeneratingIdeas,
  ideaGenerationBlocker,
  ideaQuotaResetAt,
  onGenerate,
  onUpgrade,
}: Pick<Props, "isPro" | "isGeneratingIdeas" | "ideaGenerationBlocker" | "ideaQuotaResetAt" | "onGenerate" | "onUpgrade">) {
  const proBadge = !isPro ? (
    <span style={{ borderRadius: 999, padding: "3px 6px", background: "rgba(255,255,255,0.16)", fontSize: 9, fontWeight: 800, letterSpacing: 0.65 }}>
      PRO
    </span>
  ) : null;

  // Blocker de geração que impede a nova rodada (mapa incompleto é tratado antes,
  // no estado sem pautas). Sem isto, uma falha/cota estourada deixava o toque em
  // "Carregar nova rodada" sem resposta visível — parecia que nada carregava.
  const blocker =
    ideaGenerationBlocker === "quota_exceeded" ||
    ideaGenerationBlocker === "failed" ||
    ideaGenerationBlocker === "premium_required"
      ? ideaGenerationBlocker
      : null;
  // Cota estourada / recurso Pro não destravam via retry — some o botão de gerar.
  const canRetryGenerate = !blocker || blocker === "failed";

  return (
    <div role="group" aria-label="Continuar depois da rodada" style={{ display: "grid", gap: 10 }}>
      {blocker && !isGeneratingIdeas ? (
        <RoundBlockerNotice blocker={blocker} quotaResetAt={ideaQuotaResetAt} />
      ) : null}
      {canRetryGenerate ? (
      <button
        type="button"
        disabled={isGeneratingIdeas}
        onClick={isPro ? onGenerate : () => onUpgrade?.("planning")}
        className="ds-button ds-button--primary ds-button--block"
        style={{
          minHeight: 50, width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
          cursor: isGeneratingIdeas ? "wait" : "pointer", fontFamily: "inherit",
          opacity: isGeneratingIdeas ? 0.72 : 1,
        }}
      >
        <span>{isGeneratingIdeas ? "Criando novas ideias…" : blocker === "failed" ? "Tentar novamente" : "Ver novas ideias"}</span>
        {!isGeneratingIdeas ? proBadge : null}
      </button>
      ) : null}
    </div>
  );
}

export function DiagnosticoCollabsFeed({
  pautas,
  isPro,
  whatsappLinked,
  isGeneratingIdeas,
  ideaGenerationBlocker,
  ideaQuotaResetAt,
  pautaCollabs,
  bootstrapStatus = "ready",
  bootstrapError,
  onRetryBootstrap,
  collabDecisions,
  confirmedMatches,
  onOpenMatch,
  onOpenIdea,
  pautaActionStates,
  onRetryPautaAction,
  onSavePauta,
  onUnsavePauta,
  onAcceptCollabPauta,
  onDeclineCollabPauta,
  onDismissPauta,
  onConnectWhatsApp,
  onUpgrade,
  onGenerate,
  onBackToPerfil,
  showHeaderTitle = true,
}: Props) {
  const hasPautas = pautas.length > 0;
  const mapless = ideaGenerationBlocker === "map_incomplete";
  const bootstrapPending = bootstrapStatus === "idle" || bootstrapStatus === "loading";
  const bootstrapFailed = bootstrapStatus === "error";
  const surfaceBackground = showHeaderTitle ? FEED_BG : "var(--ds-color-surface)";
  // Duas gavetas single-purpose, dois pontos de entrada no header: novidade
  // (Parcerias confirmadas) × acervo (Ideias salvas). Nunca as duas abertas.
  const [openSheet, setOpenSheet] = useState<null | "combinadas" | "salvas">(null);
  // A ordem é uma propriedade da RODADA, não do conjunto de cards ainda
  // ativos. Recalcular a intercalação depois de cada decisão fazia o item
  // mostrado atrás do topo trocar de posição no mesmo instante em que o topo
  // saía. Este snapshot só é substituído quando a rodada realmente muda.
  const [deckOrder, setDeckOrder] = useState<{ fingerprint: string; cardIds: string[] }>({
    fingerprint: "",
    cardIds: [],
  });

  const deckRoundFingerprint = useMemo(() => {
    const pautaFingerprint = pautas
      .map((pauta) => `${pauta.id}:${pauta.generatedAt ?? ""}`)
      .join("|");
    const matchFingerprint = isPro
      ? pautas
          .map((pauta) => `${pauta.id}:${pautaCollabs?.get(pauta.id)?.id ?? "solo"}`)
          .join("|")
      : "free";
    return `${isPro ? "pro" : "free"}::${pautaFingerprint}::${matchFingerprint}`;
  }, [isPro, pautaCollabs, pautas]);

  // ─── Deck único + estante ────────────────────────────────────────────────────
  //
  // A tela inteira é UMA experiência de swipe. O deck tria; a estante guarda.
  //   - Card "pauta": direita = salvar (vai pra estante), esquerda = descartar
  //     (efêmero — chave "pauta:<id>" no mesmo Map de decisões; nunca POSTa
  //     porque o shell só persiste quando há match real pra pauta).
  //   - Card "collab" (o prêmio, intercalado NO MEIO — nunca 1º): direita =
  //     quero fazer (+ salva a pauta), esquerda = não agora → a PAUTA re-entra
  //     no fim do deck como card solo (recusar o parceiro não custa a ideia).
  //   - Estante "Ideias salvas": salvas ∪ interesse pendente — com
  //     selo de status quando houver.
  const failedAction = useMemo(() => {
    if (!pautaActionStates) return null;
    for (const [id, state] of pautaActionStates.entries()) {
      if (state.phase === "failed") return { id, state };
    }
    return null;
  }, [pautaActionStates]);

  const { proposedDeck, shelfPautas, awaitingByPauta } = useMemo(() => {
    const matched = new Map<string, NarrativeCollabMatch>(
      (confirmedMatches ?? []).map((m) => [m.pautaId, m.collab]),
    );
    const awaiting = new Map<string, NarrativeCollabMatch>();
    const pautaCards: CollabStackItem[] = [];
    const declinedPartnerCards: CollabStackItem[] = [];
    const collabCards: CollabStackItem[] = [];
    const shelf: ContentIdeaListItem[] = [];

    // Free: a 2ª pauta da geração vira o card misterioso — id fixo (não posição
    // do deck), pra não "pular" de card conforme as decisões avançam.
    const mysteryId = !isPro
      ? pautas.find((pauta) => pauta.opportunityBrief?.kind === "collab_optional")?.id ?? null
      : null;

    for (const pauta of pautas) {
      const actionState = pautaActionStates?.get(pauta.id) ?? null;
      const locallySaved =
        actionState?.kind === "save" || actionState?.kind === "collab-interest";
      const locallyDismissed = actionState?.kind === "dismiss" && actionState.phase !== "failed";
      const decliningPartner = actionState?.kind === "collab-decline" && actionState.phase === "pending";

      // Rejeitada é PERMANENTE: descartada nunca reaparece — nem no deck, nem na
      // estante. (O read service já filtra "dismissed"; isto cobre o otimismo
      // local da sessão, antes do reload.)
      if (locallyDismissed || decliningPartner || pauta.status === "dismissed" || pauta.status === "posted") continue;

      const collab = isPro ? pautaCollabs?.get(pauta.id) ?? null : null;
      const collabDecision = collabDecisions?.get(pauta.id);
      const isMatched = matched.has(pauta.id);
      const isSaved = locallySaved || pauta.status === "saved";
      const isInterested = collabDecision === "interested";

      if (isInterested && !isMatched && collab) awaiting.set(pauta.id, collab);

      // Casada tem UMA casa: Combinadas (célula rica, com handoff e como
      // gravar). Antes ela também aparecia em "Ideias salvas" como selo — o mesmo
      // item em duas gavetas com pesos diferentes confundia mais do que
      // ajudava. Sai do deck e da estante; vive só na gaveta de matches.
      if (isMatched) continue;

      // Estante: o que o criador ACEITOU e ainda espera ação dele (salvou /
      // topou e aguarda o outro lado). Uma parceria recusada volta como ideia
      // solo; uma ideia descartada sai da experiência.
      if (isSaved || isInterested) {
        shelf.push(pauta);
        continue;
      }

      if (collabDecision === "dismissed") {
        declinedPartnerCards.push({ kind: "pauta", pauta, collab: null });
      } else if (collab) {
        collabCards.push({ kind: "collab", pauta, collab }); // o prêmio
      } else {
        pautaCards.push({ kind: pauta.id === mysteryId ? "mystery" : "pauta", pauta, collab: null });
      }
    }

    // Intercala PELA ORDEM DA GERAÇÃO (pos. 1, 4, 7…). Os cards aqui já são só os
    // não-decididos (decididos foram pra estante ou descartados acima), então o
    // deck é exatamente o que resta para avaliar. Parcerias recusadas voltam
    // depois como ideia solo; ideias descartadas não voltam.
    const proposedDeck: CollabStackItem[] = [...pautaCards];
    collabCards.forEach((card, i) => {
      const pos = Math.min(1 + i * 3, proposedDeck.length);
      proposedDeck.splice(pos, 0, card);
    });
    // Recusar uma pessoa não apaga a ideia. Ela volta depois das demais como
    // uma decisão solo, para não reaparecer imediatamente no mesmo lugar.
    proposedDeck.push(...declinedPartnerCards);

    // Estante: aguardando primeiro (tem gente do outro lado), depois salvas.
    shelf.sort((a, b) => {
      const rank = (p: ContentIdeaListItem) => (awaiting.has(p.id) ? 0 : 1);
      return rank(a) - rank(b);
    });

    return { proposedDeck, shelfPautas: shelf, awaitingByPauta: awaiting };
  }, [pautas, pautaCollabs, collabDecisions, confirmedMatches, isPro, pautaActionStates]);

  const confirmedSavedCount = useMemo(
    () => shelfPautas.filter((pauta) => pauta.status === "saved").length,
    [shelfPautas],
  );

  const proposedDeckCardIds = useMemo(
    () => proposedDeck.map((item) => `${item.kind}:${item.pauta.id}`),
    [proposedDeck],
  );

  useEffect(() => {
    setDeckOrder((current) => {
      if (current.fingerprint === deckRoundFingerprint) return current;
      return { fingerprint: deckRoundFingerprint, cardIds: proposedDeckCardIds };
    });
  }, [deckRoundFingerprint, proposedDeckCardIds]);

  const deckItems = useMemo(() => {
    // Na primeira renderização de uma nova rodada, usa imediatamente a ordem
    // proposta. O efeito acima a transforma no snapshot persistente antes das
    // decisões seguintes.
    const cardIds = deckOrder.fingerprint === deckRoundFingerprint
      ? deckOrder.cardIds
      : proposedDeckCardIds;
    const proposedByCardId = new Map(proposedDeck.map((item) => [`${item.kind}:${item.pauta.id}`, item]));
    const ordered = cardIds
      .map((cardId) => proposedByCardId.get(cardId))
      .filter((item): item is CollabStackItem => Boolean(item));
    const known = new Set(cardIds);
    for (const item of proposedDeck) {
      const cardId = `${item.kind}:${item.pauta.id}`;
      if (!known.has(cardId)) ordered.push(item);
    }
    return ordered;
  }, [deckOrder, deckRoundFingerprint, proposedDeck, proposedDeckCardIds]);

  const pautaById = useMemo(() => new Map(pautas.map((p) => [p.id, p])), [pautas]);
  // Roteia a decisão pelo tipo do card — o gesto é um, as consequências não.
  //   RECUSAR parceria = recusa só a pessoa; a ideia volta depois como solo.
  //   DESCARTAR ideia = remove a ideia da experiência.
  //   ACEITAR: collab → guarda + registra interesse (pode casar); solo → guarda.
  const handleDeckDecision = (pautaId: string, decision: CollabStackDecision) => {
    const item = deckItems.find((i) => i.pauta.id === pautaId);
    if (!item) return;

    if (decision === "dismissed") {
      if (item.kind === "collab") onDeclineCollabPauta?.(pautaId);
      else onDismissPauta?.(pautaId);
      return;
    }

    // interested:
    if (item.kind === "collab") {
      onAcceptCollabPauta?.(pautaId);
    } else {
      onSavePauta?.(pautaId);
    }
  };

  return (
    // flex column preenchendo a altura real do container rolável do shell —
    // NÃO um palpite em dvh. O deck-wrapper abaixo é flex:1 e recebe
    // EXATAMENTE o espaço que sobra depois do header/stories, em qualquer
    // altura de tela. Antes o card usava `min(58dvh, 490px)` — uma % da tela
    // INTEIRA, sem relação com o espaço real disponível — o que sobrepunha a
    // tab bar e cortava o título em telas mais baixas (ex.: iPhone SE, 667px).
    <div
      className="ds-notebook"
      aria-busy={bootstrapPending || undefined}
      style={{ background: surfaceBackground, minHeight: "100%", height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div style={{ background: surfaceBackground, paddingTop: showHeaderTitle ? SAFE_TOP : 0, paddingBottom: 6 }}>
        <FeedHeader
          savedCount={confirmedSavedCount}
          hasSavedItems={shelfPautas.length > 0}
          matchCount={confirmedMatches?.length ?? 0}
          loading={bootstrapPending}
          showTitle={showHeaderTitle}
          onOpenSalvas={() => setOpenSheet("salvas")}
          onOpenCombinadas={() => setOpenSheet("combinadas")}
        />
      </div>

      {failedAction ? (
        <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "8px 20px 0" }}>
          <div
            role="status"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              borderRadius: 14, padding: "10px 12px",
              background: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "var(--ds-color-warning-soft)" : "var(--ds-color-danger-soft)",
              color: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "var(--ds-color-warning)" : "var(--ds-color-danger)",
              fontSize: 12, fontWeight: 650,
            }}
          >
            <span>{failedAction.state.message ?? "Não foi possível salvar agora. Tente novamente."}</span>
            {onRetryPautaAction ? (
              <button
                type="button"
                onClick={() => onRetryPautaAction(failedAction.id)}
                style={{
                  flexShrink: 0, border: "none", background: "transparent",
                  color: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "var(--ds-color-warning)" : "var(--ds-color-danger)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 800, padding: 0, cursor: "pointer",
                }}
              >
                Tentar de novo
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasPautas ? (
        // A MESA — inclusive vazia. O stack possui um único estado final para
        // qualquer rodada sem cards, evitando CTA órfão e variações de layout.
        <div style={{ width: "100%", maxWidth: 560, margin: "0 auto", padding: "10px 20px 8px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
          {bootstrapPending ? (
            <StackSkeleton />
          ) : bootstrapFailed ? (
            <CollabsLoadError message={bootstrapError} onRetry={onRetryBootstrap} />
          ) : (
            <DiagnosticoCollabStack
              key={deckRoundFingerprint}
              items={deckItems}
              isPro={isPro}
              shelfCount={confirmedSavedCount}
              clearedActions={
                <RoundCompleteActions
                  isPro={isPro}
                  isGeneratingIdeas={isGeneratingIdeas}
                  ideaGenerationBlocker={ideaGenerationBlocker}
                  ideaQuotaResetAt={ideaQuotaResetAt}
                  onGenerate={onGenerate}
                  onUpgrade={onUpgrade}
                />
              }
              onDecide={handleDeckDecision}
              onOpenIdea={onOpenIdea}
              onUpgrade={() => onUpgrade?.("narrative_map")}
            />
          )}
        </div>
      ) : mapless ? (
        // Estado travado: sem mapa, devolve ao Perfil. Sem feed vazio.
        <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "32px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, margin: 0 }}>
            Suas ideias começam no seu mapa
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "8px 0 18px" }}>
            Monte seu mapa no Perfil. Depois, você recebe ideias e sugestões de parceria quando elas realmente ajudarem.
          </p>
          <button
            type="button"
            onClick={onBackToPerfil}
            className="ds-button ds-button--primary"
          >
            Ir para o Perfil
          </button>
        </div>
      ) : (
        // Mapa pronto, ainda sem pautas: convite calmo a gerar.
        <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", padding: "28px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, margin: 0 }}>
            Pronto para suas primeiras ideias?
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "8px 0 18px" }}>
            A D2C cria ideias a partir do seu mapa e indica outra pessoa somente quando a parceria melhora o vídeo.
          </p>
          {(ideaGenerationBlocker === "quota_exceeded" ||
            ideaGenerationBlocker === "failed" ||
            ideaGenerationBlocker === "premium_required") && !isGeneratingIdeas ? (
            <div style={{ maxWidth: 340, margin: "0 auto 14px" }}>
              <RoundBlockerNotice blocker={ideaGenerationBlocker} quotaResetAt={ideaQuotaResetAt} />
            </div>
          ) : null}
          {ideaGenerationBlocker !== "quota_exceeded" ? (
            <GenerateButton
              isPro={isPro}
              isGeneratingIdeas={isGeneratingIdeas}
              onGenerate={onGenerate}
              onUpgrade={onUpgrade}
              label={ideaGenerationBlocker === "failed" ? "Tentar novamente" : "Gerar ideias"}
            />
          ) : null}
        </div>
      )}

      {openSheet === "combinadas" ? (
        <CombinadasSheet
          matches={confirmedMatches ?? []}
          pautaById={pautaById}
          isPro={isPro}
          whatsappLinked={whatsappLinked}
          onOpenMatch={(pautaId) => {
            setOpenSheet(null);
            onOpenMatch?.(pautaId);
          }}
          onConnectWhatsApp={onConnectWhatsApp}
          onUpgrade={onUpgrade}
          onClose={() => setOpenSheet(null)}
        />
      ) : openSheet === "salvas" ? (
        <SalvasSheet
          shelfPautas={shelfPautas}
          awaitingByPauta={awaitingByPauta}
          whatsappLinked={whatsappLinked}
          pautaActionStates={pautaActionStates}
          onOpenIdea={(id) => {
            setOpenSheet(null);
            onOpenIdea?.(id);
          }}
          onUnsavePauta={onUnsavePauta}
          onRetryPautaAction={onRetryPautaAction}
          onClose={() => setOpenSheet(null)}
        />
      ) : null}
    </div>
  );
}
