"use client";

import { useState, type ReactNode } from "react";
import {
  CreditCard,
  ChevronRight,
  Compass,
  FileText,
  Handshake,
  Instagram,
  LifeBuoy,
  LogOut,
  Shield,
  UsersRound,
  X,
} from "lucide-react";
import type { DiagnosticoUserInfo } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import DeleteAccountSection from "@/app/dashboard/settings/DeleteAccountSection";
import { DiagnosticoAffiliateView } from "./DiagnosticoAffiliateView";

interface Props {
  userInfo: DiagnosticoUserInfo;
  /** Drives the "Plano" section: Free → "Assinar Pro"; Pro → "Minha assinatura". */
  isPro: boolean;
  /** Drives the Instagram item status dot + label. */
  instagramConnected: boolean;
  onClose: () => void;
  onOpenMediaKit: () => void;
  onOpenCommunity: () => void;
  onOpenInstagramConnection: () => void;
  onOpenBilling: () => void;
  /** Called when a Free user taps "Assinar Pro" — opens the paywall. */
  onUpgrade: () => void;
  onContactSupport?: () => void;
  onSignOut: () => void;
  /** Fase 2 — abre a pesquisa de perfil para completar o mapa. */
  onOpenSurvey?: () => void;
  /** Fase 4 — abre a tela "Meu Norte" para editar o propósito do criador. */
  onOpenNorte?: () => void;
  /** Fase 4 — indica se o propósito ainda não foi declarado (ponto laranja). */
  hasPurpose?: boolean;
  /** Reabre diretamente a área de afiliados após o retorno do Stripe Connect. */
  initialView?: "menu" | "affiliates";
}

