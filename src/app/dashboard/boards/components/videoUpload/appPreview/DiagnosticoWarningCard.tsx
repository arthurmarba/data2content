interface Warning { code: string; message: string }

export function DiagnosticoWarningCard({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="w-full rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-100">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-zinc-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[12px] font-semibold tracking-tight text-zinc-500">CONTEXTO</span>
      </div>
      <ul className="grid gap-1.5">
        {warnings.map((w) => (
          <li key={w.code} className="text-[14px] leading-[1.5] text-zinc-600">
            {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
