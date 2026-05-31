export function GlyphDiagnostico({ active }: { active: boolean }) {
  const c = active ? "#f97316" : "#71717a"; // orange-500 when active
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M3 13h3l2.5-8 3 10 2.5-6L16 13h3" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Center action button icon — video camera / analyze */
export function GlyphAnalyze() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.89L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GlyphMediaKit({ active }: { active: boolean }) {
  const c = active ? "#09090b" : "#71717a";
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="14" height="16" rx="2.5" stroke={c} strokeWidth="1.6" fill={active ? c : "none"} />
      <path d="M8 8h6M8 12h4" stroke={active ? "white" : c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
