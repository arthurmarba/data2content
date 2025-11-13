// /src/app/dashboard/WhatsAppPanel.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { FaWhatsapp, FaSpinner, FaCheckCircle, FaCopy } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { track } from "@/lib/track";
import { PRO_PLAN_FLEXIBILITY_COPY } from "@/app/constants/trustCopy";

interface WhatsAppPanelProps {
  userId: string;
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: "info" | "warning" | "success" | "error") => void;
  upsellOnly?: boolean; // quando true, renderiza apenas o upsell Plano Agência
}

export default function WhatsAppPanel({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
  upsellOnly = false,
}: WhatsAppPanelProps) {
  const [isLoading, setIsLoading] = useState(canAccessFeatures);
  const [isLinked, setIsLinked] = useState(false);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const gatedViewTrackedRef = useRef(false);

  useEffect(() => {
    const lockedView = !canAccessFeatures || upsellOnly;
    if (lockedView && !gatedViewTrackedRef.current) {
      track("pro_feature_locked_viewed", {
        feature: "whatsapp_panel",
        reason: upsellOnly ? "upsell_only" : "no_premium_access",
      });
      track("paywall_viewed", {
        creator_id: userId,
        context: "whatsapp_ai",
        plan: canAccessFeatures ? "pro" : "free",
      });
      gatedViewTrackedRef.current = true;
    }
    if (!lockedView) {
      gatedViewTrackedRef.current = false;
    }
  }, [canAccessFeatures, upsellOnly, userId]);

  useEffect(() => {
    if (!canAccessFeatures || upsellOnly) {
      return;
    }

    let isActive = true;
    const fetchWhatsAppStatus = async () => {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch("/api/whatsapp/generateCode", { method: "POST", credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!isActive) return;
        if (!res.ok) throw new Error((data as any)?.error || "Falha ao obter status do WhatsApp.");
        if (data.code) {
          setWhatsappCode(data.code);
          setExpiresAt(data.expiresAt || null);
          setIsLinked(false);
        } else if (data.linked) {
          setWhatsappCode(null);
          setExpiresAt(null);
          setIsLinked(true);
        } else {
          throw new Error(data.error || "Resposta inesperada.");
        }
      } catch (e: any) {
        if (!isActive) return;
        setError(e.message || "Falha na comunicação. Tente novamente.");
        setIsLinked(false);
        setWhatsappCode(null);
        setExpiresAt(null);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchWhatsAppStatus();
    return () => {
      isActive = false;
    };
  }, [canAccessFeatures, upsellOnly, userId]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("");
      return;
    }

    const updateCountdown = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("expirado");
        return;
      }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      let countdown = "";
      if (hours > 0) countdown += `${hours}h `;
      if (mins > 0) countdown += `${mins}m `;
      if (secs > 0 || (hours === 0 && mins === 0)) countdown += `${secs}s`;

      setTimeLeft(countdown.trim());
    };

    const intervalId = setInterval(updateCountdown, 1000);
    updateCountdown();
    return () => clearInterval(intervalId);
  }, [expiresAt]);

  // U P S E L L  –  quando não há acesso ou upsellOnly=true, mostra cartão de vendas Plano Agência
  if (!canAccessFeatures || upsellOnly) {
    const origin = upsellOnly ? "upsell_only" : "panel";
    const previewMessages = [
      "⏰ Hoje, 19h — pico de alcance para Reels.",
      "💡 Ideia: bastidores da produção com CTA de salvamento.",
      "⚠️ 3 dias sem postar Stories no slot forte (17h).",
    ];

    const handleStartTrial = () => {
      track("whatsapp_upsell_cta_click", { cta: "open_paywall", origin });
      onActionRedirect();
    };

    const handleViewPlans = () => {
      track("whatsapp_upsell_cta_click", { cta: "view_plans", origin });
    };

    return (
      <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex items-center gap-3">
          <FaWhatsapp className="h-10 w-10 text-emerald-500" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">WhatsApp IA Plano Agência</h3>
            <p className="text-sm text-slate-600">
              Diagnósticos e ideias no seu WhatsApp (sem disparar lembretes automáticos).
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            O que a IA faz por você
          </p>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            <li>• Diagnósticos sobre o desempenho mais recente do seu Instagram.</li>
            <li>• Ideias e prompts gerados pelo Mobi quando você precisar.</li>
            <li>• Insights conectados aos seus dados (leitura segura, sem disparos automáticos).</li>
            <li>• Histórico da conversa para consultar antes de negociar com marcas.</li>
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white px-4 py-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            <span aria-hidden>👀</span> Prévia borrada do chat
          </div>
          <div className="mt-3 space-y-2">
            {previewMessages.map((message, index) => (
              <div
                key={`${message}-${index}`}
                className="rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm blur-[2px]"
                aria-hidden="true"
              >
                {message}
              </div>
            ))}
          </div>
          <p className="sr-only">
            Prévia borrada das mensagens que você recebe no WhatsApp IA Plano Agência; disponível após assinar o Plano Agência.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Assine o Plano Agência para ver diagnósticos completos e puxar insights sob demanda sempre que precisar.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={handleStartTrial}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Ativar WhatsApp IA
          </button>
          <a
            href="/dashboard/billing"
            onClick={handleViewPlans}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            Ver planos completos
          </a>
        </div>
        <p className="text-[11px] text-slate-500">{PRO_PLAN_FLEXIBILITY_COPY}</p>
      </div>
    );
  }

  function handleCopyCode() {
    if (!whatsappCode) return;
    navigator.clipboard
      .writeText(whatsappCode)
      .then(() => {
        setCopied(true);
        showToast("Código copiado!", "success");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showToast("Falha ao copiar.", "error"));
  }

  function handleActionClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!canAccessFeatures) {
      event.preventDefault();
      showToast("Converse com a IA Mobi ativando um plano premium.", "info");
      onActionRedirect();
      return;
    }

    if (isLoading) return;

    const text = whatsappCode
      ? `Olá, data2content! Meu código de verificação é: ${whatsappCode}`
      : "Olá, data2content!";
    const encodedText = encodeURIComponent(text);
    const whatsAppNumber = "552120380975";
    const link = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    window.open(link, "_blank");
  }
  const getButtonText = () => {
    if (isLinked) return "Conversar com IA";
    if (isLoading) return "Carregando...";
    if (whatsappCode) return "Abrir WhatsApp";
    return "Vincular com WhatsApp";
  };
  
  const buttonDisabled = canAccessFeatures && isLoading;
  const buttonHasCode = !isLinked && whatsappCode;

  return (
    <div className="relative">
      <div className="flex flex-col gap-4"> 
        <div className="flex items-center gap-3">
          <FaWhatsapp className="w-10 h-10 text-green-500" />
          <div>
            <h3 className="font-semibold text-lg text-gray-800">WhatsApp IA Plano Agência</h3>
            <p className="text-sm text-gray-500 mt-1">
              Diagnósticos e ideias no seu WhatsApp (sem disparar lembretes automáticos).
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isLinked
                ? "Conectado! Clique no botão para conversar com o Mobi."
                : "Conecte seu WhatsApp para falar com o Mobi quando quiser."}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full mt-6">
        <div className="flex flex-col items-start gap-4">
          <AnimatePresence>
            {isLinked && (
              <motion.div
                key="linked"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex justify-center sm:justify-end"
              >
                <span
                  className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-300 font-medium"
                >
                  <FaCheckCircle /> Conectado
                </span>
              </motion.div>
            )}

            {buttonHasCode && (
              <motion.div
                key="verification"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-col items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-200 w-full shadow-sm"
              >
                <div className="text-left w-full">
                  <span className="font-bold text-gray-700 text-sm">
                    1. Seu código de verificação:
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Copie ou decore o código abaixo. Ele será enviado para o WhatsApp.
                  </p>
                </div>
                <div
                  onClick={handleCopyCode}
                  className="flex items-center gap-4 cursor-pointer group"
                  title="Clique para copiar"
                >
                  <span className="font-mono text-3xl font-bold tracking-wide bg-white px-6 py-4 rounded-lg border border-gray-300 shadow-sm transition-colors group-hover:border-green-400">
                    {/* CORRIGIDO: Removido o comentário que quebrava o JSX */}
                    {whatsappCode}
                  </span>
                  <div
                    className={`p-2 rounded-md transition-all duration-200 ease-in-out ${
                      copied
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-500 group-hover:text-green-600"
                    }`}
                  >
                    {copied ? <FaCheckCircle className="w-5 h-5" /> : <FaCopy className="w-5 h-5" />}
                  </div>
                </div>
                {timeLeft && (
                  <div className="text-xs text-gray-500 mt-2">
                    Código válido por <span className={`font-semibold ${timeLeft.toLowerCase().includes("expirado") ? "text-red-600" : "text-gray-600"}`}>
                      {timeLeft}
                    </span>
                  </div>
                )}
                <div className="text-left w-full mt-2">
                  <span className="font-bold text-gray-700 text-sm">
                    2. Clique e envie:
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    O código será preenchido automaticamente na mensagem do WhatsApp.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="w-full mt-6">
            <button
              onClick={handleActionClick}
              disabled={buttonDisabled}
              className={`w-full px-6 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2.5
                          transition-all duration-150 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg
                          ${buttonDisabled ? "bg-gray-400 cursor-wait" : "bg-green-500 hover:bg-green-600 text-white"}`}
            >
              {isLoading ? (
                <FaSpinner className="animate-spin w-5 h-5" />
              ) : (
                <FaWhatsapp className="w-5 h-5" />
              )}
              {isLoading ? "Carregando..." : getButtonText()}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {canAccessFeatures && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-3 border rounded-md text-xs flex items-start gap-2 text-red-600 bg-red-50 border-red-200"
            role="alert"
          >
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-xs text-gray-500 mt-4 border-t pt-3">
        {isLinked
          ? "Abra o WhatsApp e converse com a IA para receber dicas e análises personalizadas das suas métricas."
          : "Vincule sua conta para conversar diretamente com nosso especialista e otimizar seu conteúdo."}
      </p>
    </div>
  );
}
