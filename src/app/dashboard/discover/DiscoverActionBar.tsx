"use client";

import Link from "next/link";
import { Instagram, Sparkles } from "lucide-react";
import { useDiscoverCtaConfig } from "./useDiscoverCtaConfig";

type DiscoverFloatingCtaProps = {
  allowedPersonalized: boolean;
};

export default function DiscoverActionBar({ allowedPersonalized }: DiscoverFloatingCtaProps) {
  const ctaConfig = useDiscoverCtaConfig(allowedPersonalized);

  if (ctaConfig.kind !== "action") return null;

  const baseClass =
    "w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-magenta px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-magenta/40 transition hover:bg-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta disabled:cursor-not-allowed disabled:opacity-75";

  const Icon =
    ctaConfig.state === "instagram_connect" || ctaConfig.state === "instagram_reconnect" ? Instagram : Sparkles;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 sm:hidden">
      <div className="pointer-events-auto">
        {ctaConfig.href ? (
          <Link href={ctaConfig.href} className={baseClass}>
            <Icon className="h-4 w-4" aria-hidden />
            {ctaConfig.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={ctaConfig.onPress}
            disabled={ctaConfig.disabled}
            className={baseClass}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {ctaConfig.label}
          </button>
        )}
        {ctaConfig.description ? (
          <p className="mt-2 text-center text-[11px] font-medium text-slate-200/90">
            {ctaConfig.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
