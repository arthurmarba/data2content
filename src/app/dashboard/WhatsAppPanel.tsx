"use client";

import React, { useState, useEffect } from "react";
import { FaWhatsapp } from "react-icons/fa";

/** Popup simples para “Exclusivo para Assinantes” */
function UpgradePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full text-center">
        <h2 className="text-lg font-bold mb-3">Exclusivo para Assinantes</h2>
        <p className="text-sm text-gray-600 mb-4">
          Assine agora para desbloquear o uso do WhatsApp e aproveitar todos os benefícios!
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

interface WhatsAppPanelProps {
  userId: string;             // ID do usuário logado
  canAccessFeatures: boolean; // Indica se o usuário é assinante
}

/**
 * Card dedicado ao WhatsApp:
 * - Faz POST em /api/whatsapp/generateCode para obter o code (se assinante).
 * - Abre WhatsApp com a mensagem contendo o code, se existir.
 * - Exibe popup se não for assinante.
 */
export default function WhatsAppPanel({ userId, canAccessFeatures }: WhatsAppPanelProps) {
  const [loading, setLoading] = useState(true);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Se não é assinante, não busca o code
    if (!canAccessFeatures) {
      setLoading(false);
      return;
    }

    async function fetchWhatsAppCode() {
      try {
        // Agora usando POST em /api/whatsapp/generateCode
        const res = await fetch("/api/whatsapp/generateCode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
          credentials: "include", // Adicionado para enviar o cookie de sessão
        });
        const data = await res.json();

        if (res.ok && data.code) {
          setWhatsappCode(data.code);
        } else {
          // se vier { error: "..."}
          setErrorMessage(data.error || "Falha ao obter código do WhatsApp.");
        }
      } catch (err) {
        console.error("Erro ao buscar código do WhatsApp:", err);
        setErrorMessage("Falha ao buscar código do WhatsApp.");
      } finally {
        setLoading(false);
      }
    }

    fetchWhatsAppCode();
  }, [userId, canAccessFeatures]);

  /**
   * Abre WhatsApp com mensagem pré-preenchida.
   * - Se não for assinante, mostra popup de upgrade.
   * - Se tiver code, inclui no texto. Caso contrário, texto genérico.
   */
  function handleOpenWhatsApp() {
    if (!canAccessFeatures) {
      setShowUpgradePopup(true);
      return;
    }

    const text = whatsappCode
      ? `Olá, data2content! Meu código é ${whatsappCode}`
      : "Olá, data2content! Quero receber dicas via WhatsApp.";

    const encodedText = encodeURIComponent(text);
    // Telefone provisório: +1 555 176 7209
    const link = `https://wa.me/15551767209?text=${encodedText}`;
    window.open(link, "_blank");
  }

  return (
    <div className="border rounded-lg shadow p-4 sm:p-6 bg-white/90 relative">
      {/* Popup de upgrade se não for assinante */}
      {showUpgradePopup && (
        <UpgradePopup onClose={() => setShowUpgradePopup(false)} />
      )}

      {/* Cabeçalho (ícone + título) */}
      <div className="flex items-center gap-2 mb-3">
        <FaWhatsapp className="text-green-500 w-5 h-5" />
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
          Suporte via WhatsApp
        </h2>
      </div>

      {/* Descrição Comercial */}
      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        Converse diretamente com nosso especialista para receber dicas e análises
        personalizadas das suas métricas do Instagram!
      </p>

      {/* Exibe erro ao buscar code, se houver */}
      {errorMessage && (
        <div className="text-sm bg-red-50 p-2 rounded text-red-600 mb-3">
          {errorMessage}
        </div>
      )}

      {/* Botão principal (Abrir WhatsApp) */}
      <button
        onClick={handleOpenWhatsApp}
        disabled={loading}
        className={`
          w-full
          text-center
          text-white
          py-2
          rounded-lg
          shadow-sm
          text-sm
          font-medium
          transition
          shimmer-button
          relative
          overflow-hidden
          ${
            loading
              ? "bg-gray-300 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }
        `}
      >
        {loading ? "Carregando..." : "Abrir WhatsApp"}
      </button>

      {/* CSS do shimmer no botão */}
      <style jsx>{`
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-20deg);
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
