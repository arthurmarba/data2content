"use client";

// Aba "Collabs" — feed de pautas. Cada card é uma pauta (o que postar); quando há
// um criador compatível pelo território da pauta, ele aparece embutido no card
// (collab = mapas compatíveis postando juntos). M1.1: feed + stories row + lupa +
// WhatsApp + gerar + estados. M1.2/M1.3: match por-pauta embutido.

import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type {
  DiagnosticoCreatorDirectoryState,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";
import { CreatorStoriesRow } from "./DiagnosticoPage";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  INK_DARK_HEX,
  SAFE_TOP,
  CARD_RADIUS,
} from "./diagnosticoTokens";

const WA_GREEN = "#25D366";

// Página branca (igual ao Perfil), e os cards usam o off-white quente do card
// "Seu Mapa" (#fffaf7) — mesma identidade. A separação dos cards empilhados vem
// do tom quente do card sobre o branco + a sombra firme abaixo (a sombra não é
// "cor": preserva a aparência do Seu Mapa e evita o branco-sobre-branco).
const FEED_BG = "#ffffff";
const CARD_BG = "#fffaf7"; // mesmo do card Seu Mapa (DiagnosticoPage)
// Sombra um pouco mais firme que o token compartilhado — eleva o card empilhado
// contra a página branca, tornando a borda card↔card inconfundível ao escanear.
const FEED_CARD_SHADOW =
  "0 1px 2px rgba(28,28,30,0.06), 0 6px 16px rgba(28,28,30,0.07), 0 0 0 0.5px rgba(28,28,30,0.05)";

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
  /** True enquanto o match por-pauta está sendo buscado — mostra skeleton no card. */
  pautaCollabsLoading?: boolean;
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

function FeedHeader({
  isPro,
  whatsappLinked,
  onConnectWhatsApp,
  onUpgrade,
}: Pick<Props, "isPro" | "whatsappLinked" | "onConnectWhatsApp" | "onUpgrade">) {
  return (
    // Hero alinhado ao header do Perfil ("Olá, nome"): mesma família, peso e clamp.
    <div style={{ padding: "22px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
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
      {/* Alertas no WhatsApp — Pro. Free vê o botão; o clique abre o paywall. */}
      {whatsappLinked ? (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
          borderRadius: 999, padding: "6px 11px", background: "#dcfce7", color: "#15803d",
          fontSize: 11, fontWeight: 600,
        }}>
          <WhatsAppIcon color={WA_GREEN} />
          Alertas ativos
        </span>
      ) : (
        <button
          type="button"
          onClick={() => (isPro ? onConnectWhatsApp?.() : onUpgrade?.("whatsapp"))}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
            borderRadius: 999, padding: "8px 14px", background: "transparent", color: TEXT_PRIMARY_HEX,
            fontSize: 12, fontWeight: 600, border: `1.5px solid ${TEXT_PRIMARY_HEX}`,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <WhatsAppIcon />
          Receber
        </button>
      )}
    </div>
  );
}

function CollabCreatorRow({
  collab,
  onOpenCreatorMediaKit,
}: {
  collab: NarrativeCollabMatch;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const initials = (collab.name || "?").trim().slice(0, 1).toUpperCase();
  const open = collab.mediaKitSlug && onOpenCreatorMediaKit
    ? () => onOpenCreatorMediaKit(collab.mediaKitSlug!)
    : undefined;
  return (
    // Sem métricas de audiência — só fit narrativo (decisão de produto).
    // Separação interna < gap entre cards: o divisor do collab não pode competir
    // com a fronteira do card (senão o olho agrupa este bloco com o card vizinho).
    <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
      <span style={{
        display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
        textTransform: "uppercase", color: "#7c3aed", marginBottom: 8,
      }}>
        Collab sugerida
      </span>
      <button
        type="button"
        onClick={open}
        disabled={!open}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          background: "none", border: "none", padding: 0, textAlign: "left",
          cursor: open ? "pointer" : "default", fontFamily: "inherit",
        }}
      >
        <div style={{
          width: 38, height: 38, borderRadius: 9999, flexShrink: 0, overflow: "hidden",
          background: "#18181b", color: "#fff", display: "grid", placeItems: "center",
          fontSize: 14, fontWeight: 700,
        }}>
          {collab.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={collab.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" />
          ) : initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {collab.name}
          </span>
          <span style={{ display: "block", fontSize: 12, color: TEXT_BODY_HEX, lineHeight: 1.35, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {collab.narrativeFitReason}
          </span>
        </div>
        {open ? <span style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, flexShrink: 0 }}>Ver ›</span> : null}
      </button>
    </div>
  );
}

