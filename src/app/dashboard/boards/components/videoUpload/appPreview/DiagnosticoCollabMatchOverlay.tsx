"use client";

// Comemoração do match — o único momento "alto" da aba Collabs, e é ganho:
// só aparece quando os DOIS criadores toparam a MESMA pauta. Privado entre os
// dois (nada é publicado). O CTA leva pro DM do Instagram — o app faz a
// apresentação e sai da frente; não existe chat interno (decisão de produto).
//
// variant:
//   "celebration" — o momento em si (springs, sparkle). Copy calma, sem hype.
//   "revisit"     — reaberto depois (ex.: fileira Combinadas). Sem fanfarra:
//                   é status, não festa. Fade rápido, mesmo conteúdo.

import { motion, useReducedMotion } from "framer-motion";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import { cleanIdeaText } from "@/app/dashboard/boards/videoUpload/contentIdeasTextHygiene";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { CollabModeBadge } from "./CollabModeBadge";
import { StableCreatorAvatar } from "./StableCreatorAvatar";
import { color, font, shadow } from "@/design-system";

const INK = color.ink;

function SparkleIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        fill="#fff"
      />
      <path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" fill="#fff" opacity="0.75" />
    </svg>
  );
}

function Avatar({
  name,
  avatarUrl,
  creatorId,
  mediaKitSlug,
  size = 72,
  ring = color.brand,
}: {
  name: string;
  avatarUrl?: string | null;
  creatorId?: string | null;
  mediaKitSlug?: string | null;
  size?: number;
  ring?: string;
}) {
  const initials = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        // Mesmo fundo de iniciais dos avatares do deck/ficha/gavetas (var(--ds-color-ink))
        // — uma pele só pro "criador sem foto" em toda a experiência.
        width: size, height: size, borderRadius: 9999, overflow: "hidden", flexShrink: 0,
        position: "relative", background: color.ink, color: color.paper, display: "grid", placeItems: "center",
        fontSize: size * 0.36, fontWeight: 700,
        border: `3px solid ${ring}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <StableCreatorAvatar
        name={name}
        avatarUrl={avatarUrl}
        creatorId={creatorId}
        mediaKitSlug={mediaKitSlug}
        fallbackText={initials}
      />
    </div>
  );
}

export function DiagnosticoCollabMatchOverlay({
  pauta,
  collab,
  viewerName,
  viewerAvatarUrl,
  variant = "celebration",
  onOpenIdea,
  onClose,
}: {
  pauta: ContentIdeaListItem;
  collab: NarrativeCollabMatch;
  viewerName: string;
  viewerAvatarUrl?: string | null;
  variant?: "celebration" | "revisit";
  onOpenIdea?: (pautaId: string) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const celebrate = variant === "celebration" && !reduceMotion;
  const firstName = (collab.name || "").trim().split(" ")[0] || collab.name;
  const pautaTitle = cleanIdeaText(pauta.title);
  const instagramUrl = collab.username
    ? `https://instagram.com/${collab.username.replace(/^@+/, "")}`
    : null;

  const springIn = (fromX: number) =>
    celebrate
      ? {
          initial: { x: fromX, opacity: 0, scale: 0.7 },
          animate: { x: 0, opacity: 1, scale: 1 },
          transition: { type: "spring" as const, stiffness: 240, damping: 18, delay: 0.15 },
        }
      : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.18 } };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Match de collab"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: celebrate ? 0.3 : 0.15 }}
      className="fixed inset-0 z-[290] flex items-center justify-center px-6 ds-scrim"
      onClick={onClose}
    >
      <motion.section
        initial={celebrate ? { scale: 0.92, y: 18, opacity: 0 } : { opacity: 0 }}
        animate={celebrate ? { scale: 1, y: 0, opacity: 1 } : { opacity: 1 }}
        transition={celebrate ? { type: "spring", stiffness: 260, damping: 22 } : { duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, borderRadius: 28, background: INK,
          position: "relative", overflow: "hidden", textAlign: "center",
          padding: "40px 26px 26px",
          boxShadow: shadow.overlay,
        }}
      >
        {/* Blobs de cor — quietos, sem gradiente berrante */}
        <div aria-hidden="true" style={{ position: "absolute", top: -28, left: -24, width: 110, height: 110, borderRadius: 9999, background: color.brand, opacity: 0.34 }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -36, right: -28, width: 140, height: 140, borderRadius: 9999, background: color.map, opacity: 0.24 }} />

        <div style={{ position: "relative" }}>
          {/* Avatares se encontrando */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div {...springIn(-80)} style={{ zIndex: 1, marginRight: -14 }}>
              <Avatar name={viewerName} avatarUrl={viewerAvatarUrl} ring={color.map} />
            </motion.div>
            <motion.div
              initial={celebrate ? { scale: 0, rotate: -30 } : { opacity: 0 }}
              animate={celebrate ? { scale: 1, rotate: 0 } : { opacity: 1 }}
              transition={celebrate ? { type: "spring", stiffness: 300, damping: 14, delay: 0.42 } : { duration: 0.18 }}
              style={{ zIndex: 2, position: "relative", top: -26 }}
            >
              <SparkleIcon />
            </motion.div>
            <motion.div {...springIn(80)} style={{ zIndex: 1, marginLeft: -14 }}>
              <Avatar
                name={collab.name}
                avatarUrl={collab.avatarUrl}
                creatorId={collab.id}
                mediaKitSlug={collab.mediaKitSlug}
                ring={color.brand}
              />
            </motion.div>
          </div>

          <motion.div
            initial={celebrate ? { opacity: 0, y: 10 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={celebrate ? { delay: 0.5, duration: 0.3 } : { duration: 0.18 }}
          >
            <p style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: color.paper, letterSpacing: "-0.04em", margin: "14px 0 0" }}>
              É um match
            </p>
            <p style={{ fontSize: 14, color: "var(--ds-color-line)", margin: "6px 0 0", lineHeight: 1.45 }}>
              Você e {firstName}, pela mesma pauta
            </p>
            <p style={{ fontSize: 13, color: "var(--ds-color-text-muted)", fontStyle: "italic", margin: "10px 0 0", lineHeight: 1.45 }}>
              &ldquo;{pautaTitle}&rdquo;
            </p>

            {collab.collabRecordingIdea ? (
              <div
                style={{
                  margin: "20px 0 6px",
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ds-color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Como gravar
                  </span>
                  {/* Peça compartilhada com a ficha — mesma copy nos dois lugares. */}
                  {collab.collabMode ? <CollabModeBadge mode={collab.collabMode} surface="dark" /> : null}
                </div>
                <p style={{ fontSize: 13, color: "var(--ds-color-line)", lineHeight: 1.45, margin: 0 }}>
                  {collab.collabMode === "presencial" && "Vocês estão na mesma cidade — o caminho é "}
                  {collab.collabMode === "remoto" && "Vocês moram longe — o caminho é "}
                  {!collab.collabMode && "O caminho é "}
                  {collab.collabRecordingIdea}. Combinem no Instagram.
                </p>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%", padding: "13px 16px", borderRadius: 999,
                    background: color.brand, color: "var(--ds-color-on-brand)", fontSize: 14, fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Chamar {firstName} no Instagram
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenIdea?.(pauta.id)}
                style={{
                  width: "100%", padding: "11px 16px", borderRadius: 999,
                  background: "transparent", color: "var(--ds-color-line)", fontSize: 13, fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.22)", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Ver a pauta completa
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%", padding: "8px", borderRadius: 999, background: "none",
                  color: "var(--ds-color-text-secondary)", fontSize: 12.5, fontWeight: 600, border: "none",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Depois
              </button>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </motion.div>
  );
}
