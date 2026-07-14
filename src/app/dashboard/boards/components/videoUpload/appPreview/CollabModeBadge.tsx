// Selo de modo da collab — UMA peça pros três lugares que falam de "como
// gravar" (ficha, overlay de match, e quem mais precisar). Antes cada
// superfície tinha o seu inline com copy divergente ("Presencial" no overlay,
// "Presencial · mesma cidade" na ficha) — mesmo conceito lendo como coisas
// diferentes. A copy agora é única; só a pele (light/dark) muda com o fundo.

import type { CollabMode } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { color } from "@/design-system";

function PinIcon({ color }: { color: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function WavesIcon({ color }: { color: string }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M8.5 12a3.5 3.5 0 0 1 7 0" />
      <circle cx="12" cy="12" r="1" fill={color} />
    </svg>
  );
}

export function collabModeLabel(mode: CollabMode): string {
  return mode === "presencial" ? "Presencial · mesma cidade" : "À distância";
}

export function CollabModeBadge({ mode, surface = "light" }: { mode: CollabMode; surface?: "light" | "dark" }) {
  const palette = surface === "dark"
    ? { bg: "rgba(255,255,255,0.1)", color: color.paper }
    : { bg: color.neutral, color: color.textSecondary };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
      borderRadius: 999, background: palette.bg, padding: "3px 8px",
      fontSize: 10, fontWeight: 700, color: palette.color,
    }}>
      {mode === "presencial" ? <PinIcon color={palette.color} /> : <WavesIcon color={palette.color} />}
      {collabModeLabel(mode)}
    </span>
  );
}
