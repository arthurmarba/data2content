"use client";

// Deck da aba Collabs — a tela inteira é UMA experiência de swipe.
//
// Três tipos de card, mesmo gesto:
//   "pauta"   — a ideia solo. Direita = quero gravar (salva, vai pra estante);
//               esquerda = não é pra mim (efêmera — a geração seguinte repõe).
//   "collab"  — o PRÊMIO: pauta + criador compatível, surge no meio do deck.
//               Direita = quero fazer; esquerda = não agora (silencioso — o
//               outro lado nunca sabe; a pauta volta ao fim do deck como card
//               solo: recusar o parceiro não custa a ideia).
//   "mystery" — versão free do prêmio: silhueta borrada; cadeado abre paywall.
//
// Toque sem arrastar abre a ficha completa (DiagnosticoIdeaDetailSheet).
//
// Guardrails de produto (decisão travada — ver docs/brief-collabs-gamificada-fable.md):
//   - deck FINITO: as pautas da geração acabam e aparece "zerada por hoje".
//     Sem refill infinito — a diferença entre ritual e caça-níquel.
//   - a collab só entra no deck quando o match é real (raridade honesta)
//   - sem ranking, sem streak; o "N de M" é ritual pessoal
//   - positivo é "quero", nunca "curtir"

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";
import { resolveContentIdeaScriptBlueprint } from "@/app/dashboard/boards/videoUpload/contentIdeaBlueprint";
import { simplifyUserFacingText } from "@/app/dashboard/boards/videoUpload/contentIdeaOpportunity";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  CS_BRAND_HEX,
  CS_INK_HEX,
  CS_MUTED,
  CS_NEUTRAL_HEX,
  CS_PAPER_HEX,
  CS_FONT_DISPLAY,
  CS_DISPLAY_TRACKING_CARD,
} from "./diagnosticoTokens";

export type CollabStackDecision = "interested" | "dismissed";

export type CollabStackCardKind = "pauta" | "collab" | "mystery";

export interface CollabStackItem {
  kind: CollabStackCardKind;
  pauta: ContentIdeaListItem;
  /** Presente só em kind="collab" — o criador do outro lado. */
  collab: NarrativeCollabMatch | null;
}

function stackItemIdentity(item: CollabStackItem | null) {
  if (!item) return "empty";
  const partnerId = item.kind === "collab" ? item.collab?.id ?? "missing" : "none";
  return `${item.kind}:${item.pauta.id}:${partnerId}`;
}

// Acento do prêmio (collab) = brand creator-studio; tintas derivadas do rosa.
const COLLAB_ACCENT = CS_BRAND_HEX;
const CARD_BG = "var(--ds-color-surface)";
// Carimbo, não profundidade — a mesma assinatura do Perfil. Ver `.ds-card-stamp`.
const STACK_CARD_SHADOW = "2px 2px 0 rgba(18, 16, 20, 0.08)";
/** Deslocamento (px) a partir do qual soltar o card confirma a decisão. */
const SWIPE_CONFIRM_PX = 96;
const SWIPE_CONFIRM_VELOCITY = 600;
/**
 * Teto da experiência completa: progresso, face do flashcard e decisões. A
 * face usa o espaço restante e preserva o mesmo respiro no mobile e desktop.
 */
// O deck ocupa a altura que sobrar: cabeçalho e decisão ficam fixos e a IDEIA
// usa o resto. Com 480px o card virava um retângulo no meio de uma tela vazia.
const CARD_MAX_HEIGHT = 680;
// Dois botões de 52px + respiro. Eles são retangulares e ficam FORA do card:
// no mockup a decisão é mobília fixa da tela, e o card é que voa.
const DECISION_ZONE_HEIGHT = 72;

// ─── Ícones (stroke style do app) ─────────────────────────────────────────────

export function MysteryAvatar({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 9999, flexShrink: 0, position: "relative",
        overflow: "hidden", background: "var(--ds-color-brand-soft)",
        display: "grid", placeItems: "center",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ filter: "blur(1.5px)", opacity: 0.55 }}>
        <circle cx="20" cy="15" r="7" fill={COLLAB_ACCENT} />
        <path d="M6 36c0-7.7 6.3-13 14-13s14 5.3 14 13z" fill={COLLAB_ACCENT} />
      </svg>
      <span
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          fontSize: size * 0.42, fontWeight: 800, color: "var(--ds-color-on-brand)",
        }}
      >
        ?
      </span>
    </div>
  );
}

// ─── Stamp de decisão (aparece conforme o arrasto) ────────────────────────────

