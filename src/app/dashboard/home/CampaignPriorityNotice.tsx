"use client";

import Link from "next/link";
import { ArrowRight, Megaphone, X } from "lucide-react";

import { CAMPAIGNS_ROUTE } from "@/constants/routes";
import { track } from "@/lib/track";

export default function CampaignPriorityNotice({
  count,
  creatorId = null,
  onDismiss,
}: {
  count: number;
  creatorId?: string | null;
  onDismiss?: () => void;
}) {
  if (count <= 0) return null;

  const title =
    count === 1
      ? "Você recebeu uma nova proposta de campanha"
      : `Você recebeu ${count} novas propostas de campanha`;

  return (
    <aside
      className="mx-4 mt-2 flex shrink-0 flex-col gap-3 border-b border-rose-100 bg-rose-50/70 px-4 py-3 sm:mx-6 sm:flex-row sm:items-center sm:justify-between lg:mx-8 lg:mt-0 lg:px-5"
      aria-live="polite"
      aria-label="Novas propostas de campanha"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span className="relative mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 ring-1 ring-rose-100 sm:mt-0">
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-rose-50" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-zinc-950 sm:text-sm">
            {title}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
            Abra o briefing e responda à marca.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-start sm:self-auto">
        <Link
          href={`${CAMPAIGNS_ROUTE}?source=home_alert`}
          onClick={() => {
            track("campaigns_entry_clicked", {
              creator_id: creatorId,
              source: "home_alert",
              unread_count: count,
            });
          }}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
        >
          Ver briefing e responder
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dispensar aviso de novas propostas"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-rose-100/70 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </aside>
  );
}