// Avatar "misterioso" — silhueta sob blur, sugere uma pessoa real sem revelá-la.
// Genérico de propósito: não roda o match (zero custo Gemini para o free).
function MysteryAvatar({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 9999, flexShrink: 0, position: "relative",
      overflow: "hidden", background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
      display: "grid", placeItems: "center",
    }}>
      {/* Silhueta de pessoa, levemente desfocada */}
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" style={{ filter: "blur(1.5px)", opacity: 0.55 }}>
        <circle cx="20" cy="15" r="7" fill="#7c3aed" />
        <path d="M6 36c0-7.7 6.3-13 14-13s14 5.3 14 13z" fill="#7c3aed" />
      </svg>
      {/* "?" sobreposto */}
      <span style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: size * 0.42, fontWeight: 800, color: "#fff",
        textShadow: "0 1px 2px rgba(76,29,149,0.45)",
      }}>?</span>
    </div>
  );
}

// Teaser Pro pro free — onde estaria a collab, mostra um criador "misterioso"
// compatível, sem rodar o match (zero custo Gemini). Tap abre o paywall.
function CollabTeaser({ onUpgrade }: { onUpgrade?: (context?: PaywallContext) => void }) {
  return (
    <button
      type="button"
      onClick={() => onUpgrade?.("narrative_map")}
      style={{
        marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12,
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        background: "none", border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      <MysteryAvatar size={40} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.2 }}>
          Um criador combina com essa pauta
        </span>
        <span style={{ display: "block", fontSize: 12, color: "#7c3aed", fontWeight: 600, marginTop: 1 }}>
          Descubra quem no Pro →
        </span>
      </div>
      <span style={{
        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
        borderRadius: 999, padding: "6px 12px", background: "#7c3aed", color: "#fff",
        fontSize: 12, fontWeight: 700,
      }}>
        Revelar
      </span>
    </button>
  );
}

