"use client";

import React, { useState } from "react";
import { useSubscription } from "@/hooks/billing/useSubscription";
import ChangePlanCard from "../billing/ChangePlanCard";
import DeleteAccountSection from "./DeleteAccountSection";
import SkeletonRow from "@/components/ui/SkeletonRow";
import ErrorState from "@/components/ui/ErrorState";
import { FaCreditCard } from "react-icons/fa";

export default function ManageSubscription() {
    const { subscription, error, isLoading } = useSubscription();
    const [isChangePlanOpen, setIsChangePlanOpen] = useState(false);

    if (isLoading) return <SkeletonRow />;
    if (error) return <ErrorState message="Erro ao carregar assinatura." />;

    const hasSubscription = !!subscription;
    const statusRaw = String(subscription?.status || '').toLowerCase();
    const isActive = statusRaw === 'active' || statusRaw === 'trialing';
    const isTrialing = statusRaw === 'trialing';

    // Format dates
    const formatDate = (date: any) => {
        if (!date) return null;
        try {
            return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(date));
        } catch {
            return null;
        }
    };

    const nextInvoiceDate = formatDate(subscription?.nextInvoiceDate);
    const trialEnd = formatDate(subscription?.trialEnd);

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#FAFAFB] p-4">
            <div className="w-full max-w-md space-y-8">

                {/* Header Minimalista */}
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900">Minha Assinatura</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Gerencie seu plano e detalhes de cobrança.
                    </p>
                </div>

                {/* Card Principal */}
                <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
                    <div className="flex flex-col items-center p-8 text-center">

                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
                            <FaCreditCard className="h-8 w-8 text-[#D62E5E]" />
                        </div>

                        {hasSubscription ? (
                            <>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    Plano {subscription.planName}
                                </h2>

                                <div className={`mt-4 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                    {isActive ? (isTrialing ? "Período de Teste" : "Assinatura Ativa") : "Inativo / Pendente"}
                                </div>

                                <p className="mt-4 text-sm text-gray-600">
                                    {isTrialing
                                        ? `Seu teste vai até ${trialEnd || 'o fim do período'}.`
                                        : isActive
                                            ? `Próxima renovação em ${nextInvoiceDate || 'breve'}.`
                                            : "Sua assinatura não está ativa no momento."
                                    }
                                </p>

                                <div className="mt-8 w-full space-y-3">
                                    <button
                                        onClick={() => setIsChangePlanOpen(true)}
                                        className="flex w-full items-center justify-center rounded-xl bg-[#D62E5E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91d4a]"
                                    >
                                        Gerenciar Plano
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-lg font-semibold text-gray-900">Nenhum plano ativo</h2>
                                <p className="mt-2 text-sm text-gray-500">
                                    Assine um plano para desbloquear todos os recursos.
                                </p>
                                <div className="mt-8 w-full">
                                    <button
                                        onClick={() => setIsChangePlanOpen(true)}
                                        className="flex w-full items-center justify-center rounded-xl bg-[#D62E5E] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#b91d4a]"
                                    >
                                        Escolher um Plano
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Zona de Perigo (Sempre visível) */}
                <div className="rounded-xl border border-red-100 bg-red-50 p-6">
                    <h3 className="mb-2 text-sm font-semibold text-red-900">Zona de Perigo</h3>
                    <p className="mb-4 text-xs text-red-700">
                        Ações irreversíveis relacionadas à sua conta.
                    </p>
                    <DeleteAccountSection />
                </div>
            </div>

            {/* Modal de Mudança de Plano */}
            {isChangePlanOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setIsChangePlanOpen(false)}
                            className="absolute right-4 top-4 z-10 rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200"
                        >
                            ✕
                        </button>
                        <div className="p-6">
                            <h2 className="mb-6 text-xl font-bold text-gray-900">Gerenciar Assinatura</h2>
                            <ChangePlanCard />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