function DecisionStamp({
  label,
  side,
  opacity,
  scale,
}: {
  label: string;
  side: "left" | "right";
  opacity: ReturnType<typeof useTransform<number, number>>;
  /** Cresce junto com o arrasto — o carimbo "assenta" em vez de só aparecer. */
  scale?: ReturnType<typeof useTransform<number, number>>;
}) {
  const positive = side === "left"; // stamp à esquerda = arrasto pra direita = positivo
  return (
    <motion.span
      style={{
        position: "absolute",
        top: 12,
        [side]: 14,
        opacity,
        scale,
        rotate: positive ? -9 : 9,
        pointerEvents: "none",
        zIndex: 2,
        display: "inline-block",
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        background: positive ? CS_INK_HEX : "var(--ds-color-neutral)",
        color: positive ? "var(--ds-color-on-brand)" : TEXT_SECONDARY_HEX,
        border: positive ? "none" : "1.5px solid var(--ds-color-line)",
        boxShadow: "none",
      }}
    >
      {label}
    </motion.span>
  );
}

// ─── Conteúdo do card (por tipo) ──────────────────────────────────────────────
//
// Cartão didático: a FRENTE é mínima — decide-se de relance. O detalhe (gancho,
// por que combina, como gravar juntos, roteiro) mora no "verso": tocar o corpo
// vira o cartão e abre a tela de detalhe (ficha) com × pra voltar.

function flashcardTitleFontSize(title: string, kind: CollabStackCardKind): string {
  const length = title.trim().length;
  if (length > 88) return "clamp(23px, min(7vw, 3.7dvh), 30px)";
  if (length > 58) return "clamp(25px, min(7.8vw, 4.15dvh), 33px)";
  return kind === "pauta"
    ? "clamp(28px, min(8.8vw, 4.8dvh), 38px)"
    : "clamp(27px, min(8.2vw, 4.45dvh), 35px)";
}