function CollabRowSkeleton() {
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 12 }}>
      <style>{`@keyframes d2c-collab-pulse{0%,100%{opacity:.5}50%{opacity:.2}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9999, background: "#ece9f6", flexShrink: 0, animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
        <div style={{ flex: 1, display: "grid", gap: 6 }}>
          <div style={{ height: 11, width: "45%", borderRadius: 6, background: "#ece9f6", animation: "d2c-collab-pulse 1.1s ease-in-out infinite" }} />
          <div style={{ height: 10, width: "80%", borderRadius: 6, background: "#f0eef7", animation: "d2c-collab-pulse 1.25s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function PautaCard({
  pauta,
  collab,
  loading = false,
  isPro,
  onOpenIdea,
  onToggleSave,
  onOpenCreatorMediaKit,
  onUpgrade,
}: {
  pauta: ContentIdeaListItem;
  collab?: NarrativeCollabMatch | null;
  loading?: boolean;
  isPro: boolean;
  onOpenIdea?: (id: string) => void;
  onToggleSave?: (id: string) => void;
  onOpenCreatorMediaKit?: (slug: string) => void;
  onUpgrade?: (context?: PaywallContext) => void;
}) {
  const snippet = pauta.angle?.trim() || pauta.hook?.trim() || pauta.whyItFits?.trim() || "";
  const isSaved = pauta.status === "saved";
  return (
    // Linguagem de elevação (raio 20 + sombra com hairline), igual a Seu Mapa /
    // Sua Audiência — sem borda dura. Coerente com os cards de conteúdo do app.
    <div style={{ borderRadius: CARD_RADIUS, background: CARD_BG, boxShadow: FEED_CARD_SHADOW, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", position: "relative" }}>
        {onToggleSave ? (
          <button
            type="button"
            onClick={() => onToggleSave(pauta.id)}
            aria-label={isSaved ? "Remover dos salvos" : "Salvar pauta"}
            aria-pressed={isSaved}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 1,
              display: "grid", placeItems: "center", width: 34, height: 34,
              borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
              background: isSaved ? "#fef0e8" : "transparent",
              color: isSaved ? "#c2410c" : TEXT_SECONDARY_HEX, fontFamily: "inherit",
            }}
          >
            <BookmarkIcon filled={isSaved} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenIdea ? () => onOpenIdea(pauta.id) : undefined}
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, paddingRight: onToggleSave ? 36 : 0, cursor: onOpenIdea ? "pointer" : "default", fontFamily: "inherit" }}
        >
          {pauta.territory ? (
            // Linha de contexto discreta (não um "header" uppercase) — o título é o
            // herói do card. Peso 600/cinza/sem caixa-alta deixa o título liderar.
            <span style={{
              display: "block", maxWidth: "100%", fontSize: 12, fontWeight: 600, letterSpacing: 0,
              color: TEXT_SECONDARY_HEX, marginBottom: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {pauta.territory}
            </span>
          ) : null}
          <p style={{ fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, lineHeight: 1.3, margin: 0 }}>
            {pauta.title}
          </p>
          {snippet ? (
            <p style={{
              fontSize: 13, color: TEXT_BODY_HEX, lineHeight: 1.45, margin: "6px 0 0",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {snippet}
            </p>
          ) : null}
        </button>
        {/* Criador compatível pelo território da pauta. Pro: match real (ou skeleton
            enquanto busca; null = pauta-only, sem placeholder). Free: teaser Pro. */}
        {collab ? (
          <CollabCreatorRow collab={collab} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />
        ) : loading ? (
          <CollabRowSkeleton />
        ) : !isPro ? (
          <CollabTeaser onUpgrade={onUpgrade} />
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
  // Pautas salvas ficam ancoradas no topo — não somem de vista quando o criador
  // gera novas pautas. Sort estável preserva a ordem dentro de cada grupo.
  const orderedPautas = [...pautas].sort(
    (a, b) => (a.status === "saved" ? 0 : 1) - (b.status === "saved" ? 0 : 1),
  );

  return (
    // Superfície de fundo neutra (warm gray) atrás dos cards: o card branco passa a
    // ser um objeto NITIDAMENTE delimitado contra o fundo — antes era branco-sobre-
    // branco e a borda entre um card e o de baixo sumia, embaralhando a leitura.
    <div style={{ background: FEED_BG, minHeight: "100%" }}>
      {/* Header — o gradiente quente termina na cor do feed (sem emenda visível). */}
      <div style={{ background: `linear-gradient(180deg, #fff8f5 0%, ${FEED_BG} 100%)`, paddingTop: SAFE_TOP, paddingBottom: 6 }}>
        <FeedHeader isPro={isPro} whatsappLinked={whatsappLinked} onConnectWhatsApp={onConnectWhatsApp} onUpgrade={onUpgrade} />
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
          <div style={{ padding: "16px 16px 0", display: "grid", gap: 14 }}>
            {orderedPautas.map((pauta) => (
              <PautaCard
                key={pauta.id}
                pauta={pauta}
                collab={pautaCollabs?.get(pauta.id) ?? null}
                loading={pautaCollabsLoading}
                isPro={isPro}
                onOpenIdea={onOpenIdea}
                onToggleSave={onToggleSave}
                onOpenCreatorMediaKit={onOpenCreatorMediaKit}
                onUpgrade={onUpgrade}
              />
            ))}
          </div>
          <div style={{ padding: "18px 18px 0", display: "flex", justifyContent: "center" }}>
            <GenerateButton
              isPro={isPro}
              isGeneratingIdeas={isGeneratingIdeas}
              onGenerate={onGenerate}
              onUpgrade={onUpgrade}
              label="Gerar novas pautas →"
            />
          </div>
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
    </div>
  );
}
