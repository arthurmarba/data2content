"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import GlassCard from "@/components/GlassCard";

export default function ChatBillingGate() {
    return (
        <div className="flex h-full w-full items-center justify-center p-4">
            <GlassCard className="max-w-md space-y-6 border border-brand-glass p-8 text-center shadow-[0_35px_90px_rgba(15,23,42,0.08)]" showGlow>
                <div className="flex justify-center">
                    <span className="rounded-2xl bg-brand-magenta-soft p-3 text-brand-primary">
                        <Sparkles className="h-6 w-6" aria-hidden />
                    </span>
                </div>

                <div className="space-y-3">
                    <h2 className="text-xl font-bold text-brand-dark">Sua plataforma de Conteúdo com IA</h2>
                    <p className="text-brand-text-secondary/90">
                        Crie roteiros virais, legendas engajadoras e estratégias completas em segundos. A IA analisa seu perfil e cria conteúdo sob medida para você.
                    </p>
                </div>

                <div className="pt-2">
                    <a
                        href="/settings/billing"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:bg-brand-primary-dark hover:shadow-brand-primary/40"
                    >
                        Ativar Plano Premium
                    </a>
                </div>

                <p className="text-xs text-brand-text-secondary/60">
                    Cancele a qualquer momento.
                </p>
            </GlassCard>
        </div>
    );
}
