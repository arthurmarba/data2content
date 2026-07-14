"use client";

// Aba "Collabs" — duas linguagens, uma regra.
//
//   PILHA (DiagnosticoCollabStack)  = decisão a dois. Toda pauta com criador
//     compatível vira card arrastável. A decisão de collab mora AQUI, e só aqui.
//   LISTA                           = ideia solo. Pautas sem par continuam como
//     card de lista, sem swipe — não há segundo lado esperando resposta.
//
// O bloco de collab embutido no card de lista só volta quando o match está
// COMBINADO (aí é status, não decisão). Free vê a pilha com o criador
// misterioso (coração abre paywall, zero custo de match). Seções que dependem
// de dado real somem quando não há dado — sem placeholder (guardrail).
//
// Ver docs/brief-collabs-gamificada-fable.md para as decisões travadas.

import { useMemo, useState } from "react";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";
import {
  DiagnosticoCollabStack,
  MetaChip,
  type CollabStackDecision,
  type CollabStackItem,
} from "./DiagnosticoCollabStack";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  SAFE_TOP,
  CARD_RADIUS,
  CS_BRAND_HEX,
  CS_INK_HEX,
  CS_LINE,
  CS_MUTED,
  CS_NEUTRAL_HEX,
  CS_PAPER_HEX,
  CS_FONT_DISPLAY,
  CS_DISPLAY_TRACKING,
} from "./diagnosticoTokens";

const WA_GREEN = "#25D366";

// Página branca (igual ao Perfil). Uma família de card só: BRANCO com sombra
// de elevação — no deck (alto) e na mochila (compacto). O palco lavanda saiu:
// com os botões dentro do card, a moldura virou card-dentro-de-card.
const FEED_BG = "var(--ds-color-surface)";
const FEED_CARD_SHADOW =
  "0 1px 3px rgba(28,28,30,0.05), 0 8px 20px rgba(28,28,30,0.09), 0 0 0 0.5px rgba(28,28,30,0.04)";

export type PautaActionKind = "save" | "unsave" | "dismiss" | "collab-interest";
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
  /** Criador compatível por pauta (id da pauta → match). Ausente/null = sem collab. */
  pautaCollabs?: Map<string, NarrativeCollabMatch | null>;
  /** True enquanto o match por-pauta está sendo buscado — mostra skeleton da pilha. */
  pautaCollabsLoading?: boolean;
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
  /** Descarte PERMANENTE (status "dismissed") — a pauta rejeitada nunca mais volta. */
  onDismissPauta?: (id: string) => void;
  /** Abre o grupo da comunidade no WhatsApp (o gate Pro/paywall mora no caller). */
  onOpenWhatsAppCommunity?: () => void;
  onConnectWhatsApp?: () => void;
  onUpgrade?: (context?: PaywallContext) => void;
  onGenerate?: () => void;
  /** Volta para a aba Perfil (estado sem mapa). */
  onBackToPerfil?: () => void;
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

