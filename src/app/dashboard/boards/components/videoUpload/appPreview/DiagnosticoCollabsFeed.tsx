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
import { DiagnosticoCardShell } from "./DiagnosticoCardShell";
import {
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
  TEXT_BODY_HEX,
  SAFE_TOP,
} from "./diagnosticoTokens";

const WA_GREEN = "#25D366";

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
    <div style={{ padding: "10px 18px 4px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY_HEX, letterSpacing: -0.5, margin: 0, lineHeight: 1.1 }}>
          Collabs
        </h1>
        <p style={{ fontSize: 13, color: TEXT_SECONDARY_HEX, margin: "4px 0 0", lineHeight: 1.4 }}>
          Pautas do seu mapa e criadores pra postar junto.
        </p>
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
    <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 12 }}>
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

function CollabRowSkeleton() {
  return (
    <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 12 }}>
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

function PautaCard({
  pauta,
  collab,
  loading = false,
  onOpenIdea,
  onOpenCreatorMediaKit,
}: {
  pauta: ContentIdeaListItem;
  collab?: NarrativeCollabMatch | null;
  loading?: boolean;
  onOpenIdea?: (id: string) => void;
  onOpenCreatorMediaKit?: (slug: string) => void;
}) {
  const snippet = pauta.angle?.trim() || pauta.hook?.trim() || pauta.whyItFits?.trim() || "";
  return (
    <DiagnosticoCardShell className="border border-zinc-900/80">
      <div style={{ padding: "16px 18px" }}>
        <button
          type="button"
          onClick={onOpenIdea ? () => onOpenIdea(pauta.id) : undefined}
          style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: onOpenIdea ? "pointer" : "default", fontFamily: "inherit" }}
        >
          {pauta.territory ? (
            <span style={{
              display: "inline-block", fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
              textTransform: "uppercase", color: TEXT_SECONDARY_HEX, marginBottom: 8,
            }}>
              {pauta.territory}
            </span>
          ) : null}
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT_PRIMARY_HEX, letterSpacing: -0.3, lineHeight: 1.3, margin: 0 }}>
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
        {/* Criador compatível pelo território da pauta. Enquanto busca, skeleton;
            depois, só aparece quando há match real (null = pauta-only, sem placeholder). */}
        {collab ? (
          <CollabCreatorRow collab={collab} onOpenCreatorMediaKit={onOpenCreatorMediaKit} />
        ) : loading ? (
          <CollabRowSkeleton />
        ) : null}
      </div>
    </DiagnosticoCardShell>
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
  onOpenCommunity,
  onOpenCreatorMediaKit,
  onConnectWhatsApp,
  onUpgrade,
  onGenerate,
  onBackToPerfil,
}: Props) {
  const hasPautas = pautas.length > 0;
  const mapless = ideaGenerationBlocker === "map_incomplete";

  return (
    <div style={{ paddingTop: SAFE_TOP }}>
      <FeedHeader isPro={isPro} whatsappLinked={whatsappLinked} onConnectWhatsApp={onConnectWhatsApp} onUpgrade={onUpgrade} />

      {/* Stories row + lupa (já trazem "Descobrir criadores" → comunidade) */}
      {creatorDirectory?.status === "ready" && creatorDirectory.creators.length > 0 && (
        <div style={{ paddingTop: 12, paddingBottom: 6 }}>
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
          <div style={{ padding: "8px 18px 0", display: "grid", gap: 12 }}>
            {pautas.map((pauta) => (
              <PautaCard
                key={pauta.id}
                pauta={pauta}
                collab={pautaCollabs?.get(pauta.id) ?? null}
                loading={pautaCollabsLoading}
                onOpenIdea={onOpenIdea}
                onOpenCreatorMediaKit={onOpenCreatorMediaKit}
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
