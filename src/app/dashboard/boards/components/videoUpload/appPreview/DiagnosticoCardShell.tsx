import type { ReactNode } from "react";

const BASE =
  "w-full overflow-hidden rounded-[32px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025]";

/** Apple Health-style white card */
export function DiagnosticoCardShell({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} ${className} text-left transition-transform duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60`}
      >
        {children}
      </button>
    );
  }
  return <div className={`${BASE} ${className}`}>{children}</div>;
}

/** Apple Health card header row ─────────────────────────────────────────────
 *
 *  [■ icon bubble] [CATEGORY label]          [timestamp]  [›]
 */
export function DiagCardHeader({
  iconBg,
  iconSlot,
  category,
  catColor,
  timestamp,
  chevron = false,
}: {
  iconBg: string;
  iconSlot: ReactNode;
  category: string;
  catColor: string;
  timestamp?: string | null;
  chevron?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]`}
        aria-hidden="true"
      >
        {iconSlot}
      </div>
      <span className={`min-w-0 truncate text-[15.5px] font-bold leading-none ${catColor}`}>
        {category}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {timestamp && (
          <span className="text-[15px] font-medium text-zinc-400">{timestamp}</span>
        )}
        {chevron && <Chevron />}
      </div>
    </div>
  );
}

export function Chevron() {
  return (
    <svg
      width="8"
      height="14"
      viewBox="0 0 8 14"
      fill="none"
      aria-hidden="true"
      className="text-zinc-300"
    >
      <path
        d="M1.5 1.5L6.5 7l-5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
