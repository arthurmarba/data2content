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

import { useEffect, useRef } from "react";
import {
  motion,
  animate,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
} from "./diagnosticoTokens";

export type CollabStackDecision = "interested" | "dismissed";

export type CollabStackCardKind = "pauta" | "collab" | "mystery";

export interface CollabStackItem {
  kind: CollabStackCardKind;
  pauta: ContentIdeaListItem;
  /** Presente só em kind="collab" — o criador do outro lado. */
  collab: NarrativeCollabMatch | null;
}

const COLLAB_VIOLET = "#7c3aed";
// O card senta DIRETO na página (sem palco) — a elevação é a sombra dele.
const CARD_BG = "#ffffff";
const STACK_CARD_SHADOW =
  "0 2px 6px rgba(28,28,30,0.06), 0 16px 36px rgba(28,28,30,0.12), 0 0 0 0.5px rgba(28,28,30,0.04)";
// O prêmio "brilha" em vez de ser emoldurado: elevação COLORIDA, sem borda —
// borda sólida no branco lia como card-dentro-de-card.
const COLLAB_CARD_SHADOW =
  "0 2px 8px rgba(124,58,237,0.10), 0 18px 40px rgba(124,58,237,0.22), 0 0 0 0.5px rgba(124,58,237,0.12)";
/** Deslocamento (px) a partir do qual soltar o card confirma a decisão. */
const SWIPE_CONFIRM_PX = 96;
const SWIPE_CONFIRM_VELOCITY = 600;
/**
 * Teto de altura do card — medido: o conteúdo típico (chips + título + zona +
 * rodapé) usa ~310px. 380px dá uma folga real (~70px) pra títulos/ganchos um
 * pouco mais longos, sem deixar o card crescer até a tela inteira em telas
 * altas (o que sobrava como vão vazio entre a zona e o rodapé — chegou a 184px
 * de vazio com o teto antigo de 490/dvh, e ainda 129px com um teto de 440).
 * Em telas baixas o flex:1 ainda encolhe abaixo disso — o teto só entra quando
 * SOBRA espaço, nunca quando falta.
 */
const CARD_MAX_HEIGHT = 380;

// ─── Ícones (stroke style do app) ─────────────────────────────────────────────

