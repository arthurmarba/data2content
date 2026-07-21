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
//   "mystery" — versão free do prêmio: silhueta borrada; coração abre paywall.
//
// Toque sem arrastar abre a ficha completa (DiagnosticoIdeaDetailSheet).
//
// Guardrails de produto (decisão travada — ver docs/brief-collabs-gamificada-fable.md):
//   - deck FINITO: as pautas da geração acabam e aparece "zerada por hoje".
//     Sem refill infinito — a diferença entre ritual e caça-níquel.
//   - a collab só entra no deck quando o match é real (raridade honesta)
//   - sem ranking, sem streak; o "N de M" é ritual pessoal
//   - positivo é "quero", nunca "curtir"

import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";
import {
  contentIdeaMapAnchorLabel,
  resolveContentIdeaMapAnchors,
  selectContentIdeaCardAnchors,
  type ContentIdeaMapAnchorKind,
} from "@/app/dashboard/boards/videoUpload/contentIdeaMapAnchors";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  CS_BRAND_HEX,
  CS_BRAND_STRONG_HEX,
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
const COLLAB_TINT_BG = "#ffeef3";     // fundo de pill/ícone (rosa quase-branco)
// O card senta DIRETO na página (sem palco) — a elevação é a sombra dele.
const CARD_BG = "var(--ds-color-surface)";
const STACK_CARD_SHADOW =
  "0 2px 6px rgba(28,28,30,0.06), 0 16px 36px rgba(28,28,30,0.12), 0 0 0 0.5px rgba(28,28,30,0.04)";
// O prêmio "brilha" em vez de ser emoldurado: elevação COLORIDA, sem borda —
// borda sólida no branco lia como card-dentro-de-card.
const COLLAB_CARD_SHADOW =
  "0 2px 8px rgba(250,22,91,0.10), 0 18px 40px rgba(250,22,91,0.20), 0 0 0 0.5px rgba(250,22,91,0.12)";
/** Deslocamento (px) a partir do qual soltar o card confirma a decisão. */
const SWIPE_CONFIRM_PX = 96;
const SWIPE_CONFIRM_VELOCITY = 600;
/**
 * Teto de altura do card. O conteúdo (StackCardBody) é ANCORADO no topo — sem
 * justifyContent:center interno — então o espaço sobrando cai como respiro
 * normal depois da zona e antes do rodapé, não como vão vazio no meio (isso já
 * foi resolvido na anatomia única do card). Por isso o teto pode ficar
 * generoso: com o header compacto e o deck ancorado no topo, um iPhone padrão
 * (844pt) oferece ~620px entre header e tab bar — 560px deixa o card dominar
 * a tela com uma margem honesta embaixo, sem esticar até a tela inteira.
 * O conteúdo cresce junto (teasers com mais linhas, rodapé maior), então o
 * teto maior não reabre o vão interno. Em telas baixas o flex:1 ainda encolhe
 * abaixo disso — o teto só entra quando SOBRA espaço, nunca quando falta.
 */
const CARD_MAX_HEIGHT = 560;

// ─── Ícones (stroke style do app) ─────────────────────────────────────────────

function XIcon({ size = 20, color = "var(--ds-color-text-muted)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.3l-7.1-6.8a4.6 4.6 0 0 1 0-6.7 5 5 0 0 1 6.9 0l.2.2.2-.2a5 5 0 0 1 6.9 0 4.6 4.6 0 0 1 0 6.7L12 20.3z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        fill={color === "#fff" ? "none" : color}
      />
    </svg>
  );
}

