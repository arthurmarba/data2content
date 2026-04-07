"use client";

import React, { useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  FaCreditCard, 
  FaSignOutAlt, 
  FaLink, 
  FaFileContract, 
  FaShieldAlt, 
  FaEnvelope, 
  FaHandshake, 
  FaChevronRight,
  FaChevronLeft,
  FaUserCircle
} from "react-icons/fa";
import SubscriptionCard from "@/components/billing/SubscriptionCard";
import ChangePlanCard from "@/app/dashboard/billing/ChangePlanCard";
import DeleteAccountSection from "./DeleteAccountSection";
import { UserAvatar } from "@/app/components/UserAvatar";

export default function ManageSubscription() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

  const listItemClass = "flex w-full items-center justify-between gap-3 rounded-xl border border-transparent bg-white px-4 py-3.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-200 hover:bg-slate-50";
  const sectionTitleClass = "mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400";

  return (
    <div className="h-full w-full overflow-y-auto bg-[#FAFAFB] dashboard-scrollbar">
      {/* Header com Botão Voltar */}
      <div className="sticky top-0 z-[100] flex items-center justify-between bg-white/80 px-4 py-4 backdrop-blur-xl border-b border-slate-100 sm:hidden">
        <button 
          onClick={() => router.push("/dashboard/media-kit")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition active:scale-95"
          aria-label="Voltar para Perfil"
        >
          <FaChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-bold text-slate-900">Configurações</span>
        <div className="w-9" /> {/* Spacer */}
      </div>

      <div className="dashboard-page-shell flex min-h-screen items-start justify-center pt-[var(--sat,1.5rem)] sm:items-center sm:pt-0">
        <div className="w-full max-w-md space-y-9 pt-4 sm:pb-16 sm:pt-8">
          
          {/* Perfil Simplificado */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 overflow-hidden rounded-full ring-4 ring-white shadow-xl">
              <UserAvatar src={user?.image} name={user?.name || "Usuário"} size={80} className="h-20 w-20" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{user?.name || "Minha Conta"}</h1>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>

          <div className="space-y-6">
            {/* Seção: Plano & Assinatura */}
            <section>
              <h2 className={sectionTitleClass}>Plano & Assinatura</h2>
              <div className="space-y-2">
                <SubscriptionCard onChangePlan={() => setIsChangePlanOpen(true)} />
              </div>
            </section>

            {/* Seção: Conexões */}
            <section>
              <h2 className={sectionTitleClass}>Conexões & Integrações</h2>
              <Link href="/dashboard/instagram-connection" className={listItemClass}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-500">
                    <FaLink className="h-4 w-4" />
                  </div>
                  <span>Conexão Instagram</span>
                </div>
                <FaChevronRight className="h-3 w-3 text-slate-300" />
              </Link>
            </section>

            {/* Seção: Suporte & Legal */}
            <section>
              <h2 className={sectionTitleClass}>Suporte & Legal</h2>
              <div className="space-y-2">
                <a 
                  href="mailto:support@data2content.ai" 
                  className={listItemClass}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                      <FaEnvelope className="h-4 w-4" />
                    </div>
                    <span>Suporte por Email</span>
                  </div>
                  <FaChevronRight className="h-3 w-3 text-slate-300" />
                </a>

                <Link href="/afiliados" className={listItemClass}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
                      <FaHandshake className="h-4 w-4" />
                    </div>
                    <span>Programa de Afiliados</span>
                  </div>
                  <FaChevronRight className="h-3 w-3 text-slate-300" />
                </Link>

                <Link href="/termos-e-condicoes" target="_blank" className={listItemClass}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <FaFileContract className="h-4 w-4" />
                    </div>
                    <span>Termos e Condições</span>
                  </div>
                  <FaChevronRight className="h-3 w-3 text-slate-300" />
                </Link>

                <Link href="/politica-de-privacidade" target="_blank" className={listItemClass}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <FaShieldAlt className="h-4 w-4" />
                    </div>
                    <span>Política de Privacidade</span>
                  </div>
                  <FaChevronRight className="h-3 w-3 text-slate-300" />
                </Link>
              </div>
            </section>

            {/* Seção: Conta */}
            <section>
              <h2 className={sectionTitleClass}>Conta</h2>
              <div className="space-y-4">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:text-red-600"
                >
                  <FaSignOutAlt className="h-4 w-4" />
                  Sair da conta
                </button>

                {/* Zona de Perigo */}
                <div className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
                  <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-red-900">Zona de Perigo</h3>
                  <p className="mb-4 text-xs text-red-700/80 leading-relaxed">
                    Ações irreversíveis. Excluir sua conta removerá todos os seus dados permanentemente.
                  </p>
                  <DeleteAccountSection />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Modal de Mudança de Plano */}
      {isChangePlanOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="dashboard-scrollbar relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsChangePlanOpen(false)}
              className="absolute right-5 top-5 z-10 rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            >
              ✕
            </button>
            <div className="p-8">
              <h2 className="mb-8 text-2xl font-bold text-slate-900">Gerenciar Assinatura</h2>
              <ChangePlanCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
