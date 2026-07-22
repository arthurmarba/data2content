"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInstagram,
  FaLock,
  FaWhatsapp,
} from "react-icons/fa";
import useInstagramStatus from "@/app/hooks/useInstagramStatus";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";

const INSTAGRAM_CONNECT_HREF =
  "/dashboard/instagram/connect?next=instagram-connection";

export default function InstagramConnectionPage() {
  const { status, isLoading, refetch } = useInstagramStatus(true);
  const billingStatus = useBillingStatus();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const { toast } = useToast();

  const handleDisconnect = async () => {
    setConfirmingDisconnect(false);
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/instagram/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao desconectar.");
      toast({ variant: "success", title: "Conta desconectada com sucesso." });
      await refetch();
    } catch {
      toast({ variant: "error", title: "Erro ao desconectar conta." });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#FAFAFB]">
        <div className="dashboard-page-shell pt-header pb-safe">
          <div className="mx-auto max-w-2xl animate-pulse space-y-5">
            <div className="h-8 w-40 rounded bg-zinc-200" />
            <div className="h-52 rounded-[28px] bg-white ring-1 ring-zinc-200" />
          </div>
        </div>
      </div>
    );
  }

  const isConnected = Boolean(status?.isConnected);
  const hasProfile = Boolean(status?.username);
  const profilePicture = status?.profilePictureUrl;
  const canUseWhatsApp = Boolean(billingStatus.hasPremiumAccess);

  const whatsAppStatus = !isConnected
    ? "Conecte o Instagram primeiro"
    : billingStatus.isLoading
      ? "Verificando acesso"
      : canUseWhatsApp
        ? "Disponível"
        : "Plano Pro";

  return (
    <div className="min-h-screen w-full bg-[#FAFAFB]">
      <main className="dashboard-page-shell py-8 sm:py-12">
        <div className="mx-auto w-full max-w-2xl">
          <header className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
              Sua conta
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-zinc-950">
              Conexões
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
              Gerencie as integrações da Meta usadas para ler suas métricas e
              entregar alertas. Você pode revogar o acesso quando quiser.
            </p>
          </header>

          <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_18px_50px_rgba(24,24,27,0.06)] ring-1 ring-zinc-200/80">
            <section className="p-5 sm:p-7" aria-labelledby="instagram-connection-title">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-50 text-[#D62E5E]">
                    <FaInstagram className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2
                      id="instagram-connection-title"
                      className="text-lg font-semibold text-zinc-950"
                    >
                      Instagram profissional
                    </h2>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Perfil, conteúdos e métricas em modo somente leitura.
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isConnected
                      ? "bg-emerald-50 text-emerald-700"
                      : hasProfile
                        ? "bg-amber-50 text-amber-700"
                        : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {isConnected
                    ? "Sincronização Ativa"
                    : hasProfile
                      ? "Reconexão necessária"
                      : "Não conectado"}
                </span>
              </div>

              {hasProfile ? (
                <div className="mt-6 flex flex-col gap-5 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center">
                  <div className="relative h-16 w-16 shrink-0">
                    <div className="h-16 w-16 overflow-hidden rounded-full bg-zinc-50 ring-1 ring-zinc-200">
                      {profilePicture ? (
                        <Image
                          src={profilePicture}
                          alt={
                            status?.username
                              ? `Foto de ${status.username}`
                              : "Foto de perfil do Instagram"
                          }
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                          sizes="64px"
                          priority
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[#D62E5E]">
                          <FaInstagram className="h-6 w-6" aria-hidden />
                        </span>
                      )}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                        isConnected ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    >
                      {isConnected ? (
                        <FaCheckCircle className="h-3 w-3 text-white" aria-hidden />
                      ) : (
                        <FaExclamationTriangle
                          className="h-3 w-3 text-white"
                          aria-hidden
                        />
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900">
                      {status?.pageName || status?.username}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-zinc-500">
                      @{status?.username}
                    </p>
                    {!isConnected ? (
                      <p className="mt-2 text-sm text-amber-700">
                        O acesso expirou. Revise as permissões antes de reconectar.
                      </p>
                    ) : null}
                  </div>

                  {!isConnected ? (
                    <Link
                      href={INSTAGRAM_CONNECT_HREF}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-black"
                    >
                      Revisar e reconectar
                      <FaArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className="mt-6 border-t border-zinc-100 pt-6">
                  <p className="text-sm leading-6 text-zinc-600">
                    É necessária uma conta Instagram Profissional ou Criador
                    vinculada a uma Página do Facebook.
                  </p>
                  <Link
                    href={INSTAGRAM_CONNECT_HREF}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#D62E5E] px-5 text-sm font-semibold text-white transition hover:bg-[#b91d4a]"
                  >
                    Revisar e conectar com a Meta
                    <FaArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                </div>
              )}

              {hasProfile && isConnected ? (
                <div className="mt-6 border-t border-zinc-100 pt-5">
                  {confirmingDisconnect ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-zinc-600">
                        Desconectar esta conta do Instagram?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmingDisconnect(false)}
                          disabled={isDisconnecting}
                          className="min-h-10 rounded-full border border-zinc-200 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDisconnect}
                          disabled={isDisconnecting}
                          className="min-h-10 rounded-full bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {isDisconnecting ? "Desconectando..." : "Sim, desconectar"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingDisconnect(true)}
                      disabled={isDisconnecting}
                      className="text-sm font-medium text-zinc-500 underline-offset-4 transition hover:text-red-600 hover:underline disabled:opacity-50"
                    >
                      Desconectar conta
                    </button>
                  )}
                </div>
              ) : null}
            </section>

            <section
              id="whatsapp"
              className="border-t border-zinc-200/80 p-5 sm:p-7"
              aria-labelledby="whatsapp-connection-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <FaWhatsapp className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2
                      id="whatsapp-connection-title"
                      className="text-lg font-semibold text-zinc-950"
                    >
                      Alertas no WhatsApp
                    </h2>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      Confirmações e alertas; as conversas com IA ficam no Chat AI.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                  {whatsAppStatus}
                </span>
              </div>

              <div className="mt-6 border-t border-zinc-100 pt-6">
                {!isConnected ? (
                  <div className="flex items-start gap-3 text-sm text-zinc-500">
                    <FaLock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      Conecte o Instagram acima para liberar alertas baseados nas
                      métricas da sua conta.
                    </p>
                  </div>
                ) : billingStatus.isLoading ? (
                  <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
                ) : canUseWhatsApp ? (
                  <div data-testid="whatsapp-connection-control">
                    <WhatsAppConnectInline />
                    <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-100 pt-4">
                      <p className="text-xs leading-5 text-zinc-500">
                        O envio do código confirma seu opt-in para receber alertas.
                      </p>
                      <Link
                        href="/dashboard/chat"
                        className="shrink-0 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950"
                      >
                        Abrir Chat AI
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-md text-sm leading-6 text-zinc-600">
                      Os alertas personalizados fazem parte do Plano Pro. A conta
                      Instagram continua conectada em modo somente leitura.
                    </p>
                    <Link
                      href="/pro"
                      className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      Ver Plano Pro
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