// Ícone redondo do header. Badge verde = novidade (matches); preto = acervo neutro.
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
  const badgeBg = badgeTone === "match" ? "#22c55e" : CS_INK_HEX;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: "relative", width: 40, height: 40, borderRadius: 9999, flexShrink: 0,
        display: "inline-grid", placeItems: "center", background: "transparent",
        border: `1.5px solid ${CS_LINE}`, cursor: "pointer", fontFamily: "inherit",
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
            border: "2px solid var(--ds-color-on-brand)",
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
  matchCount,
  loading,
  onOpenSalvas,
  onOpenCombinadas,
  onOpenCommunityWhatsApp,
}: {
  /** Pautas salvas (pra gravar). */
  savedCount: number;
  /** Collabs combinadas. */
  matchCount: number;
  loading?: boolean;
  onOpenSalvas: () => void;
  onOpenCombinadas: () => void;
  onOpenCommunityWhatsApp?: () => void;
}) {
  return (
    // Hero em Bricolage (creator-studio) — piloto do design system da landing.
    // Compacto de propósito: nesta tela o header é coadjuvante do deck — cada
    // pt gasto aqui é pt tirado do card (que é a experiência inteira da aba).
    <div style={{ padding: "12px 20px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {/* O contador do marcador "pulsa" quando um card cai na mochila. */}
      <style>{`@keyframes d2c-pocket-pop{0%{transform:scale(1)}40%{transform:scale(1.45)}100%{transform:scale(1)}}`}</style>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{
          fontFamily: CS_FONT_DISPLAY,
          fontSize: "clamp(26px, 8.5vw, 33px)",
          fontWeight: 700, color: CS_INK_HEX, margin: 0,
          letterSpacing: CS_DISPLAY_TRACKING, lineHeight: 1.1,
        }}>
          Collabs
        </h1>
      </div>
      {/* Três pontos de entrada: comunidade (WhatsApp — onde a comunidade
          acontece de fato, sempre visível) < matches (novidade) < salvas
          (acervo). Combinadas fica SEMPRE visível — mesmo sem match, é onde o
          criador confirma que ainda não deu match (a sheet mostra o estado
          vazio em vez do ícone simplesmente sumir, o que lia como "essa função
          não existe"). Salvas some quando vazio porque é um acervo — sem nada
          guardado não há o que abrir. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {onOpenCommunityWhatsApp ? (
          <HeaderIconButton
            onClick={onOpenCommunityWhatsApp}
            ariaLabel="Comunidade no WhatsApp"
            badgeTone="neutral"
          >
            <WhatsAppIcon color={WA_GREEN} size={18} />
          </HeaderIconButton>
        ) : null}
        {loading ? (
          <>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 9999, background: CS_NEUTRAL_HEX }} />
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 9999, background: CS_NEUTRAL_HEX }} />
          </>
        ) : (
          <>
            <HeaderIconButton
              onClick={onOpenCombinadas}
              ariaLabel={matchCount > 0 ? `Ver combinadas (${matchCount})` : "Ver combinadas — nenhuma ainda"}
              badge={matchCount}
              badgeTone="match"
            >
              <CollabGlyph />
            </HeaderIconButton>
            {savedCount > 0 ? (
              <HeaderIconButton
                onClick={onOpenSalvas}
                ariaLabel={`Ver pautas salvas (${savedCount})`}
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
// O deck tria; a gaveta guarda. Combinadas (verde, com atalho pro match) em
// cima; "Pra gravar" (salvas, com selos de status) embaixo; o alerta de
// WhatsApp mora no rodapé — "te aviso quando der match" ao lado dos matches.

// Casca comum das gavetas — handle, título, ×, corpo rolável. Cada gaveta é
// single-purpose (Combinadas OU Pra gravar), pra nenhuma ficar poluída.
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
            className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500"
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
    <CollabSheet title="Combinadas" onClose={onClose}>
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
              borderRadius: 9999, background: "#f5f3ff", marginBottom: 12,
            }} aria-hidden="true">
              <CollabGlyph size={22} color="#7c3aed" />
            </span>
            <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.3 }}>
              Nenhuma collab combinada ainda
            </p>
            <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "5px 0 0" }}>
              Quando um criador topar a mesma pauta que você, aparece aqui.
            </p>
          </div>
        )}
      </div>
      {/* Alerta de WhatsApp — "te aviso quando der match" mora junto dos matches. */}
      <div style={{ borderTop: "1px solid var(--ds-color-neutral)", margin: "16px 0 0", padding: "13px 20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 12.5, color: TEXT_BODY_HEX, lineHeight: 1.4 }}>
          Te avisamos no WhatsApp quando uma collab der match.
        </span>
        {whatsappLinked ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
            borderRadius: 999, padding: "6px 11px", background: "#dcfce7", color: "#15803d",
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
              borderRadius: 999, padding: "7px 13px", background: "transparent", color: TEXT_PRIMARY_HEX,
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

// Painel Pra gravar — salvas-solo + aguardando. Casada NÃO mora aqui: a célula
// completa dela (handoff, como gravar) vive em Combinadas — uma casa por item.
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
    <CollabSheet title="Pra gravar" onClose={onClose}>
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
            O que você quiser gravar cai aqui — arraste pra direita no deck.
          </p>
        )}
      </div>
    </CollabSheet>
  );
}

// ─── Skeleton da pilha (match por-pauta carregando) ───────────────────────────

function StackSkeleton() {
  return (
    <div role="status" aria-label="Preparando suas collabs">
      <span className="sr-only">Preparando suas collabs…</span>
      <style>{`@keyframes d2c-collab-pulse{0%,100%{opacity:.55}50%{opacity:.25}}`}</style>
      <div style={{ padding: "0 2px 10px" }}>
        <div style={{ height: 11, width: 96, borderRadius: 6, background: "#ece9f6", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
      </div>
      <div style={{ position: "relative", height: 168 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotate(-2.5deg) scale(0.955) translateY(9px)", borderRadius: 20, background: "#f6f2ee", animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: "var(--ds-color-surface)", boxShadow: FEED_CARD_SHADOW, padding: "16px 18px" }}>
          <div style={{ height: 10, width: "38%", borderRadius: 6, background: "#ece9f6", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
          <div style={{ height: 14, width: "82%", borderRadius: 6, background: "#ece9f6", margin: "10px 0 0", animation: "d2c-collab-pulse 1.2s ease-in-out infinite" }} />
          <div style={{ height: 14, width: "60%", borderRadius: 6, background: "#f0eef7", margin: "6px 0 0", animation: "d2c-collab-pulse 1.3s ease-in-out infinite" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 34 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9999, background: "#ece9f6", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
            <div style={{ height: 10, width: "45%", borderRadius: 6, background: "#f0eef7", animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
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
          background: "#fff1f2", color: "#be123c", fontSize: 22, fontWeight: 800,
        }}
      >
        !
      </span>
      <p style={{ margin: "14px 0 0", fontSize: 16, fontWeight: 750, color: TEXT_PRIMARY_HEX }}>
        Não conseguimos preparar suas collabs
      </p>
      <p style={{ margin: "6px 0 0", maxWidth: 280, fontSize: 13, lineHeight: 1.5, color: TEXT_SECONDARY_HEX }}>
        {message || "Suas pautas continuam seguras. Tente carregar a rodada novamente."}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 18, border: "none", borderRadius: 999, padding: "11px 18px",
            background: CS_BRAND_HEX, color: "var(--ds-color-on-brand)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 750, cursor: "pointer",
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
        <span style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#059669", padding: "0 2px", marginBottom: 10 }}>
          Combinadas
        </span>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {matches.map(({ pautaId, collab }) => {
          const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
          const initials = firstName.slice(0, 1).toUpperCase();
          const pauta = pautaById.get(pautaId);
          const pautaTitle = pauta ? cleanIdeaText(pauta.title) : "";
          return (
            <button
              key={pautaId}
              type="button"
              onClick={onOpenMatch ? () => onOpenMatch(pautaId) : undefined}
              aria-label={pauta ? `Collab combinada com ${collab.name}: ${pautaTitle}` : `Collab combinada com ${collab.name}`}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%",
                borderRadius: 16, padding: "10px 14px 10px 10px", textAlign: "left",
                background: "#f0fdf4", border: "1px solid #dcfce7",
                cursor: onOpenMatch ? "pointer" : "default", fontFamily: "inherit",
              }}
            >
              <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 9999, overflow: "hidden",
                  background: "var(--ds-color-ink)", color: "var(--ds-color-on-brand)", display: "grid", placeItems: "center",
                  fontSize: 14, fontWeight: 700,
                }}>
                  {collab.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={collab.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
                  ) : initials}
                </div>
                <span style={{
                  position: "absolute", bottom: -2, right: -2, width: 16, height: 16,
                  borderRadius: 9999, background: "#22c55e", border: "2px solid #f0fdf4",
                  display: "grid", placeItems: "center",
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.2 }}>
                  Você e {firstName} toparam
                </span>
                {pauta ? (
                  <span style={{ display: "block", fontSize: 12, color: "#047857", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {pautaTitle}
                  </span>
                ) : null}
              </div>
              {onOpenMatch ? <span style={{ fontSize: 12.5, fontWeight: 600, color: "#059669", flexShrink: 0 }}>Ver ›</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Card de lista (pauta salva — vive só dentro de "Pra gravar") ─────────────

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7m2 0v12.5A1.5 1.5 0 0 1 15.5 21h-7A1.5 1.5 0 0 1 7 19.5V7h10z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
        fontSize: 11, fontWeight: 700, color: "#7c3aed",
        background: "#f5f3ff", borderRadius: 999, padding: "4px 10px",
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" stroke="#7c3aed" strokeWidth="2.4" />
          <path d="M12 8v4.2l2.8 1.6" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        Aguardando {firstName}
      </span>
      <p style={{ fontSize: 11.5, color: TEXT_SECONDARY_HEX, lineHeight: 1.45, margin: "6px 0 0" }}>
        Se {firstName} também topar essa pauta, é match — {whatsappLinked ? "te avisamos no WhatsApp" : "você fica sabendo aqui"}.
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
      ? "Registrando collab..."
      : state.kind === "unsave"
        ? "Removendo..."
        : state.kind === "dismiss"
          ? "Descartando..."
          : "Salvando..."
    : state.message ?? (
        state.kind === "collab-interest"
          ? "Collab não sincronizada"
          : state.kind === "unsave"
            ? "Removida da lista. Sincronização pendente."
            : state.kind === "dismiss"
              ? "Descartada nesta sessão. Sincronização pendente."
              : "Não foi possível salvar agora"
      );
  const retryLabel = state.kind === "unsave" || state.kind === "dismiss" ? "Sincronizar" : "Tentar de novo";
  const warningTone = state.kind === "unsave" || state.kind === "dismiss";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        marginTop: 10, borderRadius: 12, padding: "8px 10px",
        background: pending ? "var(--ds-color-neutral)" : warningTone ? "#fefce8" : "#fff1f2",
        color: pending ? TEXT_SECONDARY_HEX : warningTone ? "#854d0e" : "#be123c",
        fontSize: 11.5, fontWeight: 650,
      }}
    >
      <span>{label}</span>
      {!pending && onRetry ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          style={{
            flexShrink: 0, border: "none", background: "transparent", color: warningTone ? "#854d0e" : "#be123c",
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
  /** Tira a pauta de "Pra gravar" (des-salva). Card só existe aqui já salvo —
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
    <div style={{ borderRadius: CARD_RADIUS, background: "var(--ds-color-surface)", boxShadow: FEED_CARD_SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", position: "relative" }}>
        {/* Só remove de verdade quando a pauta é PURAMENTE salva — combinada
            ou aguardando ficam na lista mesmo se o "saved" virar false (é um
            compromisso de collab, não desaparece só por destogglar o salvo).
            Botão de excluir só aparece onde a ação realmente funciona. */}
        {canRemove ? (
          <button
            type="button"
            onClick={() => onUnsavePauta?.(pauta.id)}
            aria-label="Remover de Pra gravar"
            style={{
              position: "absolute", top: 10, right: 10, zIndex: 1,
              display: "grid", placeItems: "center", width: 34, height: 34,
              borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
              background: "transparent", color: TEXT_SECONDARY_HEX, fontFamily: "inherit",
            }}
          >
            <TrashIcon />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenIdea ? () => onOpenIdea(pauta.id) : undefined}
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, paddingRight: canRemove ? 36 : 0, cursor: onOpenIdea ? "pointer" : "default", fontFamily: "inherit" }}
        >
          {pauta.territory ? (
            <span style={{ display: "block", marginBottom: 8 }}>
              <MetaChip label={pauta.territory} />
            </span>
          ) : null}
          <p style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: 0, lineHeight: 1.3, margin: 0, overflowWrap: "normal", wordBreak: "normal", hyphens: "none" }}>
            {title}
          </p>
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
        Gerando novas pautas…
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={isPro ? onGenerate : () => onUpgrade?.("planning")}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        borderRadius: 999, padding: "10px 18px", background: CS_BRAND_HEX, color: "var(--ds-color-on-brand)",
        fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

// Convite pra comunidade no fim da rodada — o deck triado é o momento de
// lembrar que o criador não está sozinho: a comunidade acontece no WhatsApp.
function CommunityInviteCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS, background: CS_NEUTRAL_HEX, padding: "16px 18px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center",
      }}
    >
      <span style={{ display: "inline-flex", width: 36, height: 36, borderRadius: 999, background: "var(--ds-color-surface)", alignItems: "center", justifyContent: "center" }}>
        <WhatsAppIcon color={WA_GREEN} size={19} />
      </span>
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: CS_INK_HEX, letterSpacing: -0.2, margin: 0 }}>
          A comunidade continua no WhatsApp
        </p>
        <p style={{ fontSize: 13, color: CS_MUTED, lineHeight: 1.45, margin: "4px 0 0" }}>
          É lá que os criadores combinam as collabs de verdade.
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: 999, padding: "10px 18px", background: CS_BRAND_HEX, color: "var(--ds-color-on-brand)",
          fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
        }}
      >
        Entrar na comunidade
      </button>
    </div>
  );
}

export function DiagnosticoCollabsFeed({
  pautas,
  isPro,
  whatsappLinked,
  isGeneratingIdeas,
  ideaGenerationBlocker,
  pautaCollabs,
  pautaCollabsLoading,
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
  onDismissPauta,
  onOpenWhatsAppCommunity,
  onConnectWhatsApp,
  onUpgrade,
  onGenerate,
  onBackToPerfil,
}: Props) {
  const hasPautas = pautas.length > 0;
  const mapless = ideaGenerationBlocker === "map_incomplete";
  const bootstrapPending = bootstrapStatus === "idle" || bootstrapStatus === "loading";
  const bootstrapFailed = bootstrapStatus === "error";
  // Duas gavetas single-purpose, dois pontos de entrada no header: novidade
  // (Combinadas) × acervo (Pra gravar). Nunca as duas abertas ao mesmo tempo.
  const [openSheet, setOpenSheet] = useState<null | "combinadas" | "salvas">(null);

  // ─── Deck único + estante ────────────────────────────────────────────────────
  //
  // A tela inteira é UMA experiência de swipe. O deck tria; a estante guarda.
  //   - Card "pauta": direita = salvar (vai pra estante), esquerda = descartar
  //     (efêmero — chave "pauta:<id>" no mesmo Map de decisões; nunca POSTa
  //     porque o shell só persiste quando há match real pra pauta).
  //   - Card "collab" (o prêmio, intercalado NO MEIO — nunca 1º): direita =
  //     quero fazer (+ salva a pauta), esquerda = não agora → a PAUTA re-entra
  //     no fim do deck como card solo (recusar o parceiro não custa a ideia).
  //   - Estante "Pra gravar": salvas ∪ interesse pendente ∪ combinadas — com
  //     selo de status quando houver.
  const failedAction = useMemo(() => {
    if (!pautaActionStates) return null;
    for (const [id, state] of pautaActionStates.entries()) {
      if (state.phase === "failed" && state.kind !== "unsave" && state.kind !== "dismiss") return { id, state };
    }
    return null;
  }, [pautaActionStates]);

  const { deckItems, shelfPautas, awaitingByPauta } = useMemo(() => {
    const matched = new Map<string, NarrativeCollabMatch>(
      (confirmedMatches ?? []).map((m) => [m.pautaId, m.collab]),
    );
    const awaiting = new Map<string, NarrativeCollabMatch>();
    const pautaCards: CollabStackItem[] = [];
    const collabCards: CollabStackItem[] = [];
    const shelf: ContentIdeaListItem[] = [];

    // Free: a 2ª pauta da geração vira o card misterioso — id fixo (não posição
    // do deck), pra não "pular" de card conforme as decisões avançam.
    const mysteryId = !isPro && pautas.length > 1 ? pautas[1]!.id : null;

    for (const pauta of pautas) {
      const actionState = pautaActionStates?.get(pauta.id) ?? null;
      const locallySaved =
        actionState?.kind === "save" || actionState?.kind === "collab-interest";
      const locallyDismissed = actionState?.kind === "dismiss";
      const locallyUnsaved = actionState?.kind === "unsave";

      // Rejeitada é PERMANENTE: descartada nunca reaparece — nem no deck, nem na
      // estante. (O read service já filtra "dismissed"; isto cobre o otimismo
      // local da sessão, antes do reload.)
      if (locallyUnsaved || locallyDismissed || pauta.status === "dismissed" || pauta.status === "posted") continue;

      const collab = isPro ? pautaCollabs?.get(pauta.id) ?? null : null;
      const collabDecision = collabDecisions?.get(pauta.id);
      const isMatched = matched.has(pauta.id);
      const isSaved = !locallyUnsaved && (locallySaved || pauta.status === "saved");
      const isInterested = collabDecision === "interested";

      if (isInterested && !isMatched && collab) awaiting.set(pauta.id, collab);

      // Casada tem UMA casa: Combinadas (célula rica, com handoff e como
      // gravar). Antes ela também aparecia em "Pra gravar" como selo — o mesmo
      // item em duas gavetas com pesos diferentes confundia mais do que
      // ajudava. Sai do deck e da estante; vive só na gaveta de matches.
      if (isMatched) continue;

      // Estante: o que o criador ACEITOU e ainda espera ação dele (salvou /
      // topou e aguarda o outro lado). Rejeição não cai aqui — vira
      // "dismissed" e some de vez.
      if (isSaved || isInterested) {
        shelf.push(pauta);
        continue;
      }

      if (collab) {
        collabCards.push({ kind: "collab", pauta, collab }); // o prêmio
      } else {
        pautaCards.push({ kind: pauta.id === mysteryId ? "mystery" : "pauta", pauta, collab: null });
      }
    }

    // Intercala PELA ORDEM DA GERAÇÃO (pos. 1, 4, 7…). Os cards aqui já são só os
    // não-decididos (decididos foram pra estante ou descartados acima), então o
    // deck é exatamente o que resta pra triar — sem re-entrada de rejeitadas.
    const deck: CollabStackItem[] = [...pautaCards];
    collabCards.forEach((card, i) => {
      const pos = Math.min(1 + i * 3, deck.length);
      deck.splice(pos, 0, card);
    });

    // Estante: aguardando primeiro (tem gente do outro lado), depois salvas.
    shelf.sort((a, b) => {
      const rank = (p: ContentIdeaListItem) => (awaiting.has(p.id) ? 0 : 1);
      return rank(a) - rank(b);
    });

    return { deckItems: deck, shelfPautas: shelf, awaitingByPauta: awaiting };
  }, [pautas, pautaCollabs, collabDecisions, confirmedMatches, isPro, pautaActionStates]);

  const pautaById = useMemo(() => new Map(pautas.map((p) => [p.id, p])), [pautas]);
  // Mostra a área do deck enquanto há o que triar OU quando a rodada foi triada
  // (algo já foi pra estante) — aí o stack exibe a recompensa "triou a rodada".
  const showDeckArea =
    bootstrapPending ||
    bootstrapFailed ||
    (isPro && Boolean(pautaCollabsLoading)) ||
    deckItems.length > 0 ||
    shelfPautas.length > 0 ||
    (collabDecisions?.size ?? 0) > 0;

  // Roteia a decisão pelo tipo do card — o gesto é um, as consequências não.
  //   REJEITAR (qualquer card) = descarte PERMANENTE da pauta: nunca mais volta,
  //   nem no reload nem numa geração futura. (Antes: rejeitar collab devolvia a
  //   pauta como solo — removido; "rejeitou, sumiu".)
  //   ACEITAR: collab → guarda + registra interesse (pode casar); solo → guarda.
  const handleDeckDecision = (pautaId: string, decision: CollabStackDecision) => {
    const item = deckItems.find((i) => i.pauta.id === pautaId);
    if (!item) return;

    if (decision === "dismissed") {
      onDismissPauta?.(pautaId);
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
      aria-busy={bootstrapPending || undefined}
      style={{ background: FEED_BG, minHeight: "100%", height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Header — o gradiente quente termina na cor do feed (sem emenda visível). */}
      <div style={{ background: `linear-gradient(180deg, ${CS_PAPER_HEX} 0%, ${FEED_BG} 100%)`, paddingTop: SAFE_TOP, paddingBottom: 6 }}>
        <FeedHeader
          savedCount={shelfPautas.length}
          matchCount={confirmedMatches?.length ?? 0}
          loading={bootstrapPending}
          onOpenSalvas={() => setOpenSheet("salvas")}
          onOpenCombinadas={() => setOpenSheet("combinadas")}
          onOpenCommunityWhatsApp={onOpenWhatsAppCommunity}
        />
      </div>

      {failedAction ? (
        <div style={{ padding: "8px 20px 0" }}>
          <div
            role="status"
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              borderRadius: 14, padding: "10px 12px",
              background: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "#fefce8" : "#fff1f2",
              color: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "#854d0e" : "#be123c",
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
                  color: failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "#854d0e" : "#be123c",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 800, padding: 0, cursor: "pointer",
                }}
              >
                {failedAction.state.kind === "unsave" || failedAction.state.kind === "dismiss" ? "Sincronizar" : "Tentar de novo"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {hasPautas ? (
        <>
          {/* A MESA — a tela é o deck, entre a stories row e a tab bar. Sem
              palco: o card senta direto na página, com a própria elevação.
              flex:1 + minHeight:0 = preenche o espaço real que sobra (não uma
              altura fixa) — minHeight:0 é o que permite o filho ENCOLHER
              abaixo do tamanho do conteúdo quando o espaço aperta, em vez de
              estourar o container pai. */}
          {showDeckArea ? (
            // flex-start (não center): o card cola logo abaixo do header e a
            // sobra de telas altas cai TODA embaixo, entre o rodapé do card e
            // a tab bar — centralizar dividia essa sobra em dois vãos e
            // deixava o card "boiando" no meio da tela, longe do topo.
            <div style={{ padding: "10px 20px 8px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
              {bootstrapPending ? (
                <StackSkeleton />
              ) : bootstrapFailed ? (
                <CollabsLoadError message={bootstrapError} onRetry={onRetryBootstrap} />
              ) : (
                <DiagnosticoCollabStack
                  items={deckItems}
                  isPro={isPro}
                  shelfCount={shelfPautas.length}
                  // "Gerar" mora DENTRO da recompensa "Você triou a rodada" —
                  // recompensa + próximo passo são um bloco só, centrado na
                  // mesa (antes o botão ficava órfão no rodapé da tela).
                  clearedFooter={
                    <GenerateButton
                      isPro={isPro}
                      isGeneratingIdeas={isGeneratingIdeas}
                      onGenerate={onGenerate}
                      onUpgrade={onUpgrade}
                      label="Gerar novas pautas →"
                    />
                  }
                  clearedCommunityCard={
                    onOpenWhatsAppCommunity ? (
                      <CommunityInviteCard onOpen={onOpenWhatsAppCommunity} />
                    ) : undefined
                  }
                  onDecide={handleDeckDecision}
                  onOpenIdea={onOpenIdea}
                  onUpgrade={() => onUpgrade?.("narrative_map")}
                />
              )}
            </div>
          ) : (
            // Sem área de deck (nada triado nesta sessão e deck vazio — ex.:
            // tudo foi postado): o CTA de gerar ainda precisa de uma casa.
            !pautaCollabsLoading && deckItems.length === 0 ? (
              <div style={{ padding: "24px 18px 0", display: "flex", justifyContent: "center" }}>
                <GenerateButton
                  isPro={isPro}
                  isGeneratingIdeas={isGeneratingIdeas}
                  onGenerate={onGenerate}
                  onUpgrade={onUpgrade}
                  label="Gerar novas pautas →"
                />
              </div>
            ) : null
          )}
        </>
      ) : mapless ? (
        // Estado travado: sem mapa, devolve ao Perfil. Sem feed vazio.
        <div style={{ padding: "32px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, margin: 0 }}>
            Suas pautas nascem do seu mapa
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "8px 0 18px" }}>
            Monte seu mapa no Perfil e suas primeiras pautas — com criadores pra collab — aparecem aqui.
          </p>
          <button
            type="button"
            onClick={onBackToPerfil}
            style={{
              borderRadius: 999, padding: "11px 20px", background: CS_BRAND_HEX, color: "var(--ds-color-on-brand)",
              fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Ir para o Perfil
          </button>
        </div>
      ) : (
        // Mapa pronto, ainda sem pautas: convite calmo a gerar.
        <div style={{ padding: "28px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, margin: 0 }}>
            Pronto para suas primeiras pautas?
          </p>
          <p style={{ fontSize: 14, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "8px 0 18px" }}>
            A D2C cria ideias do seu mapa, na sua voz — e indica criadores pra postar junto.
          </p>
          <GenerateButton
            isPro={isPro}
            isGeneratingIdeas={isGeneratingIdeas}
            onGenerate={onGenerate}
            onUpgrade={onUpgrade}
            label="Gerar pautas"
          />
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
