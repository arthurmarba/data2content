"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";

type ProfileSettingsPageProps = {
  title: string;
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  className?: string;
};

/**
 * Moldura canônica dos destinos abertos por "Conta e configurações".
 * Mantém as páginas no mesmo caderno visual do Perfil, em mobile e desktop.
 */
export function ProfileSettingsPage({
  title,
  backHref,
  onBack,
  backLabel = "Voltar ao Perfil",
  action,
  children,
  contentClassName = "max-w-2xl",
  className = "",
}: ProfileSettingsPageProps) {
  const backControl = onBack ? (
    <button type="button" onClick={onBack} aria-label={backLabel} className="ds-icon-button ds-icon-button--ghost">
      <BackIcon />
    </button>
  ) : backHref ? (
    <Link href={backHref} aria-label={backLabel} className="ds-icon-button ds-icon-button--ghost">
      <BackIcon />
    </Link>
  ) : null;

  return (
    <main
      className={`d2c-mobile-app ds-notebook min-h-[100dvh] bg-[var(--ds-color-neutral)] text-[var(--ds-color-text)] ${d2cFontVariables} ${className}`}
      data-profile-settings-page="true"
    >
      <header className="sticky top-0 z-30 border-b border-[var(--ds-color-line)] bg-[color-mix(in_srgb,var(--ds-color-surface)_94%,transparent)] backdrop-blur-md">
        <div className={`mx-auto flex min-h-[60px] items-center gap-2 px-3 sm:px-5 ${contentClassName}`}>
          {backControl}
          <h1 className="min-w-0 flex-1 truncate font-display text-[1.25rem] font-bold tracking-[-0.035em] text-[var(--ds-color-ink)]">
            {title}
          </h1>
          {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
        </div>
      </header>

      <div className={`mx-auto w-full px-4 pb-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] pt-4 sm:px-5 sm:pt-6 ${contentClassName}`}>
        {children}
      </div>
    </main>
  );
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15.5 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