function FlashcardTitle({ title, kind }: { title: string; kind: CollabStackCardKind }) {
  return (
    <p
      className="d2c-flashcard-title"
      data-max-lines="4"
      style={{
        width: "100%", maxWidth: "100%",
        fontSize: flashcardTitleFontSize(title, kind),
        fontFamily: CS_FONT_DISPLAY,
        fontWeight: 680, color: CS_INK_HEX, letterSpacing: CS_DISPLAY_TRACKING_CARD,
        lineHeight: 1.055, margin: 0, textAlign: "center", textWrap: "balance",
        overflowWrap: "normal", wordBreak: "normal", hyphens: "none",
        display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}
    >
      {title}
    </p>
  );
}

function CollabIdentityHeader({
  kind,
  collab,
}: {
  kind: "collab" | "mystery";
  collab: NarrativeCollabMatch | null;
}) {
  const initials = (collab?.name || "?").trim().slice(0, 1).toUpperCase();
  const isRealCollab = kind === "collab" && collab != null;

  return (
    <div
      data-testid="collab-identity-header"
      className="d2c-collab-identity"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        paddingBottom: "clamp(12px, 1.8dvh, 16px)",
        borderBottom: "1px solid var(--ds-color-line)",
      }}
    >
      {isRealCollab ? (
        <div
          className="d2c-collab-identity-avatar"
          style={{
            width: "clamp(62px, 9.5dvh, 68px)", height: "clamp(62px, 9.5dvh, 68px)",
            borderRadius: 9999, flexShrink: 0, overflow: "hidden", position: "relative",
            background: CS_INK_HEX, color: "var(--ds-color-on-brand)", display: "grid", placeItems: "center",
            fontSize: "clamp(18px, 2.6dvh, 22px)", fontWeight: 700,
            boxShadow: `0 0 0 2px ${CS_PAPER_HEX}, 0 0 0 3.5px ${CS_BRAND_HEX}`,
          }}
        >
          <StableCreatorAvatar
            name={collab.name}
            avatarUrl={collab.avatarUrl}
            creatorId={collab.id}
            mediaKitSlug={collab.mediaKitSlug}
            fallbackText={initials}
          />
        </div>
      ) : (
        <div className="d2c-collab-identity-avatar" style={{ width: 62, height: 62, flexShrink: 0 }}>
          <MysteryAvatar size={62} />
        </div>
      )}

      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <span style={{ display: "block", color: TEXT_SECONDARY_HEX, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.84, textTransform: "uppercase" }}>
          {isRealCollab ? "Collab sugerida" : "Collab disponível"}
        </span>
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 4, color: CS_INK_HEX, fontSize: "clamp(17px, 2.5dvh, 20px)", fontWeight: 760, lineHeight: 1.12, letterSpacing: -0.3 }}>
          {isRealCollab ? `Com ${collab.name}` : "Há uma pessoa indicada"}
        </span>
        {!isRealCollab ? (
          <span style={{ display: "block", marginTop: 3, color: TEXT_SECONDARY_HEX, fontSize: 11.5, fontWeight: 600 }}>
            Disponível no Pro
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FlipIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 10a7.5 7.5 0 1 1 1.6 6.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M4.5 4.8V10h5.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlipHint({ label, onFlip, active = true }: { label: string; onFlip: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      tabIndex={active ? 0 : -1}
      aria-label={label}
      onPointerDownCapture={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onFlip();
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        minHeight: 36, padding: "0 8px", border: 0, background: "transparent",
        cursor: "pointer", fontFamily: "inherit",
        fontSize: 12, fontWeight: 700, color: TEXT_SECONDARY_HEX,
      }}
    >
      <span>{label}</span>
      <FlipIcon />
    </button>
  );
}

// Chip de meta — território/formato. Mesma peça na frente do card e na mochila.
// maxWidth:100% (não um px fixo): o território é o dado mais importante do
// chip — territórios reais como "Cultura pop como negócio" truncavam num teto
// de 160px mesmo sobrando espaço na linha (o chip corria sozinho depois que o
// formato secundário saiu da meta row). Ainda é uma linha só (nowrap) com
// ellipsis como rede de segurança pra territórios excepcionalmente longos.
export function MetaChip({ label, tone = "violet" }: { label: string; tone?: "violet" | "amber" }) {
  // "violet" é o tom default histórico — hoje renderiza o neutro creator-studio.
  const palette = tone === "violet"
    ? { bg: CS_NEUTRAL_HEX, color: CS_INK_HEX }
    : { bg: "var(--ds-color-warning-soft)", color: "var(--ds-color-warning)" };
  return (
    <span style={{
      display: "inline-block", maxWidth: "100%", fontSize: 11, fontWeight: 600,
      color: palette.color, background: palette.bg, borderRadius: 999, padding: "3px 10px",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function conciseCardText(value: string | null | undefined, max = 105): string | null {
  const clean = simplifyUserFacingText(value, Math.max(max + 15, 120));
  if (!clean) return null;
  const firstSentence = clean.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean;
  const concise = simplifyUserFacingText(firstSentence, max);
  if (!concise) return null;
  return concise.charAt(0).toLocaleUpperCase("pt-BR") + concise.slice(1);
}

function formatCardFormat(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  if (normalized === "reels" || normalized === "reel") return "Reel";
  return value.trim();
}

function executionSummary(item: CollabStackItem): string {
  const blueprint = resolveContentIdeaScriptBlueprint(item.pauta.scriptBlueprint, item.pauta);
  const format = item.kind === "collab" && item.collab?.collabBlueprint?.format
    ? item.collab.collabBlueprint.format
    : item.pauta.suggestedFormat;
  const parts = [
    item.kind === "collab" && item.collab?.collabMode
      ? item.collab.collabMode === "presencial" ? "Presencial" : "À distância"
      : null,
    formatCardFormat(format),
    blueprint.estimatedDurationSeconds ? `${blueprint.estimatedDurationSeconds}s` : null,
    // O melhor horário fica de fora: na frente do card a pílula precisa caber
    // em UMA linha, e "quinta à noite" é decisão do dia de postar, não do
    // "eu gravo isso?" que se responde aqui.
  ].filter((value): value is string => Boolean(value));
  return parts.join(" · ");
}

function FlashcardFront({
  item,
  onFlip,
  active = true,
}: {
  item: CollabStackItem;
  onFlip: () => void;
  active?: boolean;
}) {
  const { kind, pauta, collab } = item;
  const title = cleanIdeaText(pauta.title);
  const metaChips = [pauta.territory, executionSummary(item)]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  const flipLabel = kind === "collab"
    ? "Ver por que combina"
    : kind === "mystery" ? "Ver indicação" : "Ver como gravar";

  return (
    <div
      data-testid="collab-flashcard-front"
      className="d2c-flashcard-front"
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "clamp(14px, 2.2dvh, 22px) 22px 10px" }}
    >
      {/* Só a parceria ganha cabeçalho. A ideia solo não precisa de etiqueta
          dizendo que é uma ideia: o título grande sozinho já é o card, e é o
          CONTRASTE com o cabeçalho da collab que diz qual é qual. */}
      {kind !== "pauta" ? <CollabIdentityHeader kind={kind} collab={collab} /> : null}

      <div
        className="d2c-flashcard-title-zone"
        style={{
          flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "clamp(10px, 1.6dvh, 18px)",
          padding: "clamp(12px, 2.1dvh, 22px) 0 8px",
        }}
      >
        <FlashcardTitle title={title} kind={kind} />
        {/* Território e formato na FRENTE: são o que decide se a pessoa topa
            antes de virar o card — "eu gravo isso?" depende de saber que é um
            reel de 40s de rotina, não só do assunto. */}
        {metaChips.length > 0 ? (
          <div style={{ flex: "none", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 7, overflow: "hidden" }}>
            {metaChips.map((chip) => (
              <span
                key={chip}
                style={{
                  border: "1px solid var(--ds-color-line-strong)", borderRadius: 999,
                  padding: "6px 12px", fontSize: 11.5, fontWeight: 500, lineHeight: 1.2,
                  color: TEXT_SECONDARY_HEX,
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <FlipHint label={flipLabel} onFlip={onFlip} active={active} />
    </div>
  );
}

function BackSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ minWidth: 0 }}>
      <span style={{ display: "block", color: TEXT_SECONDARY_HEX, fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function FlashcardBack({
  item,
  onFlip,
  onOpenIdea,
  active = true,
}: {
  item: CollabStackItem;
  onFlip: () => void;
  onOpenIdea?: () => void;
  active?: boolean;
}) {
  const { kind, pauta, collab } = item;
  const title = cleanIdeaText(pauta.title);
  const firstName = collab?.name.trim().split(" ")[0] || "essa pessoa";
  const reason = conciseCardText(
    collab?.narrativeFitReason ?? pauta.opportunityBrief?.collabReason,
    120,
  );
  const viewerContribution = conciseCardText(collab?.viewerContribution, 92)
    ?? conciseCardText(`Sua experiência com ${pauta.territory}`, 92);
  const partnerContribution = conciseCardText(collab?.partnerContribution, 92)
    ?? reason;
  const hook = conciseCardText(pauta.hook, 150);
  const whyNow = conciseCardText(
    pauta.opportunityBrief?.whyNow ?? pauta.resonanceNote ?? pauta.whyItFits,
    115,
  );
  const meta = executionSummary(item);

  return (
    <div
      data-testid="collab-flashcard-back"
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", padding: "clamp(14px, 2.2dvh, 22px) 22px 14px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ color: TEXT_SECONDARY_HEX, fontSize: 10.5, fontWeight: 600, letterSpacing: 0.84, textTransform: "uppercase" }}>
          {kind === "collab" ? `Por que ${firstName}` : "Como gravar"}
        </span>
        <FlipHint label="Voltar para a ideia" onFlip={onFlip} active={active} />
      </div>

      <p className="d2c-flashcard-back-title" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: "2px 0 12px", fontFamily: CS_FONT_DISPLAY, color: CS_INK_HEX, fontSize: 17, fontWeight: 700, lineHeight: 1.15, letterSpacing: -0.35 }}>
        {title}
      </p>

      {kind === "collab" && collab ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(9px, 1.5dvh, 14px)" }}>
          {reason ? (
            <p className="d2c-flashcard-back-reason" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0, color: TEXT_PRIMARY_HEX, fontSize: 14, fontWeight: 650, lineHeight: 1.35 }}>
              {reason}
            </p>
          ) : null}
          <div className="d2c-flashcard-contributions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, paddingTop: 10, borderTop: "1px solid var(--ds-color-line)" }}>
            <BackSection label="Você entra com" className="d2c-flashcard-contribution">
              <p style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0, color: TEXT_SECONDARY_HEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.34 }}>
                {viewerContribution}
              </p>
            </BackSection>
            <BackSection label={`${firstName} entra com`} className="d2c-flashcard-contribution">
              <p style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0, color: TEXT_SECONDARY_HEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.34 }}>
                {partnerContribution}
              </p>
            </BackSection>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(10px, 1.7dvh, 16px)" }}>
          {hook ? (
            <BackSection label="Comece assim">
              <p style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0, color: CS_INK_HEX, fontSize: 15, fontWeight: 680, lineHeight: 1.35 }}>
                “{hook}”
              </p>
            </BackSection>
          ) : null}
          {whyNow ? (
            <BackSection label="Por que funciona">
              <p className="d2c-flashcard-back-reason" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0, color: TEXT_SECONDARY_HEX, fontSize: 12.5, fontWeight: 600, lineHeight: 1.34 }}>
                {whyNow}
              </p>
            </BackSection>
          ) : null}
        </div>
      )}

      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        {meta ? (
          <p style={{ margin: 0, color: CS_MUTED, fontSize: 11.5, fontWeight: 650, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </p>
        ) : null}
        {onOpenIdea ? (
          <button
            type="button"
            tabIndex={active ? 0 : -1}
            aria-label="Abrir plano completo da ideia"
            onPointerDownCapture={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onOpenIdea();
            }}
            style={{
              width: "100%", minHeight: 44, marginTop: 10, borderRadius: 12,
              border: "1px solid var(--ds-color-line-strong)", background: "var(--ds-color-surface)",
              color: CS_INK_HEX, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}
          >
            Abrir plano completo
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── A pilha ──────────────────────────────────────────────────────────────────
//
// O motion value `x` vive AQUI (dono único), compartilhado pelo arrasto do card
// e pelos botões. A saída é sempre imperativa (`animate(x, …)`) — nunca via prop
// `animate` no style, que o motion value ignoraria. Isso conserta o botão, que
// antes não movia o card (o `style={{x}}` tinha precedência sobre `animate`).

export function DiagnosticoCollabStack({
  items,
  isPro,
  shelfCount,
  clearedActions,
  onDecide,
  onOpenIdea,
  onUpgrade,
}: {
  items: CollabStackItem[];
  isPro: boolean;
  /** Itens na mochila — vira a recompensa do estado "rodada triada". */
  shelfCount?: number;
  /** Duas continuações do ritual, tratadas como uma única composição. */
  clearedActions?: ReactNode;
  onDecide: (pautaId: string, decision: CollabStackDecision) => void;
  onOpenIdea?: (pautaId: string) => void;
  onUpgrade?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  // Total da "rodada" desta visita — pro ritual do "N de M" e o estado zerado.
  const roundTotalRef = useRef(items.length);
  if (items.length > roundTotalRef.current) roundTotalRef.current = items.length;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-11, 11]);
  const wantOpacity = useTransform(x, [32, SWIPE_CONFIRM_PX], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_CONFIRM_PX, -32], [1, 0]);
  const wantScale = useTransform(x, [32, SWIPE_CONFIRM_PX], [0.85, 1]);
  const skipScale = useTransform(x, [-SWIPE_CONFIRM_PX, -32], [1, 0.85]);
  // Trava por card: impede decisão dupla (arrasto + botão) no mesmo topo.
  const decidingRef = useRef(false);

  const top = items[0] ?? null;
  const behind = items.slice(1, 3);
  // Deck vazio SEMPRE mostra a recompensa + próximo passo — nunca branco. Antes
  // exigia roundTotal>0 ("triou nesta sessão"): num mount fresco com 0 cartões
  // (todas as pautas já decididas, ou a geração falhou), roundTotal era 0 →
  // cleared false → caía no `return null` e a tela ficava TOTALMENTE EM BRANCO,
  // sem recompensa nem botão de gerar. `triaged` só decide a COPY, não se mostra.
  const emptyDeck = items.length === 0;
  const triaged = roundTotalRef.current > 0;

  // y/scale são motion values (não props animate) — a saída em arco pra
  // mochila anima x+y+scale juntos, e motion value no style ignoraria a prop.
  const yMv = useMotionValue(0);
  const scaleMv = useMotionValue(1);
  const opacityMv = useMotionValue(1);

  // Controles das animações ativas (x/y/scale) — precisam ser PARADOS
  // explicitamente antes de qualquer `.set()` de reset. Sem isso: o commit()
  // dispara no onComplete da OPACIDADE (tween de duração fixa, 420ms), mas
  // x/y/scale são SPRINGS sem duração fixa — se a física ainda não convergiu
  // quando a opacidade termina, a spring antiga segue rodando e sobrescreve o
  // `.set(0)` do reset no frame seguinte: o card "trava" a meio caminho, preso
  // entre o valor resetado e o alvo da spring que não foi cancelada.
  const activeAnimsRef = useRef<Array<{ stop: () => void }>>([]);
  const stopActiveAnims = () => {
    for (const anim of activeAnimsRef.current) anim.stop();
    activeAnimsRef.current = [];
  };

  // Cada topo novo entra com x zerado, desvirado e destravado — a entrada
  // (sobe do baralho) também roda aqui, nos mesmos motion values.
  const topIdentity = stackItemIdentity(top);
  useEffect(() => {
    stopActiveAnims();
    decidingRef.current = false;
    setFlipped(false);
    x.set(0);
    opacityMv.set(1);
    if (reduceMotion) {
      yMv.set(0);
      scaleMv.set(1);
      return;
    }
    yMv.set(8);
    scaleMv.set(0.965);
    activeAnimsRef.current.push(
      animate(yMv, 0, { type: "spring", stiffness: 300, damping: 26 }),
      animate(scaleMv, 1, { type: "spring", stiffness: 300, damping: 26 }),
    );
  }, [topIdentity, x, yMv, scaleMv, opacityMv, reduceMotion]);

  const openDetail = (pautaId: string) => {
    if (decidingRef.current) return;
    onOpenIdea?.(pautaId);
  };

  const commit = (pautaId: string, direction: 1 | -1) => {
    setCompletedCount((current) => current + 1);
    onDecide(pautaId, direction === 1 ? "interested" : "dismissed");
  };

  // Saída do card — e só então registra a decisão (o próximo topo aparece
  // depois do card sair de cena, sem "pulo").
  //   aceitar (+1): voa em ARCO pra mochila (o 🔖 no topo-direito do header) —
  //   encolhendo e sumindo na direção dela. Coleta física, não item de lista.
  //   recusar (−1): desliza pra esquerda e some.
  const flyOut = (pautaId: string, direction: 1 | -1) => {
    // Trava IMEDIATA, no clique/soltura — não no fim da animação. Sem isso, um
    // segundo clique (ou o outro botão) durante os ~300–600ms de voo passava
    // reto pela trava e disparava um SEGUNDO animate() nos mesmos motion values
    // já em voo — as duas animações competindo é o card "travando no meio do
    // caminho" que aparecia no preview.
    if (decidingRef.current) return;
    decidingRef.current = true;
    if (reduceMotion) {
      commit(pautaId, direction);
      return;
    }
    if (direction === 1) {
      const spring = { type: "spring" as const, stiffness: 200, damping: 26 };
      // Registra os 4 controles — o reset do próximo card os para explicitamente
      // antes de zerar (ver activeAnimsRef acima). A opacidade (tween, duração
      // fixa) é quem decide QUANDO a decisão é commitada; x/y/scale (springs)
      // são apenas visuais e podem ser interrompidas com segurança se ainda
      // estiverem em voo quando o commit acontecer.
      activeAnimsRef.current.push(
        animate(x, 260, spring),
        animate(yMv, -440, spring),
        animate(scaleMv, 0.25, spring),
        animate(opacityMv, 0, {
          duration: 0.42,
          ease: "easeIn",
          onComplete: () => commit(pautaId, 1),
        }),
      );
      return;
    }
    activeAnimsRef.current.push(
      animate(x, -520, {
        type: "spring",
        stiffness: 260,
        damping: 30,
        onComplete: () => commit(pautaId, -1),
      }),
    );
  };

  const pressButton = (direction: 1 | -1) => {
    if (!top || decidingRef.current) return;
    // A decisão positiva só sai de cena quando ela pode ser concluída. Antes,
    // o Free animava o card para fora e só depois abria o paywall; como nenhum
    // estado era persistido, o mesmo topo ficava invisível e travado ao voltar.
    if (direction === 1 && (!isPro || top.kind === "mystery")) {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
      onUpgrade?.();
      return;
    }
    flyOut(top.pauta.id, direction);
  };

  const toggleFace = () => {
    if (!top || decidingRef.current) return;
    if (top.kind === "mystery") {
      onUpgrade?.();
      return;
    }
    setFlipped((current) => !current);
  };

  if (emptyDeck) {
    // Deck sem cartões = um único encerramento, sem card dentro de card.
    const shelfMsg = typeof shelfCount === "number" && shelfCount > 0
      ? `${shelfCount} ${shelfCount === 1 ? "ideia salva" : "ideias salvas"} nesta rodada.`
      : "As próximas ideias usarão os assuntos do seu Mapa.";
    return (
      <div style={{ flex: "1 1 auto", width: "100%", maxWidth: 520, minHeight: 0, maxHeight: CARD_MAX_HEIGHT, margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "16px 8px 12px", textAlign: "center" }}>
        <p style={{ fontSize: 10.5, fontWeight: 600, color: TEXT_SECONDARY_HEX, margin: 0, letterSpacing: 0.84, textTransform: "uppercase" }}>
          {triaged ? "Rodada concluída" : "Sem ideias disponíveis"}
        </p>
        <p style={{ fontFamily: CS_FONT_DISPLAY, fontSize: 24, lineHeight: 1.06, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: "8px 0 0", letterSpacing: -0.8 }}>
          Quer ver novas ideias?
        </p>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, lineHeight: 1.45, margin: "7px 0 0" }}>
          {shelfMsg}
        </p>
        {clearedActions ? <div style={{ width: "100%", maxWidth: 330, marginTop: 20 }}>{clearedActions}</div> : null}
      </div>
    );
  }

  if (!top) return null;

  // Copy dos stamps/botões acompanha o tipo do card do topo — mesmo gesto,
  // stakes diferentes: salvar uma ideia ≠ topar gravar com uma pessoa.
  const isCollabTop = top.kind === "collab";
  const isMysteryTop = top.kind === "mystery";
  const topTitle = cleanIdeaText(top.pauta.title);
  const firstName = top.collab?.name.trim().split(" ")[0] || "essa pessoa";
  // O botão diz a DECISÃO em primeira pessoa, não o nome da operação: "Quero
  // fazer" é o que a pessoa está dizendo; "salvar ideia" é o que o sistema faz
  // depois. O card do topo decide a aposta — topar uma pessoa não é o mesmo
  // que guardar uma ideia.
  const positiveLabel = isCollabTop ? "Quero fazer" : isMysteryTop ? "Ver no Pro" : "Quero gravar";
  const negativeLabel = "Não é pra mim";
  const progressCurrent = completedCount + 1;
  const progressTotal = completedCount + items.length;
  // Borda igual nos dois tipos. A parceria já se anuncia pela foto e pelo
  // cabeçalho; tingir a moldura de rosa fazia a tela ter dois sinais dizendo a
  // mesma coisa — e o rosa deixava de significar ação.
  const cardBorder = "1px solid var(--ds-color-line)";

  return (
    <div style={{ flex: "1 1 auto", width: "100%", maxWidth: 520, minHeight: 0, maxHeight: CARD_MAX_HEIGHT, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <style jsx global>{`
        @media (max-height: 610px) {
          .d2c-flashcard-front {
            padding-top: 12px !important;
            padding-bottom: 8px !important;
          }
          .d2c-collab-identity {
            gap: 12px !important;
            padding-bottom: 9px !important;
          }
          .d2c-collab-identity-avatar {
            width: 52px !important;
            height: 52px !important;
          }
          .d2c-collab-identity-avatar > div {
            width: 52px !important;
            height: 52px !important;
          }
          .d2c-flashcard-title-zone {
            padding-top: 8px !important;
            padding-bottom: 4px !important;
          }
          .d2c-flashcard-back-title {
            display: none !important;
          }
          .d2c-flashcard-back-reason,
          .d2c-flashcard-contribution p {
            -webkit-line-clamp: 1 !important;
          }
          .d2c-flashcard-contributions {
            gap: 10px !important;
            padding-top: 7px !important;
          }
        }
      `}</style>
      <div
        aria-live="polite"
        style={{ height: 20, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_SECONDARY_HEX, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.15 }}
      >
        {progressCurrent} de {progressTotal}
      </div>

      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0 }}>
        {behind.map((item, i) => (
          <motion.div
            key={stackItemIdentity(item)}
            data-stack-card-id={stackItemIdentity(item)}
            data-stack-position={i + 1}
            aria-hidden="true"
            initial={false}
            // Baralho, não leque: as cartas de trás recuam pelos QUATRO lados e
            // descem, sem rotação. O leque inclinado sugeria que dava para
            // escolher qual carta puxar — e não dá; o deck é uma fila.
            animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
            style={{
              position: "absolute",
              top: (i + 1) * 12,
              left: (i + 1) * 12,
              right: (i + 1) * 12,
              bottom: 0,
              borderRadius: 22,
              // A segunda carta é neutra: duas brancas idênticas empilhadas
              // leem como uma borda dupla, não como duas cartas.
              background: i === 0 ? CARD_BG : CS_NEUTRAL_HEX,
              border: "1px solid var(--ds-color-line)",
              zIndex: 2 - i,
              overflow: "hidden",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* A carta logo atrás mostra o PRÓXIMO conteúdo; a terceira fica
                vazia, só volume. Enquanto o topo voa para fora (~400ms) é ela
                que está sob o olho — vazia, a tela piscava em branco no meio de
                cada decisão. */}
            {i === 0 ? <FlashcardFront item={item} onFlip={() => {}} active={false} /> : null}
          </motion.div>
        ))}

        <motion.div
          key={topIdentity}
          data-stack-card-id={topIdentity}
          data-stack-position="0"
          role="group"
          aria-label={`${isCollabTop ? "Parceria recomendada" : isMysteryTop ? "Sugestão em parceria" : "Ideia"}: ${topTitle}. ${flipped ? "Detalhes visíveis" : "Frente visível"}`}
          tabIndex={0}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.9}
          style={{
            x,
            y: yMv,
            scale: scaleMv,
            opacity: opacityMv,
            rotate: reduceMotion ? 0 : rotate,
            position: "absolute",
            inset: 0,
            cursor: "grab",
            touchAction: "pan-y",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
          }}
          whileTap={{ cursor: "grabbing" }}
          onTap={toggleFace}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            toggleFace();
          }}
          onDragEnd={(_, info) => {
            if (decidingRef.current) return;
            const power = info.offset.x + info.velocity.x * 0.15;
            if (info.offset.x > SWIPE_CONFIRM_PX || power > SWIPE_CONFIRM_VELOCITY) {
              pressButton(1);
            } else if (info.offset.x < -SWIPE_CONFIRM_PX || power < -SWIPE_CONFIRM_VELOCITY) {
              pressButton(-1);
            } else {
              // Abaixo do limiar — volta pro centro.
              animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
            }
          }}
        >
          <div style={{ position: "relative", height: "100%", minHeight: 0, perspective: 1100 }}>
            <DecisionStamp label={positiveLabel} side="left" opacity={wantOpacity} scale={wantScale} />
            <DecisionStamp label={negativeLabel} side="right" opacity={skipOpacity} scale={skipScale} />

            {reduceMotion ? (
              <div style={{ position: "absolute", inset: 0, borderRadius: 22, background: CARD_BG, border: cardBorder, boxShadow: STACK_CARD_SHADOW, overflow: "hidden" }}>
                {flipped ? (
                  <FlashcardBack
                    item={top}
                    onFlip={toggleFace}
                    onOpenIdea={onOpenIdea ? () => openDetail(top.pauta.id) : undefined}
                  />
                ) : (
                  <FlashcardFront item={top} onFlip={toggleFace} />
                )}
              </div>
            ) : (
              <motion.div
                initial={false}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}
              >
                <div
                  aria-hidden={flipped}
                  style={{
                    position: "absolute", inset: 0, borderRadius: 22, background: CARD_BG,
                    border: cardBorder, boxShadow: STACK_CARD_SHADOW, overflow: "hidden",
                    backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    pointerEvents: flipped ? "none" : "auto",
                  }}
                >
                  <FlashcardFront item={top} onFlip={toggleFace} active={!flipped} />
                </div>
                <div
                  aria-hidden={!flipped}
                  style={{
                    position: "absolute", inset: 0, borderRadius: 22, background: CARD_BG,
                    border: cardBorder, boxShadow: STACK_CARD_SHADOW, overflow: "hidden",
                    backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none",
                  }}
                >
                  <FlashcardBack
                    item={top}
                    onFlip={toggleFace}
                    onOpenIdea={onOpenIdea ? () => openDetail(top.pauta.id) : undefined}
                    active={flipped}
                  />
                </div>
              </motion.div>
            )}
          </div>

        </motion.div>
      </div>

      {/* A decisão é mobília FIXA da tela, não parte do card: no gesto antigo os
          botões voavam junto com a carta que estava saindo, o que fazia o alvo
          fugir do dedo no meio do toque. Fixos, o card sai e a próxima decisão
          já está sob o polegar.

          A proporção 1fr/1.4fr não é estética: o "quero" é o movimento que o
          produto existe para provocar, e um par de botões idênticos obriga a
          ler os dois para escolher. */}
      <div
        style={{
          flex: "none", height: DECISION_ZONE_HEIGHT,
          display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10,
          alignItems: "center", padding: "10px 0 4px",
        }}
      >
        <button
          type="button"
          onClick={() => pressButton(-1)}
          aria-label={isCollabTop ? "Agora não quero esta parceria" : "Descartar ideia"}
          style={{
            minHeight: 52, borderRadius: 14, background: "var(--ds-color-surface)",
            border: "1px solid var(--ds-color-line-strong)", color: TEXT_SECONDARY_HEX,
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {negativeLabel}
        </button>
        <button
          type="button"
          onClick={() => pressButton(1)}
          aria-label={isCollabTop ? `Quero gravar com ${firstName}` : isMysteryTop ? "Ver sugestão de parceria no Pro" : "Salvar ideia"}
          style={{
            minHeight: 52, borderRadius: 14, background: CS_INK_HEX,
            border: `1px solid ${CS_INK_HEX}`, color: "var(--ds-color-on-brand)",
            fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
            boxShadow: "2px 2px 0 rgba(18, 16, 20, 0.18)",
          }}
        >
          {positiveLabel}
        </button>
      </div>
    </div>
  );
}