// Silhueta borrada + "?" — mesma linguagem do MysteryAvatar histórico do feed.
export function MysteryAvatar({ size = 38 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 9999, flexShrink: 0, position: "relative",
        overflow: "hidden", background: "linear-gradient(135deg, #ffe4ec 0%, #ffd1de 100%)",
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
          textShadow: "0 1px 2px rgba(216,13,72,0.45)",
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
        background: positive ? COLLAB_ACCENT : "var(--ds-color-neutral)",
        color: positive ? "#fff" : TEXT_SECONDARY_HEX,
        border: positive ? "none" : "1.5px solid var(--ds-color-line)",
        boxShadow: positive ? "0 4px 12px rgba(250,22,91,0.32)" : "none",
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

function CollabPill({ label }: { label: string }) {
  return (
    <span style={{
      alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5,
      borderRadius: 999, padding: "4px 11px", marginBottom: 12,
      background: COLLAB_TINT_BG, color: COLLAB_ACCENT,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8" r="3" stroke={COLLAB_ACCENT} strokeWidth="2.4" />
        <circle cx="16.5" cy="9.5" r="2.4" stroke={COLLAB_ACCENT} strokeWidth="2.4" />
        <path d="M3.5 19c0-2.6 2.3-4.4 5-4.4 1.5 0 2.8.5 3.7 1.3" stroke={COLLAB_ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function PautaEyebrow() {
  return (
    <span style={{
      display: "block", alignSelf: "flex-start", marginBottom: 13, paddingRight: 96,
      color: CS_BRAND_STRONG_HEX, fontSize: 10, fontWeight: 800,
      letterSpacing: 0.72, textTransform: "uppercase",
    }}>
      Pauta para você
    </span>
  );
}

function FlipHint() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute", top: 12, right: 14, zIndex: 1,
        display: "inline-flex", alignItems: "center", gap: 4,
        // TEXT_SECONDARY_HEX (não um cinza custom): ~4.6:1 sobre branco — o hint
        // de flip é a única pista da interação, não pode ficar abaixo do AA.
        fontSize: 10, fontWeight: 700, color: TEXT_SECONDARY_HEX,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      toque pra virar
    </span>
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
    : { bg: "#fff1e6", color: "#b45309" };
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

function MapAnchorIcon({ kind }: { kind: ContentIdeaMapAnchorKind }) {
  if (kind === "subject") {
    return <path d="M5 8.5h10M5 13.5h10M9 4l-2 14M15 4l-2 14" />;
  }
  if (kind === "situation") {
    return <><rect x="4" y="4" width="12" height="12" rx="3" /><path d="M7 8h6M7 12h4" /></>;
  }
  if (kind === "scene") {
    return <><path d="M4 16l4-4 3 3 3-3 2 2" /><circle cx="8" cy="8" r="2" /></>;
  }
  return <><path d="M5 8.5h10M5 12.5h7" /><path d="M7 16.5l-2 2v-4" /></>;
}

function MapAnchorBand({ pauta, reduceMotion }: { pauta: ContentIdeaListItem; reduceMotion: boolean }) {
  const anchors = selectContentIdeaCardAnchors(resolveContentIdeaMapAnchors({
    mapAnchors: pauta.mapAnchors,
    territory: pauta.territory,
    assets: pauta.assets,
    tone: pauta.tone,
  }));
  if (anchors.length === 0) return null;

  return (
    <div style={{ marginTop: 20, paddingTop: 15, borderTop: "1px solid rgba(28,28,30,0.08)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <span style={{
          color: CS_BRAND_STRONG_HEX, fontSize: 10, fontWeight: 800,
          letterSpacing: 0.7, textTransform: "uppercase",
        }}>
          Do seu mapa
        </span>
        {pauta.suggestedFormat ? (
          <span style={{
            minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: CS_MUTED, fontSize: 10.5, fontWeight: 650,
          }}>
            {pauta.suggestedFormat}
          </span>
        ) : null}
      </div>
      <motion.div
        className="d2c-map-anchor-grid"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.045, delayChildren: reduceMotion ? 0 : 0.08 } },
        }}
        style={{
          display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          alignContent: "flex-start", gap: 7, overflow: "hidden",
        }}
      >
        {anchors.map((anchor) => (
          <motion.span
            className="d2c-map-anchor-token"
            key={`${anchor.kind}:${anchor.label}`}
            variants={{
              hidden: { opacity: 0, y: 5, scale: 0.97 },
              visible: { opacity: 1, y: 0, scale: 1 },
            }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 28 }}
            title={`${contentIdeaMapAnchorLabel(anchor.kind)}: ${anchor.label}`}
            style={{
              display: "grid", gridTemplateColumns: "21px minmax(0, 1fr)", alignItems: "center", gap: 7,
              minWidth: 0, borderRadius: 12, padding: "7px 9px 7px 7px",
              background: CS_NEUTRAL_HEX, color: CS_INK_HEX,
              fontSize: 11.25, fontWeight: 650, lineHeight: 1.05,
            }}
          >
            <span style={{
              display: "inline-grid", placeItems: "center", width: 21, height: 21,
              flexShrink: 0, borderRadius: 999, background: "rgba(250,22,91,0.10)", color: CS_BRAND_STRONG_HEX,
            }} aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
                <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <MapAnchorIcon kind={anchor.kind} />
                </g>
              </svg>
            </span>
            <span style={{ display: "block", minWidth: 0 }}>
              <span style={{ display: "block", color: TEXT_SECONDARY_HEX, fontSize: 8.5, fontWeight: 800, letterSpacing: 0.25, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {contentIdeaMapAnchorLabel(anchor.kind)}
              </span>
              <span className="d2c-map-anchor-value" style={{ minWidth: 0, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis" }}>
                {anchor.label}
              </span>
            </span>
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

function StackCardBody({ item }: { item: CollabStackItem }) {
  const { kind, pauta, collab } = item;
  const reduceMotion = useReducedMotion();
  const initials = (collab?.name || "?").trim().slice(0, 1).toUpperCase();
  const title = cleanIdeaText(pauta.title);
  return (
    // Anatomia única: META (chips) → TÍTULO (herói) → ZONA (gancho ou pessoa),
    // todos ANCORADOS no topo, colados como um bloco só (marginTop fixo entre
    // eles, não "auto" — "auto" empurrava a ZONA até grudar no rodapé, abrindo
    // um vão enorme quando o título era curto). O espaço sobrando cai sozinho
    // DEPOIS da zona, antes do rodapé — lugar normal de respiro num card, em vez
    // de um buraco no meio. Antes disso tudo era centralizado, e cada carta do
    // baralho tinha um ritmo diferente conforme o tamanho do título.
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "24px 24px 16px" }}>
      {/* O selo "collab" mantém o padrão visual entre os tipos de card — só
          encurtado (era "collab pra essa pauta"), pra gastar menos altura. O
          chip de TERRITÓRIO some no card de collab: a foto+nome+porquê já
          contextualizam, e território brigava por espaço com o porquê (o
          dado que decide de verdade). Pauta solo e mystery mantêm o território:
          lá ele ainda é o único contexto narrativo disponível. */}
      {kind !== "pauta" ? (
        <CollabPill label={kind === "collab" ? "collab" : "collab escondida"} />
      ) : <PautaEyebrow />}
      <p
        style={{
          // Título domina o card (linguagem flashcard): grande, responsivo à
          // largura E à altura (min(vw, dvh)) — em telas normais/altas o dvh
          // não é o fator limitante e o título fica do mesmo tamanho grande de
          // sempre; só em telas baixas (ex.: iPhone SE, 667px) o dvh entra e
          // encolhe a fonte um pouco, sobrando espaço pro título não cortar
          // no meio da palavra. Sem isso, a fonte só reagia à largura — duas
          // telas da mesma largura mas alturas diferentes ficavam com o MESMO
          // tamanho de fonte, mesmo a mais baixa tendo bem menos espaço vertical.
          fontSize: kind === "pauta"
            ? "clamp(26px, min(10vw, 4.6dvh), 40px)"
            : "clamp(23px, min(8vw, 3.8dvh), 34px)",
          // Bricolage (display creator-studio): peso menor que o 700 do sans
          // porque a grotesca já é "cheia"; tracking de card (-.03em) — o da
          // landing (-.05em) fecha demais abaixo de ~28px.
          fontFamily: CS_FONT_DISPLAY,
          fontWeight: 680, color: CS_INK_HEX, letterSpacing: CS_DISPLAY_TRACKING_CARD,
          lineHeight: 1.08, margin: 0,
          textAlign: "left",
          overflowWrap: "normal",
          wordBreak: "normal",
          hyphens: "none",
          display: "-webkit-box", WebkitLineClamp: kind === "pauta" ? 4 : 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          // Flexbox trata min-height:auto como 0 pra filhos com overflow!=visible
          // (é o caso, por causa do line-clamp) — sem isto, títulos longos em
          // telas baixas eram ESPREMIDOS abaixo da própria altura de 4 linhas
          // pelo flex, cortando no meio de uma linha (feio) em vez de aplicar a
          // reticência limpa do line-clamp. flexShrink:0 protege a altura
          // natural do título; se sobrar aperto, é a zona (gancho) que cede.
          flexShrink: 0,
        }}
      >
        {title}
      </p>

      {kind === "collab" && collab ? (
        // A pessoa continua sendo o prêmio visual da collab; o porquê e o
        // roteiro ficam no detalhe. A frente mostra somente o encontro entre
        // pessoa, ideia e as âncoras do mapa.
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
            <div
              style={{
                // Responsivo à altura como o título — em telas baixas, título
                // longo (3-4 linhas) + avatar + porquê não cabem todos no
                // tamanho cheio de 72px; encolher um pouco o avatar (nunca
                // menos que 56px) devolve o espaço que falta sem cortar texto.
                // O ring duplo (paper + brand) "assenta" a foto no card.
                width: "clamp(56px, 8dvh, 72px)", height: "clamp(56px, 8dvh, 72px)",
                borderRadius: 9999, flexShrink: 0, overflow: "hidden", position: "relative",
                background: CS_INK_HEX, color: "var(--ds-color-on-brand)", display: "grid", placeItems: "center",
                fontSize: "clamp(18px, 2.8dvh, 24px)", fontWeight: 700,
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
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 18, fontWeight: 700, color: CS_INK_HEX, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {collab.name}
              </span>
              {/* Handle + modo de gravação numa linha só — "como seria essa
                  collab" (presencial/remoto) responde-se de relance, sem
                  precisar virar o card (o selo completo continua no verso). */}
              {collab.username || collab.collabMode ? (
                <span style={{ display: "block", fontSize: 12.5, color: CS_MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[collab.username ? `@${collab.username}` : null, collab.collabMode === "presencial" ? "Presencial" : collab.collabMode === "remoto" ? "Remoto" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </div>
          </div>
          <MapAnchorBand pauta={pauta} reduceMotion={!!reduceMotion} />
        </>
      ) : kind === "mystery" ? (
        <>
          <MapAnchorBand pauta={pauta} reduceMotion={!!reduceMotion} />
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 18 }}>
            <MysteryAvatar size={44} />
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY_HEX }}>
                Um criador combina com essa pauta
              </span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLLAB_ACCENT }}>
                Descubra quem no Pro →
              </span>
            </div>
          </div>
        </>
      ) : (
        <MapAnchorBand pauta={pauta} reduceMotion={!!reduceMotion} />
      )}
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

  // Flip do cartão didático: tocar o corpo vira o cartão (rotateY) e, no meio
  // do giro, abre a tela de detalhe (o "verso"). O × de lá desvira de volta.
  const flipY = useMotionValue(0);
  const flippingRef = useRef(false);

  // y/scale são motion values (não props animate) — a saída em arco pra
  // mochila anima x+y+scale juntos, e motion value no style ignoraria a prop.
  const yMv = useMotionValue(0);
  const scaleMv = useMotionValue(1);
  const opacityMv = useMotionValue(1);

  // Controles das animações ativas (x/y/scale/flip) — precisam ser PARADOS
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
    flippingRef.current = false;
    x.set(0);
    flipY.set(0);
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
  }, [topIdentity, x, flipY, yMv, scaleMv, opacityMv, reduceMotion]);

  const flipToDetail = (pautaId: string) => {
    if (decidingRef.current || flippingRef.current) return;
    if (reduceMotion) {
      onOpenIdea?.(pautaId);
      return;
    }
    flippingRef.current = true;
    activeAnimsRef.current.push(
      animate(flipY, 90, {
        duration: 0.18,
        ease: "easeIn",
        onComplete: () => {
          onOpenIdea?.(pautaId);
          // O detalhe cobre a tela; desvira em silêncio pra quando o × fechar.
          setTimeout(() => {
            flipY.set(0);
            flippingRef.current = false;
          }, 350);
        },
      }),
    );
  };

  const commit = (pautaId: string, direction: 1 | -1) => {
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
    // Free: coração no card misterioso é a porta do paywall.
    if (direction === 1 && top.kind === "mystery") {
      onUpgrade?.();
      return;
    }
    flyOut(top.pauta.id, direction);
  };

  if (emptyDeck) {
    // Deck sem cartões = um único encerramento, sem card dentro de card.
    const shelfMsg = typeof shelfCount === "number" && shelfCount > 0
      ? `${shelfCount} ${shelfCount === 1 ? "pauta guardada" : "pautas guardadas"} nesta rodada.`
      : "A próxima rodada nasce do seu mapa.";
    return (
      <div style={{ flex: "1 1 auto", minHeight: 0, maxHeight: CARD_MAX_HEIGHT, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "16px 8px 12px", textAlign: "center" }}>
        <p style={{ fontSize: 10.5, fontWeight: 800, color: CS_BRAND_STRONG_HEX, margin: 0, letterSpacing: 1.15, textTransform: "uppercase" }}>
          {triaged ? "Rodada concluída" : "Sem pautas ativas"}
        </p>
        <p style={{ fontFamily: CS_FONT_DISPLAY, fontSize: 24, lineHeight: 1.06, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: "8px 0 0", letterSpacing: -0.8 }}>
          Pronto para novas pautas?
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
  const isCollabTop = top.kind !== "pauta";
  const topTitle = cleanIdeaText(top.pauta.title);
  const positiveLabel = isCollabTop ? "quero fazer" : "quero gravar";
  // Rejeitar é PERMANENTE (a pauta some de vez) — "não agora" prometia "depois"
  // e seria mentira. "não é pra mim" é honesto pros dois tipos de card.
  const negativeLabel = "não é pra mim";

  return (
    <div style={{ flex: "1 1 auto", minHeight: 0, maxHeight: CARD_MAX_HEIGHT, display: "flex", flexDirection: "column" }}>
      {/* Sem eyebrow nem contador: o cartão domina (linguagem flashcard). O
          progresso vive no baralho visível atrás e no estado "rodada triada".
          flex:1 + minHeight:0 = preenche o espaço REAL que sobra entre stories
          row e tab bar em telas BAIXAS (não um palpite em dvh, que ignorava a
          altura real da tela e chegava a sobrepor a tab bar). maxHeight põe um
          teto pra esse crescimento em telas ALTAS — sem ele, o card virava do
          tamanho da tela inteira e sobrava um vão vazio dentro dele, entre o
          conteúdo (ancorado no topo) e o rodapé. O pai (deck-wrapper, no feed)
          centraliza o card com justifyContent quando ele fica menor que o
          espaço disponível — a sobra vira margem AO REDOR, não vazio DENTRO.
          perspective habilita o flip 3D do toque. */}
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, perspective: 1200 }}>
        {/* Teasers extras (Como gravar / No roteiro) só entram quando a tela
            tem altura pra eles — em telas baixas (iPhone SE, 667px) o card
            fica com o essencial e nada é espremido ou cortado. */}
        <style>{`
          .d2c-tall-only{display:none}
          .d2c-map-anchor-grid{max-height:100px}
          .d2c-map-anchor-token{min-height:44px}
          .d2c-map-anchor-value{display:block;white-space:nowrap}
          @media (min-height:760px){
            .d2c-tall-only{display:block}
            .d2c-map-anchor-grid{max-height:118px}
            .d2c-map-anchor-token{min-height:54px}
            .d2c-map-anchor-value{display:-webkit-box;white-space:normal;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.15}
          }
        `}</style>
        {/* Cards de trás — promovem com spring quando o topo sai. */}
        {behind.map((item, i) => (
          <motion.div
            key={stackItemIdentity(item)}
            aria-hidden="true"
            initial={false}
            animate={{
              scale: 1 - (i + 1) * 0.03,
              y: (i + 1) * 10,
              rotate: i === 0 ? -1.8 : 1.4,
              opacity: 1 - (i + 1) * 0.18,
            }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 22,
              background: CARD_BG,
              boxShadow: "0 4px 14px rgba(28,28,30,0.06), 0 0 0 0.5px rgba(28,28,30,0.04)",
              zIndex: 2 - i,
              overflow: "hidden",
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <StackCardBody item={item} />
          </motion.div>
        ))}

        {/* Card do topo — arrastável. `key` remonta a cada topo novo; o `x` é
            do pai, então botão e arrasto movem o MESMO card. Toque no corpo =
            flip pro detalhe; os botões DENTRO do rodapé decidem. */}
        <motion.div
          key={topIdentity}
          role="group"
          aria-label={isCollabTop ? `Collab pra pauta: ${topTitle}` : `Pauta: ${topTitle}`}
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
            rotateY: flipY,
            position: "absolute",
            inset: 0,
            borderRadius: 22,
            background: CARD_BG,
            // O prêmio brilha (elevação roxa difusa) — sem borda/moldura.
            boxShadow: isCollabTop ? COLLAB_CARD_SHADOW : STACK_CARD_SHADOW,
            cursor: "grab",
            touchAction: "pan-y",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            // Rede de segurança: em telas muito baixas, qualquer conteúdo que
            // ainda assim precise de mais espaço do que o disponível é cortado
            // pelas bordas arredondadas — nunca vaza pra fora do card.
            overflow: "hidden",
          }}
          whileTap={{ cursor: "grabbing" }}
          onTap={() => {
            // onTap só dispara quando o gesto NÃO virou arrasto — toque = virar.
            flipToDetail(top.pauta.id);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            flipToDetail(top.pauta.id);
          }}
          onDragEnd={(_, info) => {
            if (decidingRef.current) return;
            const power = info.offset.x + info.velocity.x * 0.15;
            if (info.offset.x > SWIPE_CONFIRM_PX || power > SWIPE_CONFIRM_VELOCITY) {
              flyOut(top.pauta.id, 1);
            } else if (info.offset.x < -SWIPE_CONFIRM_PX || power < -SWIPE_CONFIRM_VELOCITY) {
              flyOut(top.pauta.id, -1);
            } else {
              // Abaixo do limiar — volta pro centro.
              animate(x, 0, { type: "spring", stiffness: 300, damping: 26 });
            }
          }}
        >
          <FlipHint />
          <DecisionStamp label={positiveLabel} side="left" opacity={wantOpacity} scale={wantScale} />
          <DecisionStamp label={negativeLabel} side="right" opacity={skipOpacity} scale={skipScale} />
          <StackCardBody item={top} />

          {/* Rodapé de decisão — dentro do cartão. stopPropagation no pointer
              impede o clique de iniciar drag ou contar como toque-de-virar. */}
          {/* Botões maiores (56/62) e mais respiro vertical: num card de 560
              o rodapé antigo (50/54, 22px de padding total) ficava mirrado e
              o vão sobrava logo acima dele; o rodapé maior absorve parte da
              altura extra e melhora o alvo de toque das duas decisões. */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 48,
              padding: "14px 0 16px", borderTop: "0.5px solid rgba(28,28,30,0.06)",
            }}
            onPointerDownCapture={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); pressButton(-1); }}
                aria-label="Não é pra mim"
                style={{
                  width: 56, height: 56, borderRadius: 9999, background: "var(--ds-color-surface)",
                  border: "1.5px solid var(--ds-color-line)", display: "grid", placeItems: "center",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <XIcon size={21} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SECONDARY_HEX }}>{negativeLabel}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); pressButton(1); }}
                aria-label={isCollabTop ? "Quero fazer essa collab" : "Quero gravar essa pauta"}
                style={{
                  width: 62, height: 62, borderRadius: 9999, background: COLLAB_ACCENT,
                  border: "none", display: "grid", placeItems: "center", cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(250,22,91,0.32)", fontFamily: "inherit",
                }}
              >
                <HeartIcon size={24} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: COLLAB_ACCENT }}>{positiveLabel}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
