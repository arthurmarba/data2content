"use client";

// Comemoração do match — o único momento "alto" da aba Collabs, e é ganho:
// só aparece quando os DOIS criadores toparam a MESMA pauta. Privado entre os
// dois (nada é publicado). O CTA leva pro DM do Instagram — o app faz a
// apresentação e sai da frente; não existe chat interno (decisão de produto).
//
// O CTA é PRETO, não rosa: na aba Collabs o preto é o "sim" (o botão "Quero
// fazer" do deck), e o rosa ficou reservado à conversão do Pro no app inteiro.
// A cor da comemoração vem do sparkle e do anel do parceiro, que já são rosa —
// e um botão rosa aqui competiria com eles em vez de somar.
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

function SparkleIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"
        fill="currentColor"
      />
      <path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" fill="currentColor" opacity="0.75" />
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
        boxShadow: shadow.raised,
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
  pauta: Pick<ContentIdeaListItem, "id" | "title">;
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
      aria-label="Parceria confirmada"
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
          width: "100%", maxWidth: 380, borderRadius: 24, background: color.surface,
          position: "relative", overflow: "hidden", textAlign: "center",
          padding: "40px 26px 26px",
          border: `1px solid ${color.line}`,
          boxShadow: shadow.overlay,
        }}
      >
        <div style={{ position: "relative" }}>
          {/* Avatares se encontrando */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <motion.div {...springIn(-80)} style={{ zIndex: 1, marginRight: -14 }}>
              <Avatar name={viewerName} avatarUrl={viewerAvatarUrl} ring={color.lineStrong} />
            </motion.div>
            <motion.div
              initial={celebrate ? { scale: 0, rotate: -30 } : { opacity: 0 }}
              animate={celebrate ? { scale: 1, rotate: 0 } : { opacity: 1 }}
              transition={celebrate ? { type: "spring", stiffness: 300, damping: 14, delay: 0.42 } : { duration: 0.18 }}
              style={{ zIndex: 2, position: "relative", top: -26 }}
            >
              <span style={{ color: color.brand }}><SparkleIcon /></span>
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
            <p style={{ fontFamily: font.display, fontSize: 28, fontWeight: 700, color: color.ink, letterSpacing: "-0.04em", margin: "14px 0 0" }}>
              Vocês dois querem fazer esta collab
            </p>
            <p style={{ fontSize: 14, color: color.textSecondary, margin: "6px 0 0", lineHeight: 1.45 }}>
              O interesse dos dois foi confirmado
            </p>
            <p style={{ fontSize: 13, color: color.textMuted, margin: "10px 0 0", lineHeight: 1.45 }}>
              &ldquo;{pautaTitle}&rdquo;
            </p>

            {collab.collabRecordingIdea ? (
              <div
                style={{
                  margin: "20px 0 6px",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: color.neutral,
                  border: `1px solid ${color.line}`,
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Como gravar
                  </span>
                  {/* Peça compartilhada com a ficha — mesma copy nos dois lugares. */}
                  {collab.collabMode ? <CollabModeBadge mode={collab.collabMode} /> : null}
                </div>
                <p style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.45, margin: 0 }}>
                  {collab.collabRecordingIdea}
                </p>
              </div>
            ) : null}

            <div style={{ marginTop: 12, borderTop: `1px solid ${color.line}`, paddingTop: 12, textAlign: "left" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: color.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Próximo passo
              </span>
              <p style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.45, margin: "5px 0 0" }}>
                Chame {firstName} no Instagram e combinem quem grava cada parte.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-button ds-button--secondary ds-button--block"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
                    width: "100%",
                    textDecoration: "none",
                  }}
                >
                  Chamar {firstName} no Instagram
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenIdea?.(pauta.id)}
                className="ds-button ds-button--quiet ds-button--block"
              >
                Ver plano da parceria
              </button>
              <button
                type="button"
                onClick={onClose}
                className="ds-button ds-button--ghost ds-button--block ds-button--small"
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
