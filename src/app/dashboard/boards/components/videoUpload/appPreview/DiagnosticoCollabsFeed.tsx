"use client";

// Aba "Collabs" — feed de pautas. Cada card é uma pauta (o que postar); quando há
// um criador compatível pelo território da pauta, ele aparece embutido no card
// (collab = mapas compatíveis postando juntos). M1.1: feed + stories row + lupa +
// WhatsApp + gerar + estados. M1.2/M1.3: match por-pauta embutido.

import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type {
  DiagnosticoCreatorDirectoryState,
} from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
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

function PautaCard({ pauta, onOpenIdea }: { pauta: ContentIdeaListItem; onOpenIdea?: (id: string) => void }) {
  const snippet = pauta.angle?.trim() || pauta.hook?.trim() || pauta.whyItFits?.trim() || "";
  return (
    <DiagnosticoCardShell
      onClick={onOpenIdea ? () => onOpenIdea(pauta.id) : undefined}
      className="border border-zinc-900/80"
    >
      <div style={{ padding: "16px 18px" }}>
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
        {/* M1.3: criador compatível embutido aqui quando houver match por território. */}
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
              <PautaCard key={pauta.id} pauta={pauta} onOpenIdea={onOpenIdea} />
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
