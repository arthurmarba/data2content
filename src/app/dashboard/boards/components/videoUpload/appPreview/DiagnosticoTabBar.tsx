"use client";

// Tab bar mobile do "Seu Mapa" — 3 slots: Perfil · "+" (upload) · Collabs.
// Apresentacional: o shell (DiagnosticoRealShellClient) dona o estado da aba e a
// ação do "+". Fica em z-40 — acima do conteúdo da página e ABAIXO dos overlays
// de detalhe (z-50), que devem cobri-la quando abertos.

import { TEXT_PRIMARY_HEX, TEXT_TERTIARY_HEX } from "./diagnosticoTokens";

export type DiagnosticoTab = "perfil" | "collabs";

function PerfilIcon({ active }: { active: boolean }) {
  const c = active ? TEXT_PRIMARY_HEX : TEXT_TERTIARY_HEX;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke={c} strokeWidth="1.8" />
      <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollabsIcon({ active }: { active: boolean }) {
  const c = active ? TEXT_PRIMARY_HEX : TEXT_TERTIARY_HEX;
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
      className="relative flex min-h-[3.25rem] min-w-[64px] flex-1 flex-col items-center justify-start gap-1.5 rounded-xl pt-0.5"
      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
    >
      {children}
      <span
        style={{
          fontSize: 11,
          fontWeight: active ? 700 : 600,
          letterSpacing: -0.1,
          color: active ? TEXT_PRIMARY_HEX : TEXT_TERTIARY_HEX,
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
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] items-start justify-center border-t border-zinc-100 bg-white px-5 pb-[env(safe-area-inset-bottom,0px)] pt-2.5 shadow-[0_-10px_32px_rgba(15,23,42,0.08)] lg:hidden"
    >
      <TabButton label="Perfil" active={activeTab === "perfil"} onClick={onSelectPerfil}>
        <PerfilIcon active={activeTab === "perfil"} />
      </TabButton>

      {/* Centro "+" — ação de upload, não é uma aba. Elevado e destacado. */}
      <div className="flex min-w-[64px] flex-1 flex-col items-center">
        <button
          type="button"
          onClick={onPressPlus}
          aria-label="Analisar novo vídeo"
          style={{
            marginTop: -22,
            width: 56,
            height: 56,
            borderRadius: 9999,
            background: TEXT_PRIMARY_HEX,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            border: "3px solid #fff",
            boxShadow: "0 6px 18px rgba(24,24,27,0.28)",
            cursor: "pointer",
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <TabButton label="Collabs" active={activeTab === "collabs"} onClick={onSelectCollabs}>
        <CollabsIcon active={activeTab === "collabs"} />
      </TabButton>
    </nav>
  );
}
