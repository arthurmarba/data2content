"use client";

// Tab bar mobile do "Seu Mapa" — 3 slots: Perfil · Scan · Collabs.
// Apresentacional: o shell (DiagnosticoRealShellClient) dona o estado da aba e a
// ação do "+". Fica em z-40 — acima do conteúdo da página e ABAIXO dos overlays
// de detalhe (z-50), que devem cobri-la quando abertos.

import { color } from "@/design-system";

export type DiagnosticoTab = "perfil" | "collabs";

function PerfilIcon({ active }: { active: boolean }) {
  const c = active ? color.brand : color.textMuted;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke={c} strokeWidth="1.8" />
      <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollabsIcon({ active }: { active: boolean }) {
  const c = active ? color.brand : color.textMuted;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" stroke={c} strokeWidth="1.8" />
      <circle cx="16" cy="9.5" r="2.4" stroke={c} strokeWidth="1.8" />
      <path d="M3 19c0-2.8 2.5-4.7 5.5-4.7 1.6 0 3 .55 4 1.45" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 18.8c.3-2.2 2.1-3.6 4.4-3.6 1.5 0 2.8.6 3.6 1.6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TabButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="relative flex min-h-[3.25rem] min-w-[64px] flex-1 flex-col items-center justify-start gap-1.5 rounded-xl border-0 bg-transparent pt-0.5 transition-transform active:scale-95"
    >
      {children}
      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 750 : 620,
          letterSpacing: -0.1,
          color: active ? color.brandStrong : color.textMuted,
        }}
      >
        {label}
      </span>
    </button>
  );
}

export function DiagnosticoTabBar({
  activeTab,
  onSelectPerfil,
  onSelectCollabs,
  onPressPlus,
}: {
  activeTab: DiagnosticoTab;
  onSelectPerfil: () => void;
  onSelectCollabs: () => void;
  /** Abre o fluxo de upload de vídeo (não troca de aba). */
  onPressPlus: () => void;
}) {
  return (
    <nav
      data-diagnostico-tab-bar="true"
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[var(--ds-tab-bar-height)] items-start justify-center border-t px-5 pb-[var(--ds-safe-bottom)] pt-2.5 lg:hidden"
      style={{
        background: "color-mix(in srgb, var(--ds-color-paper) 94%, transparent)",
        borderColor: color.line,
        boxShadow: "0 -12px 36px rgba(18,16,20,0.08)",
        backdropFilter: "blur(18px)",
      }}
    >
      <TabButton label="Perfil" active={activeTab === "perfil"} onClick={onSelectPerfil}>
        <PerfilIcon active={activeTab === "perfil"} />
      </TabButton>

      {/* Centro Scan — ação de leitura, não é uma aba. Elevado e destacado. */}
      <div className="flex min-w-[64px] flex-1 flex-col items-center">
        <button
          type="button"
          onClick={onPressPlus}
          aria-label="Escanear novo vídeo"
          className="active:scale-[0.94] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[rgba(250,22,91,0.3)]"
          style={{
            marginTop: -22,
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: color.brand,
            color: "var(--ds-color-on-brand)",
            display: "grid",
            placeItems: "center",
            border: `3px solid ${color.paper}`,
            boxShadow: "0 8px 24px rgba(250,22,91,0.28)",
            cursor: "pointer",
            transition: "transform var(--ds-motion-fast) var(--ds-ease-standard)",
          }}
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        <span
          aria-hidden="true"
          style={{
            marginTop: 3,
            color: color.brandStrong,
            fontSize: 11,
            fontWeight: 750,
            letterSpacing: -0.1,
          }}
        >
          Escanear
        </span>
      </div>

      <TabButton label="Collabs" active={activeTab === "collabs"} onClick={onSelectCollabs}>
        <CollabsIcon active={activeTab === "collabs"} />
      </TabButton>
    </nav>
  );
}
