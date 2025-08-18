"use client";

import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSpinner, FaCheckCircle } from "react-icons/fa";
import { motion, AnimatePresence } from 'framer-motion';

interface WhatsAppPanelProps {
  userId: string;
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void;
}

export default function WhatsAppPanel({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
}: WhatsAppPanelProps) {
  // Estado de carregamento unificado
  const [isLoading, setIsLoading] = useState(canAccessFeatures);
  const [isLinked, setIsLinked] = useState(false);
  // Estado para armazenar o código gerado no carregamento
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  // LÓGICA ANTIGA RESTAURADA: Gera o código no carregamento do componente
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
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Falha ao obter status." }));
          setError(data.error || "Falha ao obter status do WhatsApp.");
          setIsLinked(false);
        } else {
          const data = await res.json();
          // Se a API retornar um código, armazena no estado
          if (data.code) {
            setWhatsappCode(data.code);
            setIsLinked(false);
          // Se a API retornar que já está vinculado, atualiza o estado
          } else if (data.linked) {
            setWhatsappCode(null);
            setIsLinked(true);
          } else {
            setError(data.error || "Resposta inesperada.");
            setIsLinked(false);
          }
        }
      } catch (err) {
        setError("Falha na comunicação. Tente novamente.");
        setIsLinked(false);
      } finally {
        setIsLoading(false);
      }
    }

    fetchWhatsAppStatus();
  }, [userId, canAccessFeatures]);

  // LÓGICA ANTIGA RESTAURADA: A função de clique apenas usa o código do estado
  function handleActionClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!canAccessFeatures) {
      event.preventDefault();
      showToast("Converse com o IA Mobi ativando um plano premium.", 'info');
      onActionRedirect();
      return;
    }

    if (isLoading) return;

    // Usa o código que foi gerado no carregamento da página
    const text = whatsappCode
      ? `Olá, data2content! Meu código de verificação é: ${whatsappCode}`
      : "Olá, data2content!"; // Mensagem genérica se já estiver vinculado
    const encodedText = encodeURIComponent(text);
    const whatsAppNumber = "552120380975";
    const link = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    window.open(link, "_blank");
  }

  const buttonText = isLinked ? "Conversar no WhatsApp" : "Vincular com WhatsApp";
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
                ? "Conectado! Converse para receber dicas."
                : "Conecte seu WhatsApp para falar com o Mobi."}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
          {isLinked ? (
            <div className="flex flex-col sm:items-end items-center gap-2">
              <motion.span 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-300 font-medium"
              >
                <FaCheckCircle /> Conectado
              </motion.span>
            </div>
          ) : (
            <button
              onClick={handleActionClick}
              disabled={buttonDisabled}
              className={`w-full sm:w-auto px-6 py-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2.5 
                          transition-all duration-150 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg
                          ${buttonDisabled ? 'bg-gray-400 cursor-wait' : 'bg-green-500 hover:bg-green-600 text-white'}`}
            >
              {isLoading ? <FaSpinner className="animate-spin w-5 h-5" /> : <FaWhatsapp className="w-5 h-5" />}
              {isLoading ? "Carregando..." : buttonText}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {canAccessFeatures && error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
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
          ? "Acesse o WhatsApp para receber dicas e análises personalizadas das suas métricas."
          : "Vincule sua conta para conversar diretamente com nosso especialista e otimizar seu conteúdo."}
      </p>
    </div>
  );
}
