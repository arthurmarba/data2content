import type { ReactNode } from "react";

export interface DiagnosticoListItem {
  text: string;
  summary?: string;
  count?: number;
  dot?: string;
}

export function DiagnosticoListCard({
  iconBg,
  iconSlot,
  category,
  catColor,
  badge,
  items,
  emptyText,
  footer,
}: {
  iconBg: string;
  iconSlot: ReactNode;
  category: string;
  catColor: string;
  badge?: string;
  items: DiagnosticoListItem[];
  emptyText?: string;
  /** Optional slot rendered below the item list, inside the card boundary. */
  footer?: ReactNode;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${iconBg}`} aria-hidden="true">
          {iconSlot}
        </div>
        <span className={`text-[12px] font-semibold tracking-tight ${catColor}`}>
          {category}
        </span>
        {badge && (
          <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
            {badge}
          </span>
        )}
      </div>

      {/* items */}
      {items.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] text-zinc-400 italic">
          {emptyText ?? "Nenhum item encontrado."}
        </p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 px-4 py-3 ${
                i < items.length - 1 ? "border-t border-zinc-50" : "border-t border-zinc-50"
              }`}
            >
              {item.dot && (
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.dot}`}
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-zinc-800 leading-snug">
                  {item.text}
                </span>
              </div>
              {item.count != null && (
                <span className="mt-0.5 shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                  {item.count} {item.count === 1 ? "vídeo" : "vídeos"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Optional footer slot — used for confirmation rows, etc. */}
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </div>
  );
}
