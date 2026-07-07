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
import type {
  DiagnosticoCreatorDirectoryState,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";
import { CreatorStoriesRow } from "./DiagnosticoPage";
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
  INK_DARK_HEX,
  SAFE_TOP,
  CARD_RADIUS,
} from "./diagnosticoTokens";

const WA_GREEN = "#25D366";

// Página branca (igual ao Perfil). Uma família de card só: BRANCO com sombra
// de elevação — no deck (alto) e na mochila (compacto). O palco lavanda saiu:
// com os botões dentro do card, a moldura virou card-dentro-de-card.
const FEED_BG = "#ffffff";
const FEED_CARD_SHADOW =
  "0 1px 3px rgba(28,28,30,0.05), 0 8px 20px rgba(28,28,30,0.09), 0 0 0 0.5px rgba(28,28,30,0.04)";

function WhatsAppIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 8.5c0 4 3 7 6.5 7 .8 0 1.3-.6 1.3-1.2 0-.3-1.6-1.2-1.9-1.2-.4 0-.7.7-1 .7-.6 0-2.4-1.6-2.4-2.3 0-.3.6-.5.6-1 0-.3-.8-1.9-1.2-1.9-.5 0-1.2.5-1.2 1.1z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  pautas: ContentIdeaListItem[];
  creatorDirectory?: DiagnosticoCreatorDirectoryState;
  collabSuggestedIds?: Set<string>;
  isPro: boolean;
  whatsappLinked: boolean;
  isGeneratingIdeas: boolean;
  /** "map_incomplete" => sem mapa (estado travado que devolve ao Perfil). */
  ideaGenerationBlocker?: "premium_required" | "quota_exceeded" | "map_incomplete" | "failed" | null;
  /** Criador compatível por pauta (id da pauta → match). Ausente/null = sem collab. */
  pautaCollabs?: Map<string, NarrativeCollabMatch | null>;
  /** True enquanto o match por-pauta está sendo buscado — mostra skeleton da pilha. */
  pautaCollabsLoading?: boolean;
  /** Decisões de swipe do criador nesta sessão (pautaId → interested/dismissed). */
  collabDecisions?: ReadonlyMap<string, CollabStackDecision>;
  /** Registra "quero fazer" / "não agora" de uma pauta da pilha. */
  onCollabDecision?: (pautaId: string, decision: CollabStackDecision) => void;
  /** Matches confirmados (os dois toparam). Vazio = fileira Combinadas não aparece. */
  confirmedMatches?: ReadonlyArray<{ pautaId: string; collab: NarrativeCollabMatch }>;
  /** Reabre a tela do match (revisit) a partir de Combinadas / status no card. */
  onOpenMatch?: (pautaId: string) => void;
  onOpenIdea?: (id: string) => void;
  /** Salva/dessalva a pauta (status saved↔active). Pauta salva resiste à geração. */
  onToggleSave?: (id: string) => void;
  onOpenCommunity?: () => void;
  onOpenCreatorMediaKit?: (slug: string) => void;
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
  const badgeBg = badgeTone === "match" ? "#22c55e" : "#18181b";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: "relative", width: 40, height: 40, borderRadius: 9999, flexShrink: 0,
        display: "inline-grid", placeItems: "center", background: "transparent",
        border: `1.5px solid #e4e4e7`, cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {children}
      {typeof badge === "number" && badge > 0 ? (
        <span
          key={pulseKey}
          style={{
            position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px",
            borderRadius: 999, background: badgeBg, color: "#fff", fontSize: 10, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
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
  onOpenSalvas,
  onOpenCombinadas,
}: {
  /** Pautas salvas (pra gravar). */
  savedCount: number;
  /** Collabs combinadas. */
  matchCount: number;
  onOpenSalvas: () => void;
  onOpenCombinadas: () => void;
}) {
  return (
    // Hero alinhado ao header do Perfil ("Olá, nome"): mesma família, peso e clamp.
    <div style={{ padding: "22px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {/* O contador do marcador "pulsa" quando um card cai na mochila. */}
      <style>{`@keyframes d2c-pocket-pop{0%{transform:scale(1)}40%{transform:scale(1.45)}100%{transform:scale(1)}}`}</style>
      <div style={{ minWidth: 0, flex: 1 }}>
        <h1 style={{
          fontFamily: '"Poppins", -apple-system, "SF Pro Display", sans-serif',
          fontSize: "clamp(28px, 10.7vw, 40px)",
          fontWeight: 700, color: INK_DARK_HEX, margin: 0,
          letterSpacing: -0.5, lineHeight: 1.1,
        }}>
          Collabs
        </h1>
      </div>
      {/* Dois pontos de entrada distintos: matches (novidade) × salvas (acervo).
          Cada ícone só aparece quando tem conteúdo. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {matchCount > 0 ? (
          <HeaderIconButton
            onClick={onOpenCombinadas}
            ariaLabel={`Ver combinadas (${matchCount})`}
            badge={matchCount}
            badgeTone="match"
          >
            <CollabGlyph />
          </HeaderIconButton>
        ) : null}
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
      className="fixed inset-0 z-[270] flex items-end bg-zinc-950/40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(env(safe-area-inset-top,0px)+2.5rem)]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-3.25rem)] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex justify-center pt-4" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <div className="flex items-center justify-between px-5 pb-4 pt-1">
          <h2 className="text-[19px] font-bold tracking-tight text-zinc-950">{title}</h2>
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
        <ConfirmedMatchesRow matches={matches} pautaById={pautaById} onOpenMatch={onOpenMatch} framed={false} withHeading={false} />
      </div>
      {/* Alerta de WhatsApp — "te aviso quando der match" mora junto dos matches. */}
      <div style={{ borderTop: "1px solid #f4f4f5", margin: "16px 0 0", padding: "13px 20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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

// Painel Pra gravar — só as pautas salvas (o acervo).
function SalvasSheet({
  shelfPautas,
  matchedByPauta,
  awaitingByPauta,
  onOpenIdea,
  onToggleSave,
  onClose,
}: {
  shelfPautas: ContentIdeaListItem[];
  matchedByPauta: Map<string, NarrativeCollabMatch>;
  awaitingByPauta: Map<string, NarrativeCollabMatch>;
  onOpenIdea?: (id: string) => void;
  onToggleSave?: (id: string) => void;
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
                matchedCollab={matchedByPauta.get(pauta.id) ?? null}
                awaitingCollab={awaitingByPauta.get(pauta.id) ?? null}
                onOpenIdea={onOpenIdea}
                onToggleSave={onToggleSave}
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
    <div>
      <style>{`@keyframes d2c-collab-pulse{0%,100%{opacity:.55}50%{opacity:.25}}`}</style>
      <div style={{ padding: "0 2px 10px" }}>
        <div style={{ height: 11, width: 96, borderRadius: 6, background: "#ece9f6", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
      </div>
      <div style={{ position: "relative", height: 168 }}>
        <div style={{ position: "absolute", inset: 0, transform: "rotate(-2.5deg) scale(0.955) translateY(9px)", borderRadius: 20, background: "#f6f2ee", animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: "#fff", boxShadow: FEED_CARD_SHADOW, padding: "16px 18px" }}>
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
          return (
            <button
              key={pautaId}
              type="button"
              onClick={onOpenMatch ? () => onOpenMatch(pautaId) : undefined}
              aria-label={pauta ? `Collab combinada com ${collab.name}: ${pauta.title}` : `Collab combinada com ${collab.name}`}
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
                  background: "#18181b", color: "#fff", display: "grid", placeItems: "center",
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
                    {pauta.title}
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

// Status (não decisão): selos discretos — o card completo do match (com atalho
// pro overlay) mora na seção Combinadas; repetir o bloco aqui duplicava a
// mesma informação com o mesmo peso a poucos px de distância.
function MatchedCollabRow({ collab }: { collab: NarrativeCollabMatch }) {
  const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10,
      fontSize: 11, fontWeight: 700, color: "#059669",
      background: "#f0fdf4", borderRadius: 999, padding: "4px 10px",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12l5 5 9-10" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Combinada com {firstName}
    </span>
  );
}

// Você topou a collab; o outro lado ainda não respondeu — presença quieta.
function AwaitingCollabRow({ collab }: { collab: NarrativeCollabMatch }) {
  const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10,
      fontSize: 11, fontWeight: 700, color: "#7c3aed",
      background: "#f5f3ff", borderRadius: 999, padding: "4px 10px",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" stroke="#7c3aed" strokeWidth="2.4" />
        <path d="M12 8v4.2l2.8 1.6" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      Aguardando {firstName}
    </span>
  );
}

function PautaCard({
  pauta,
  matchedCollab,
  awaitingCollab,
  onOpenIdea,
  onToggleSave,
}: {
  pauta: ContentIdeaListItem;
  /** Só quando o match está COMBINADO — vira selo discreto (o card completo mora em Combinadas). */
  matchedCollab?: NarrativeCollabMatch | null;
  /** Você topou; o outro lado ainda não — selo roxo quieto. */
  awaitingCollab?: NarrativeCollabMatch | null;
  onOpenIdea?: (id: string) => void;
  /** Tira a pauta de "Pra gravar" (des-salva). Card só existe aqui já salvo —
   * não é alternância salvar/dessalvar, é remoção da lista. */
  onToggleSave?: (id: string) => void;
}) {
  return (
    // Eco compacto do card do deck — mesma família (branco, chip de meta,
    // título, selo), sem os botões de decisão. A mochila guarda; o deck decide.
    <div style={{ borderRadius: CARD_RADIUS, background: "#fff", boxShadow: FEED_CARD_SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", position: "relative" }}>
        {/* Só remove de verdade quando a pauta é PURAMENTE salva — combinada
            ou aguardando ficam na lista mesmo se o "saved" virar false (é um
            compromisso de collab, não desaparece só por destogglar o salvo).
            Botão de excluir só aparece onde a ação realmente funciona. */}
        {onToggleSave && !matchedCollab && !awaitingCollab ? (
          <button
            type="button"
            onClick={() => onToggleSave(pauta.id)}
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
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, paddingRight: onToggleSave && !matchedCollab && !awaitingCollab ? 36 : 0, cursor: onOpenIdea ? "pointer" : "default", fontFamily: "inherit" }}
        >
          {pauta.territory ? (
            <span style={{ display: "block", marginBottom: 8 }}>
              <MetaChip label={pauta.territory} />
            </span>
          ) : null}
          <p style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, lineHeight: 1.3, margin: 0 }}>
            {pauta.title}
          </p>
        </button>
        {matchedCollab ? (
          <MatchedCollabRow collab={matchedCollab} />
        ) : awaitingCollab ? (
          <AwaitingCollabRow collab={awaitingCollab} />
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
        borderRadius: 999, padding: "10px 18px", background: TEXT_PRIMARY_HEX, color: "#fff",
        fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );
}

export function DiagnosticoCollabsFeed({
  pautas,
  creatorDirectory,
  collabSuggestedIds,
  isPro,
  whatsappLinked,
  isGeneratingIdeas,
  ideaGenerationBlocker,
  pautaCollabs,
  pautaCollabsLoading,
  collabDecisions,
  onCollabDecision,
  confirmedMatches,
  onOpenMatch,
  onOpenIdea,
  onToggleSave,
  onOpenCommunity,
  onOpenCreatorMediaKit,
  onConnectWhatsApp,
  onUpgrade,
  onGenerate,
  onBackToPerfil,
}: Props) {
  const hasPautas = pautas.length > 0;
  const mapless = ideaGenerationBlocker === "map_incomplete";
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
  const pautaLocalKey = (id: string) => `pauta:${id}`;

  const { deckItems, shelfPautas, matchedByPauta, awaitingByPauta } = useMemo(() => {
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
      const collab = isPro ? pautaCollabs?.get(pauta.id) ?? null : null;
      const collabDecision = collabDecisions?.get(pauta.id);
      const pautaDecision = collabDecisions?.get(pautaLocalKey(pauta.id));
      const isMatched = matched.has(pauta.id);
      const isSaved = pauta.status === "saved";
      const isInterested = collabDecision === "interested";

      if (isInterested && !isMatched && collab) awaiting.set(pauta.id, collab);

      // Estante: tudo que o criador já escolheu (ou que o destino escolheu por ele).
      if (isSaved || isInterested || isMatched) {
        shelf.push(pauta);
        continue;
      }

      if (collab) {
        collabCards.push({ kind: "collab", pauta, collab }); // o prêmio
      } else {
        pautaCards.push({ kind: pauta.id === mysteryId ? "mystery" : "pauta", pauta, collab: null });
      }
    }

    // Intercala PELA ORDEM DA GERAÇÃO (pos. 1, 4, 7…) e só depois filtra as já
    // decididas — a posição de cada card é estável entre decisões. Filtrar antes
    // recalculava tudo e empurrava a collab pra sempre-segunda: virava "todas as
    // solos primeiro", não "surge no meio da jornada".
    const interleaved: CollabStackItem[] = [...pautaCards];
    collabCards.forEach((card, i) => {
      const pos = Math.min(1 + i * 3, interleaved.length);
      interleaved.splice(pos, 0, card);
    });
    const deck: CollabStackItem[] = interleaved.filter((item) =>
      item.kind === "collab"
        ? !collabDecisions?.get(item.pauta.id)
        : !collabDecisions?.get(pautaLocalKey(item.pauta.id)),
    );
    // Collab dispensada: a PAUTA re-entra no fim do deck como card solo —
    // recusar o parceiro não custa a ideia.
    for (const card of collabCards) {
      if (
        collabDecisions?.get(card.pauta.id) === "dismissed" &&
        !collabDecisions?.get(pautaLocalKey(card.pauta.id))
      ) {
        deck.push({ kind: "pauta", pauta: card.pauta, collab: null });
      }
    }

    // Estante: combinadas primeiro, depois aguardando, depois salvas.
    shelf.sort((a, b) => {
      const rank = (p: ContentIdeaListItem) =>
        matched.has(p.id) ? 0 : awaiting.has(p.id) ? 1 : 2;
      return rank(a) - rank(b);
    });

    return { deckItems: deck, shelfPautas: shelf, matchedByPauta: matched, awaitingByPauta: awaiting };
  }, [pautas, pautaCollabs, collabDecisions, confirmedMatches, isPro]);

  const pautaById = useMemo(() => new Map(pautas.map((p) => [p.id, p])), [pautas]);
  const showDeckArea =
    (isPro && Boolean(pautaCollabsLoading)) || deckItems.length > 0 || (collabDecisions?.size ?? 0) > 0;

  // Roteia a decisão pelo tipo do card — o gesto é um, as consequências não.
  const handleDeckDecision = (pautaId: string, decision: CollabStackDecision) => {
    const item = deckItems.find((i) => i.pauta.id === pautaId);
    if (!item) return;
    if (item.kind === "collab") {
      // "Quero fazer" também guarda a pauta na estante: topou, é dele pra trabalhar.
      if (decision === "interested" && item.pauta.status !== "saved") onToggleSave?.(pautaId);
      onCollabDecision?.(pautaId, decision);
      return;
    }
    // Pauta solo (e mystery via X): direita salva; esquerda descarta local.
    if (decision === "interested") {
      if (item.pauta.status !== "saved") onToggleSave?.(pautaId);
      onCollabDecision?.(pautaLocalKey(pautaId), "interested"); // tira do deck já
    } else {
      onCollabDecision?.(pautaLocalKey(pautaId), "dismissed");
    }
  };

  return (
    // flex column preenchendo a altura real do container rolável do shell —
    // NÃO um palpite em dvh. O deck-wrapper abaixo é flex:1 e recebe
    // EXATAMENTE o espaço que sobra depois do header/stories, em qualquer
    // altura de tela. Antes o card usava `min(58dvh, 490px)` — uma % da tela
    // INTEIRA, sem relação com o espaço real disponível — o que sobrepunha a
    // tab bar e cortava o título em telas mais baixas (ex.: iPhone SE, 667px).
    <div style={{ background: FEED_BG, minHeight: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header — o gradiente quente termina na cor do feed (sem emenda visível). */}
      <div style={{ background: `linear-gradient(180deg, #fff8f5 0%, ${FEED_BG} 100%)`, paddingTop: SAFE_TOP, paddingBottom: 6 }}>
        <FeedHeader
          savedCount={shelfPautas.length}
          matchCount={confirmedMatches?.length ?? 0}
          onOpenSalvas={() => setOpenSheet("salvas")}
          onOpenCombinadas={() => setOpenSheet("combinadas")}
        />
      </div>

      {/* Stories row + lupa (já trazem "Descobrir criadores" → comunidade) */}
      {creatorDirectory?.status === "ready" && creatorDirectory.creators.length > 0 && (
        <div style={{ paddingTop: 14, paddingBottom: 4 }}>
          <CreatorStoriesRow
            creators={creatorDirectory.creators}
            collabSuggestedIds={collabSuggestedIds}
            onDiscoverCollabs={onOpenCommunity}
            onOpenCreatorMediaKit={onOpenCreatorMediaKit}
          />
        </div>
      )}

      {hasPautas ? (
        <>
          {/* A MESA — a tela é o deck, entre a stories row e a tab bar. Sem
              palco: o card senta direto na página, com a própria elevação.
              flex:1 + minHeight:0 = preenche o espaço real que sobra (não uma
              altura fixa) — minHeight:0 é o que permite o filho ENCOLHER
              abaixo do tamanho do conteúdo quando o espaço aperta, em vez de
              estourar o container pai. */}
          {showDeckArea ? (
            <div style={{ padding: "16px 20px 8px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              {pautaCollabsLoading && deckItems.length === 0 ? (
                <StackSkeleton />
              ) : (
                <DiagnosticoCollabStack
                  items={deckItems}
                  isPro={isPro}
                  shelfCount={shelfPautas.length}
                  onDecide={handleDeckDecision}
                  onOpenIdea={onOpenIdea}
                  onUpgrade={() => onUpgrade?.("narrative_map")}
                />
              )}
            </div>
          ) : null}

          {/* "Gerar" só aparece quando o deck acabou — na mesa cheia, o jogo
              é o único foco. */}
          {deckItems.length === 0 && !pautaCollabsLoading ? (
            <div style={{ padding: "10px 18px 0", display: "flex", justifyContent: "center" }}>
              <GenerateButton
                isPro={isPro}
                isGeneratingIdeas={isGeneratingIdeas}
                onGenerate={onGenerate}
                onUpgrade={onUpgrade}
                label="Gerar novas pautas →"
              />
            </div>
          ) : null}
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
              borderRadius: 999, padding: "11px 20px", background: TEXT_PRIMARY_HEX, color: "#fff",
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
          matchedByPauta={matchedByPauta}
          awaitingByPauta={awaitingByPauta}
          onOpenIdea={(id) => {
            setOpenSheet(null);
            onOpenIdea?.(id);
          }}
          onToggleSave={onToggleSave}
          onClose={() => setOpenSheet(null)}
        />
      ) : null}
    </div>
  );
}
