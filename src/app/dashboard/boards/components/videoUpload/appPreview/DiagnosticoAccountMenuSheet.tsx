"use client";

import type { ReactNode } from "react";
import {
  CreditCard,
  ChevronRight,
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

interface Props {
  userInfo: DiagnosticoUserInfo;
  onClose: () => void;
  onOpenMediaKit: () => void;
  onOpenCommunity: () => void;
  onOpenInstagramConnection: () => void;
  onOpenBilling: () => void;
  onOpenAffiliates: () => void;
  onContactSupport?: () => void;
  onSignOut: () => void;
}

export function DiagnosticoAccountMenuSheet({
  userInfo,
  onClose,
  onOpenMediaKit,
  onOpenCommunity,
  onOpenInstagramConnection,
  onOpenBilling,
  onOpenAffiliates,
  onContactSupport,
  onSignOut,
}: Props) {
  const plan = userInfo.plan || "Free";
  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
      return;
    }
    onClose();
    window.location.href = "mailto:support@data2content.ai";
  };

  return (
    <div
      className="fixed inset-0 z-[260] flex items-end bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Conta e preferências"
        className="max-h-[calc(100dvh-env(safe-area-inset-top,0px)-1.75rem)] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight text-zinc-950">
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
          <AccountMenuAction label="Mídia Kit" onClick={onOpenMediaKit} icon={<MediaKitIcon />} />
          <AccountMenuAction label="Comunidade" onClick={onOpenCommunity} icon={<UsersRound className="h-4 w-4" strokeWidth={1.9} />} />
          <AccountMenuAction label="Conexão Instagram" onClick={onOpenInstagramConnection} icon={<Instagram className="h-4 w-4" strokeWidth={1.9} />} />
        </AccountMenuSection>

        <AccountMenuSection title="Plano">
          <AccountMenuAction label="Gerenciar assinatura" onClick={onOpenBilling} icon={<CreditCard className="h-4 w-4" strokeWidth={1.9} />} />
        </AccountMenuSection>

        <AccountMenuSection title="Suporte">
          <AccountMenuAction label="Suporte por email" onClick={handleContactSupport} icon={<LifeBuoy className="h-4 w-4" strokeWidth={1.9} />} />
          <AccountMenuAction label="Programa de Afiliados" onClick={onOpenAffiliates} icon={<Handshake className="h-4 w-4" strokeWidth={1.9} />} />
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
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-semibold text-zinc-800 hover:bg-zinc-50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
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