function XIcon({ size = 20, color = "#a1a1aa" }: { size?: number; color?: string }) {
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
        overflow: "hidden", background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
        display: "grid", placeItems: "center",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ filter: "blur(1.5px)", opacity: 0.55 }}>
        <circle cx="20" cy="15" r="7" fill={COLLAB_VIOLET} />
        <path d="M6 36c0-7.7 6.3-13 14-13s14 5.3 14 13z" fill={COLLAB_VIOLET} />
      </svg>
      <span
        style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          fontSize: size * 0.42, fontWeight: 800, color: "#fff",
          textShadow: "0 1px 2px rgba(76,29,149,0.45)",
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
}: {
  label: string;
  side: "left" | "right";
  opacity: ReturnType<typeof useTransform<number, number>>;
}) {
  const positive = side === "left"; // stamp à esquerda = arrasto pra direita = positivo
  return (
    <motion.span
      style={{
        position: "absolute",
        top: 12,
        [side]: 14,
        opacity,
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
        background: positive ? COLLAB_VIOLET : "#f4f4f5",
        color: positive ? "#fff" : TEXT_SECONDARY_HEX,
        border: positive ? "none" : "1.5px solid #e4e4e7",
        boxShadow: positive ? "0 4px 12px rgba(124,58,237,0.35)" : "none",
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
      background: "#f5f3ff", color: COLLAB_VIOLET,
      fontSize: 10, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase",
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8.5" cy="8" r="3" stroke={COLLAB_VIOLET} strokeWidth="2.4" />
        <circle cx="16.5" cy="9.5" r="2.4" stroke={COLLAB_VIOLET} strokeWidth="2.4" />
        <path d="M3.5 19c0-2.6 2.3-4.4 5-4.4 1.5 0 2.8.5 3.7 1.3" stroke={COLLAB_VIOLET} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {label}
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
export function MetaChip({ label, tone = "violet" }: { label: string; tone?: "violet" | "amber" }) {
  const palette = tone === "violet"
    ? { bg: "#f5f3ff", color: "#5b21b6" }
    : { bg: "#fef3e2", color: "#92400e" };
  return (
    <span style={{
      display: "inline-block", maxWidth: 160, fontSize: 11, fontWeight: 600,
      color: palette.color, background: palette.bg, borderRadius: 999, padding: "3px 10px",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function StackCardBody({ item }: { item: CollabStackItem }) {
  const { kind, pauta, collab } = item;
  const initials = (collab?.name || "?").trim().slice(0, 1).toUpperCase();
  const hook = pauta.hook?.trim();
  return (
    // Anatomia única: META (chips) → TÍTULO (herói) → ZONA (gancho ou pessoa),
    // todos ANCORADOS no topo, colados como um bloco só (marginTop fixo entre
    // eles, não "auto" — "auto" empurrava a ZONA até grudar no rodapé, abrindo
    // um vão enorme quando o título era curto). O espaço sobrando cai sozinho
    // DEPOIS da zona, antes do rodapé — lugar normal de respiro num card, em vez
    // de um buraco no meio. Antes disso tudo era centralizado, e cada carta do
    // baralho tinha um ritmo diferente conforme o tamanho do título.
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "22px 22px 14px" }}>
      {kind !== "pauta" ? (
        <CollabPill label={kind === "collab" ? "collab pra essa pauta" : "collab escondida"} />
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {pauta.territory ? <MetaChip label={pauta.territory} /> : null}
        {kind === "pauta" && pauta.suggestedFormat ? (
          // Mais discreto que o território: é dado secundário (o território
          // é o que importa pro fit narrativo da collab).
          <span style={{ fontSize: 11, color: TEXT_SECONDARY_HEX }}>{pauta.suggestedFormat}</span>
        ) : null}
      </div>
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
            ? "clamp(24px, min(9.5vw, 4.2dvh), 38px)"
            : "clamp(20px, min(6.4vw, 2.85dvh), 27px)",
          fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.6,
          lineHeight: 1.15, margin: 0,
          display: "-webkit-box", WebkitLineClamp: kind === "pauta" ? 6 : 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {pauta.title}
      </p>

      {kind === "collab" && collab ? (
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 16 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 9999, flexShrink: 0, overflow: "hidden",
              background: "#18181b", color: "#fff", display: "grid", placeItems: "center",
              fontSize: 15, fontWeight: 700,
            }}
          >
            {collab.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={collab.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
            ) : initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: TEXT_PRIMARY_HEX, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              com {collab.name}
            </span>
            <span style={{ display: "block", fontSize: 12, color: TEXT_SECONDARY_HEX }}>
              toque pra ver por quê
            </span>
          </div>
        </div>
      ) : kind === "mystery" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 16 }}>
          <MysteryAvatar size={44} />
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: TEXT_PRIMARY_HEX }}>
              Um criador combina com essa pauta
            </span>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: COLLAB_VIOLET }}>
              Descubra quem no Pro →
            </span>
          </div>
        </div>
      ) : hook ? (
        // ZONA da pauta solo: o gancho como teaser — a informação que mais
        // ajuda a decidir. O roteiro completo continua no verso.
        <div style={{ marginTop: 16, borderLeft: "2.5px solid #ede9fe", paddingLeft: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: TEXT_SECONDARY_HEX }}>
            Abre com
          </span>
          <p style={{
            fontSize: 13.5, fontStyle: "italic", color: TEXT_BODY_HEX, lineHeight: 1.45, margin: "4px 0 0",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            &ldquo;{hook}&rdquo;
          </p>
        </div>
      ) : null}
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
  onDecide,
  onOpenIdea,
  onUpgrade,
}: {
  items: CollabStackItem[];
  isPro: boolean;
  /** Itens na mochila — vira a recompensa do estado "rodada triada". */
  shelfCount?: number;
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
  // Trava por card: impede decisão dupla (arrasto + botão) no mesmo topo.
  const decidingRef = useRef(false);

  const top = items[0] ?? null;
  const behind = items.slice(1, 3);
  const cleared = roundTotalRef.current > 0 && items.length === 0;

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
  const topId = top?.pauta.id ?? null;
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
  }, [topId, x, flipY, yMv, scaleMv, opacityMv, reduceMotion]);

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

  if (cleared) {
    // Fim do ritual = recompensa, não vazio: o que foi triado está na mochila.
    // Centralizado no espaço real que sobra (o wrapper do pai é flex:1) — sem
    // isso, a mensagem curta ficaria colada no topo com um vão vazio embaixo.
    return (
      <div style={{ flex: "1 1 auto", minHeight: 0, maxHeight: CARD_MAX_HEIGHT, display: "flex", flexDirection: "column", justifyContent: "center", padding: "12px 12px 10px", textAlign: "center" }}>
        <span style={{
          display: "inline-grid", placeItems: "center", width: 52, height: 52,
          borderRadius: 9999, background: "#f5f3ff", marginBottom: 12,
        }} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4.5 4.5L19 7.5" stroke={COLLAB_VIOLET} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, margin: 0, letterSpacing: -0.3 }}>
          Você triou a rodada
        </p>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, lineHeight: 1.5, margin: "5px 0 0" }}>
          {typeof shelfCount === "number" && shelfCount > 0
            ? `${shelfCount} ${shelfCount === 1 ? "pauta guardada" : "pautas guardadas"} na mochila — é lá que se grava.`
            : "Novas pautas chegam quando o seu mapa evolui."}
        </p>
      </div>
    );
  }

  if (!top) return null;

  // Copy dos stamps/botões acompanha o tipo do card do topo — mesmo gesto,
  // stakes diferentes: salvar uma ideia ≠ topar gravar com uma pessoa.
  const isCollabTop = top.kind !== "pauta";
  const positiveLabel = isCollabTop ? "quero fazer" : "quero gravar";
  const negativeLabel = isCollabTop ? "não agora" : "não é pra mim";

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
        {/* Cards de trás — promovem com spring quando o topo sai. */}
        {behind.map((item, i) => (
          <motion.div
            key={item.pauta.id}
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
          key={top.pauta.id}
          role="group"
          aria-label={isCollabTop ? `Collab pra pauta: ${top.pauta.title}` : `Pauta: ${top.pauta.title}`}
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
          <DecisionStamp label={positiveLabel} side="left" opacity={wantOpacity} />
          <DecisionStamp label={negativeLabel} side="right" opacity={skipOpacity} />
          <StackCardBody item={top} />

          {/* Rodapé de decisão — dentro do cartão. stopPropagation no pointer
              impede o clique de iniciar drag ou contar como toque-de-virar. */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 40,
              padding: "10px 0 12px", borderTop: "0.5px solid rgba(28,28,30,0.06)",
            }}
            onPointerDownCapture={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); pressButton(-1); }}
                aria-label={isCollabTop ? "Não agora" : "Não é pra mim"}
                style={{
                  width: 50, height: 50, borderRadius: 9999, background: "#fff",
                  border: "1.5px solid #e4e4e7", display: "grid", placeItems: "center",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <XIcon size={19} />
              </button>
              <span style={{ fontSize: 10, fontWeight: 600, color: TEXT_SECONDARY_HEX }}>{negativeLabel}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); pressButton(1); }}
                aria-label={isCollabTop ? "Quero fazer essa collab" : "Quero gravar essa pauta"}
                style={{
                  width: 54, height: 54, borderRadius: 9999, background: COLLAB_VIOLET,
                  border: "none", display: "grid", placeItems: "center", cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(124,58,237,0.35)", fontFamily: "inherit",
                }}
              >
                <HeartIcon size={21} />
              </button>
              <span style={{ fontSize: 10, fontWeight: 600, color: COLLAB_VIOLET }}>{positiveLabel}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
