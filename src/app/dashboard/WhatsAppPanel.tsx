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
}

export default function WhatsAppPanel({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
}: WhatsAppPanelProps) {
  const [isLoading, setIsLoading] = useState(canAccessFeatures);
  const [isLinked, setIsLinked] = useState(false);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  // Busca o status/código ao montar (idempotente no backend)
  useEffect(() => {
    if (!canAccessFeatures) {
      setIsLoading(false);
      return;
    }

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
            // Pendente de verificação — usa o código recebido
            setWhatsappCode(data.code);
            setExpiresAt(data.expiresAt || null);
            setIsLinked(false);
          } else if (data.linked) {
            // Já vinculado — não precisa de código
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

  // Atualiza contagem regressiva do código
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("");
      return;
    }

    function updateCountdown() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("expirado");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }

    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
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

    // Se houver código (não vinculado), inclui na mensagem. Se já estiver vinculado, mensagem genérica.
    const text = whatsappCode
      ? `Olá, data2content! Meu código de verificação é: ${whatsappCode}`
      : "Olá, data2content!";
    const encodedText = encodeURIComponent(text);
    const whatsAppNumber = "552120380975";
    const link = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    window.open(link, "_blank");
  }

  const buttonText = isLinked ? "Conversar com IA" : "Vincular com WhatsApp";
  const buttonDisabled = canAccessFeatures && isLoading;

  return (
    <div className="relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="flex flex-col sm:items-end items-center gap-2">
            {isLinked && (
              <motion.span
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-300 font-medium"
              >
                <FaCheckCircle /> Conectado
              </motion.span>
            )}

            {!isLinked && whatsappCode && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-gray-50 px-3 py-1 rounded-md border border-gray-300">
                  {whatsappCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  title="Copiar código"
                  className={`p-2 rounded-md transition-all duration-200 ease-in-out ${
                    copied
                      ? "bg-green-100 text-green-600 scale-110"
                      : "bg-gray-100 text-gray-500 hover:text-green-600 hover:bg-gray-200"
                  }`}
                >
                  {copied ? <FaCheckCircle className="w-4 h-4" /> : <FaCopy className="w-4 h-4" />}
                </button>
                {timeLeft && (
                  <span
                    className={`text-xs ${
                      timeLeft === "expirado" ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {timeLeft === "expirado" ? `Código expirado` : `Expira em ${timeLeft}`}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={handleActionClick}
              disabled={buttonDisabled}
              className={`w-full sm:w-auto px-6 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2.5
                          transition-all duration-150 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg
                          ${buttonDisabled ? "bg-gray-400 cursor-wait" : "bg-green-500 hover:bg-green-600 text-white"}`}
            >
              {isLoading ? (
                <FaSpinner className="animate-spin w-5 h-5" />
              ) : (
                <FaWhatsapp className="w-5 h-5" />
              )}
              {isLoading ? "Carregando..." : buttonText}
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