export function DiagnosticoAccountMenuSheet({
  userInfo,
  isPro,
  instagramConnected,
  onClose,
  onOpenMediaKit,
  onOpenCommunity,
  onOpenInstagramConnection,
  onOpenBilling,
  onUpgrade,
  onContactSupport,
  onSignOut,
  onOpenSurvey,
  onOpenNorte,
  hasPurpose = false,
  initialView = "menu",
}: Props) {
  const [view, setView] = useState<"menu" | "affiliates">(initialView);
  const plan = userInfo.plan || "Free";
  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
      return;
    }
    onClose();
    window.location.href = "mailto:support@data2content.ai";
  };

  if (view === "affiliates") {
    return (
      <div
        className="fixed inset-0 z-[260] flex items-end justify-center ds-scrim"
        role="presentation"
        onClick={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Afiliados"
          className="ds-sheet ds-enter-sheet"
          onClick={(event) => event.stopPropagation()}
        >
          <DiagnosticoAffiliateView onBack={() => setView("menu")} onClose={onClose} />
        </section>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end justify-center ds-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Conta e preferências"
        className="ds-sheet ds-enter-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="ds-sheet__handle !m-0" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.25rem] font-bold tracking-[-0.03em] text-zinc-950">
              {userInfo.name ?? "Sua conta"}
            </p>
            {userInfo.email ? (
              <p className="mt-0.5 truncate text-[12px] text-zinc-400">{userInfo.email}</p>
            ) : userInfo.handle ? (
              <p className="mt-0.5 truncate text-[12px] text-zinc-400">@{userInfo.handle.replace(/^@/, "")}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              plan === "Pro" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {plan}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar conta e preferências"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 hover:bg-zinc-200 hover:text-zinc-800"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <AccountMenuSection title="Perfil">
          {userInfo.mapProfileIncomplete && onOpenSurvey && (
            <AccountMenuAction
              label="Completar meu perfil"
              onClick={() => { onClose(); onOpenSurvey(); }}
              icon={<span className="flex h-4 w-4 items-center justify-center"><span className="h-2 w-2 rounded-full bg-orange-500" /></span>}
              emphasis
            />
          )}
          {onOpenNorte && (
            <AccountMenuAction
              label="Meu Norte"
              onClick={() => { onClose(); onOpenNorte(); }}
              icon={<Compass className="h-4 w-4" strokeWidth={1.9} />}
              statusDot={hasPurpose ? undefined : "orange"}
            />
          )}
          <AccountMenuAction label="Mídia Kit" onClick={onOpenMediaKit} icon={<MediaKitIcon />} />
          <AccountMenuAction label="Comunidade" onClick={onOpenCommunity} icon={<UsersRound className="h-4 w-4" strokeWidth={1.9} />} />
          <AccountMenuAction
            label={instagramConnected ? "Instagram conectado" : "Conectar Instagram"}
            onClick={onOpenInstagramConnection}
            icon={<Instagram className="h-4 w-4" strokeWidth={1.9} />}
            statusDot={instagramConnected ? "green" : isPro ? "orange" : undefined}
          />
        </AccountMenuSection>

        <AccountMenuSection title="Plano">
          {isPro ? (
            <AccountMenuAction label="Minha assinatura" onClick={onOpenBilling} icon={<CreditCard className="h-4 w-4" strokeWidth={1.9} />} />
          ) : (
            <AccountMenuAction label="Assinar Pro" onClick={onUpgrade} icon={<CreditCard className="h-4 w-4" strokeWidth={1.9} />} emphasis />
          )}
        </AccountMenuSection>

        <AccountMenuSection title="Suporte">
          <AccountMenuAction label="Suporte por email" onClick={handleContactSupport} icon={<LifeBuoy className="h-4 w-4" strokeWidth={1.9} />} />
          <AccountMenuAction label="Afiliados" onClick={() => setView("affiliates")} icon={<Handshake className="h-4 w-4" strokeWidth={1.9} />} />
        </AccountMenuSection>

        <AccountMenuSection title="Legal">
          <AccountMenuAction
            label="Termos e Condições"
            onClick={() => {
              onClose();
              window.open("/termos-e-condicoes", "_blank", "noopener,noreferrer");
            }}
            icon={<FileText className="h-4 w-4" strokeWidth={1.9} />}
          />
          <AccountMenuAction
            label="Política de Privacidade"
            onClick={() => {
              onClose();
              window.open("/politica-de-privacidade", "_blank", "noopener,noreferrer");
            }}
            icon={<Shield className="h-4 w-4" strokeWidth={1.9} />}
          />
        </AccountMenuSection>

        <div className="mx-5 border-t border-zinc-100" />
        <div className="px-2 py-2">
          <AccountMenuAction label="Sair da conta" onClick={onSignOut} icon={<LogOut className="h-4 w-4" strokeWidth={1.9} />} />
        </div>

        <div className="mx-5 border-t border-zinc-100" />
        <div className="px-5 py-4">
          <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
            <DeleteAccountSection onManageSubscription={onOpenBilling} />
          </div>
        </div>
      </section>
    </div>
  );
}

function AccountMenuSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mx-5 border-t border-zinc-100" />
      <div className="px-2 py-2">
        <p className="px-3 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-400">
          {title}
        </p>
        {children}
      </div>
    </>
  );
}

function AccountMenuAction({
  label,
  icon,
  onClick,
  statusDot,
  emphasis = false,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Optional status indicator dot rendered before the chevron. */
  statusDot?: "green" | "orange";
  /** Primary action styling (amber accent) — used for "Assinar Pro". */
  emphasis?: boolean;
}) {
  const iconClass = emphasis
    ? "flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ds-color-brand-soft)] text-[var(--ds-color-brand-strong)]"
    : "flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600";
  const labelClass = emphasis
    ? "min-w-0 flex-1 truncate text-[var(--ds-color-brand-strong)]"
    : "min-w-0 flex-1 truncate";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-zinc-800 hover:bg-zinc-50"
    >
      <span className={iconClass}>{icon}</span>
      <span className={labelClass}>{label}</span>
      {statusDot ? (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${statusDot === "green" ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-hidden="true"
        />
      ) : null}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

function MediaKitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6.5h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
