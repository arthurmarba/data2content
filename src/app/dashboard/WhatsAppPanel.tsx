"use client";

import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSpinner } from "react-icons/fa";

interface WhatsAppPanelProps {
  userId: string;
  canAccessFeatures: boolean;
  onActionRedirect: () => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void;
}

/**
 * Card dedicado ao WhatsApp que ajusta seu comportamento e texto
 * com base no status de vinculação e no plano do usuário.
 * * - Exibe "Vincular com WhatsApp" para usuários não vinculados.
 * - Exibe "Conversar com o Tuca" para usuários já vinculados.
 * - Redireciona usuários sem plano ativo para a página de pagamento.
 */
export default function WhatsAppPanel({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
}: WhatsAppPanelProps) {
  const [isLoadingCode, setIsLoadingCode] = useState(canAccessFeatures);
  // Estado para controlar se o usuário já tem um WhatsApp vinculado.
  const [isWhatsAppLinked, setIsWhatsAppLinked] = useState(false);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Não executa a lógica se o usuário não tiver um plano ativo.
    if (!canAccessFeatures) {
      setIsLoadingCode(false);
      return;
    }

    // Função para buscar o status de vinculação do WhatsApp do usuário.
    async function fetchWhatsAppStatus() {
      setIsLoadingCode(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/whatsapp/generateCode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Envia cookies de sessão
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          setIsWhatsAppLinked(false); // Assume não vinculado em caso de erro
          if (res.status === 401) {
            setErrorMessage("Não autenticado. Faça login novamente.");
          } else if (res.status === 403) {
            setErrorMessage("Seu plano não está ativo ou você não tem acesso a esta funcionalidade.");
          } else {
            const data = await res.json().catch(() => ({ error: "Falha ao obter status do WhatsApp (resposta não-JSON)." }));
            setErrorMessage(data.error || "Falha ao obter status do WhatsApp.");
          }
          setWhatsappCode(null);
        } else {
          const data = await res.json();
          
          // Atualiza o estado com base na resposta da API.
          if (data.code) {
            setWhatsappCode(data.code);
            setIsWhatsAppLinked(false); // Usuário não vinculado, recebeu um código.
          } else if (data.linked) {
            setWhatsappCode(null);
            setIsWhatsAppLinked(true); // Usuário JÁ vinculado.
          } else {
            setIsWhatsAppLinked(false); // Assume não vinculado se a resposta for inesperada.
            setErrorMessage(data.error || "Resposta inesperada ao obter status do WhatsApp.");
            setWhatsappCode(null);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar status do WhatsApp:", err);
        setErrorMessage("Falha na comunicação ao buscar status do WhatsApp. Tente novamente.");
        setWhatsappCode(null);
        setIsWhatsAppLinked(false);
      } finally {
        setIsLoadingCode(false);
      }
    }

    fetchWhatsAppStatus();
  }, [userId, canAccessFeatures]); // Re-executa se o userId ou o status de acesso mudarem.

  /**
   * Lida com o clique no botão principal, adaptando a ação.
   */
  function handleOpenWhatsAppClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Se não tiver plano, redireciona para a página de upgrade.
    if (!canAccessFeatures) {
      event.preventDefault();
      showToast("Para conversar com o IA Tuca, um plano premium é necessário. Conheça as opções!", 'info');
      onActionRedirect();
      return;
    }

    if (isLoadingCode) return; // Não faz nada se ainda estiver carregando.

    if (errorMessage && !whatsappCode && !isWhatsAppLinked) {
      showToast(`Atenção: ${errorMessage}. Tentando abrir com mensagem genérica.`, 'warning');
    }
    
    // O texto enviado é condicional: com código para vincular, ou genérico para conversar.
    const text = whatsappCode
      ? `Olá, data2content! Meu código de verificação para vincular minha conta é: ${whatsappCode}`
      : "Olá, data2content!"; // Mensagem simples para quem já está vinculado

    const encodedText = encodeURIComponent(text);
    // Sugestão: Mover para uma variável de ambiente, ex: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
    const whatsAppNumber = "552120380975";
    const link = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    window.open(link, "_blank");
  }

  return (
    <div className="border rounded-lg shadow p-4 sm:p-6 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <FaWhatsapp className="text-green-500 w-5 h-5" />
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
          Consultor IA Tuca (WhatsApp)
        </h2>
      </div>

      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        Converse diretamente com nosso especialista para receber dicas e análises
        personalizadas das suas métricas do Instagram!
      </p>

      {canAccessFeatures && errorMessage && (
        <div className="text-sm bg-red-50 p-2 rounded text-red-600 mb-3">
          {errorMessage}
        </div>
      )}

      <button
        onClick={handleOpenWhatsAppClick}
        disabled={canAccessFeatures && isLoadingCode}
        className={`
          w-full text-center text-white py-2 rounded-lg shadow-sm text-sm font-medium
          transition shimmer-button relative overflow-hidden flex items-center justify-center gap-2
          ${
            (canAccessFeatures && isLoadingCode)
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-500 hover:bg-green-600"
          }
        `}
      >
        {/* O texto do botão agora muda dinamicamente */}
        {(canAccessFeatures && isLoadingCode) ? (
          <>
            <FaSpinner className="animate-spin w-4 h-4" />
            <span>Carregando...</span>
          </>
        ) : isWhatsAppLinked ? (
            "Conversar com o Tuca"
        ) : (
            "Vincular com WhatsApp"
        )}
      </button>

      <style jsx>{`
        /* Estilos do efeito Shimmer no botão */
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
            100deg,
            rgba(255, 255, 255, 0) 20%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 80%
          );
          transform: skewX(-25deg);
        }
        .shimmer-button:not(:disabled):hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% { left: -150%; }
          40% { left: 150%; }
          100% { left: 150%; }
        }
      `}</style>
    </div>
  );
}
