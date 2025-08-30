// /src/app/dashboard/WhatsAppPanel.tsx
"use client";

import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSpinner, FaCheckCircle, FaCopy } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

interface WhatsAppPanelProps {
  userId: string;
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: "info" | "warning" | "success" | "error") => void;
  upsellOnly?: boolean; // quando true, renderiza apenas o upsell PRO
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

  // U P S E L L  –  quando não há acesso ou upsellOnly=true, mostra cartão de vendas PRO
  if (!canAccessFeatures || upsellOnly) {
    return (
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <FaWhatsapp className="w-10 h-10 text-green-500" />
          <div>
            <h3 className="font-semibold text-lg text-gray-800">WhatsApp IA PRO</h3>
            <p className="text-sm text-gray-500 mt-1">Alertas proativos, relatórios semanais e consultoria no seu WhatsApp.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>Alertas proativos de performance e oportunidades de conteúdo.</li>
            <li>Resumo semanal automático com destaques e prioridades.</li>
            <li>Atalhos de prompts para tirar dúvidas em tempo real.</li>
            <li>Integração direta com seu Instagram conectado.</li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => onActionRedirect()}
              className="flex-1 px-4 py-2.5 bg-pink-600 text-white rounded-lg text-sm font-semibold hover:bg-pink-700 transition-colors"
            >
              Fazer upgrade para PRO
            </button>
            <a
              href="/dashboard/billing"
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 border border-gray-200 text-center"
            >
              Ver planos e preços
            </a>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    // fluxo funcional apenas para quem tem acesso
    if (!canAccessFeatures) return;
    setIsLoading(true);

    async function fetchWhatsAppStatus() {
      setIsLoading(true);
      setError("");
      try {
        const res = await fetch("/api/whatsapp/generateCode", {
          method: "POST",
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError((data as any)?.error || "Falha ao obter status do WhatsApp.");
          setIsLinked(false);
          setWhatsappCode(null);
          setExpiresAt(null);
        } else {
          if (data.code) {
            setWhatsappCode(data.code);
            setExpiresAt(data.expiresAt || null);
            setIsLinked(false);
          } else if (data.linked) {
            setWhatsappCode(null);
            setExpiresAt(null);
            setIsLinked(true);
          } else {
            setError(data.error || "Resposta inesperada.");
            setIsLinked(false);
            setWhatsappCode(null);
            setExpiresAt(null);
          }
        }
      } catch {
        setError("Falha na comunicação. Tente novamente.");
        setIsLinked(false);
        setWhatsappCode(null);
        setExpiresAt(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWhatsAppStatus();
  }, [userId, canAccessFeatures]);

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
            <h3 className="font-semibold text-lg text-gray-800">Whatsapp IA</h3>
            <p className="text-sm text-gray-500 mt-1">
              {isLinked
                ? "Conectado! Clique no botão para conversar."
                : "Conecte seu WhatsApp para falar com o Mobi."}
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
