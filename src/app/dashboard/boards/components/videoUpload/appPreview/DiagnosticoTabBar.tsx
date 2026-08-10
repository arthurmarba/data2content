"use client";

// Tab bar mobile do Perfil — 3 slots: Perfil · ação "+" · Collabs.
// Apresentacional: o shell (DiagnosticoRealShellClient) dona o estado da aba e a
// ação do "+". Fica em z-40 — acima do conteúdo da página e ABAIXO dos overlays
// de detalhe (z-50), que devem cobri-la quando abertos.

export type DiagnosticoTab = "perfil" | "collabs";

function PerfilIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19.5c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CollabsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 19c0-2.8 2.5-4.7 5.5-4.7 1.6 0 3 .55 4 1.45" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 18.8c.3-2.2 2.1-3.6 4.4-3.6 1.5 0 2.8.6 3.6 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
      className={`relative flex min-h-[3.25rem] min-w-[64px] flex-1 flex-col items-center justify-start gap-1.5 rounded-md border-0 bg-transparent pt-0.5 transition-transform active:scale-[0.97] ${active ? "text-[var(--ds-color-brand-strong)]" : "text-[var(--ds-color-text-muted)]"}`}
    >
      {children}
      <span className={`text-[11px] tracking-[-0.1px] ${active ? "font-semibold" : "font-medium"}`}>
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
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[var(--ds-tab-bar-height)] items-start justify-center border-t border-[var(--ds-color-line)] bg-white px-5 pb-[var(--ds-safe-bottom)] pt-2.5 lg:hidden"
      style={{
        background: "var(--ds-color-paper)",
      }}
    >
      <TabButton label="Perfil" active={activeTab === "perfil"} onClick={onSelectPerfil}>
        <PerfilIcon />
      </TabButton>

      {/* O centro é uma ação, não uma terceira aba. O rótulo permanece no aria. */}
      <div className="flex min-w-[64px] flex-1 flex-col items-center">
        <button
          type="button"
          onClick={onPressPlus}
          aria-label="Analisar conteúdo"
          className="grid place-items-center rounded-full border-2 border-white bg-[var(--ds-color-brand)] text-white transition-transform active:scale-[0.95] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-color-brand-strong)]"
          style={{
            marginTop: -18,
            width: 52,
            height: 52,
          }}
        >
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <TabButton label="Collabs" active={activeTab === "collabs"} onClick={onSelectCollabs}>
        <CollabsIcon />
      </TabButton>
    </nav>
  );
}
