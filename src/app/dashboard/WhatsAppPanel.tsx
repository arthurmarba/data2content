"use client";

import React, { useState, useEffect } from "react";
import { FaWhatsapp, FaSpinner } from "react-icons/fa"; // Adicionado FaSpinner

// O UpgradePopup não é mais necessário aqui, pois o redirecionamento é global
// e a UI do card não muda mais para uma versão "bloqueada" simples.

interface WhatsAppPanelProps {
  userId: string;             // ID do usuário logado
  canAccessFeatures: boolean; // Indica se o usuário é assinante
  onActionRedirect: () => void; // Função para redirecionar ao painel de pagamento
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void; // Função para exibir toasts
}

/**
 * Card dedicado ao WhatsApp:
 * - A UI é sempre a mesma, parecendo funcional.
 * - Se !canAccessFeatures, o botão "Abrir WhatsApp" redireciona para o painel de pagamento.
 * - Se canAccessFeatures, faz POST em /api/whatsapp/generateCode e abre o WhatsApp.
 */
export default function WhatsAppPanel({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
}: WhatsAppPanelProps) {
  // O estado de loading só é relevante para assinantes enquanto busca o código.
  // Para não assinantes, o botão sempre parecerá "pronto".
  const [isLoadingCode, setIsLoadingCode] = useState(canAccessFeatures);
  const [whatsappCode, setWhatsappCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Se não é assinante, não busca o code.
    if (!canAccessFeatures) {
      setIsLoadingCode(false); // Garante que o botão não fique em estado de loading para não assinantes.
      return;
    }

    // Lógica para buscar o código do WhatsApp para assinantes.
    async function fetchWhatsAppCode() {
      setIsLoadingCode(true); // Inicia o loading para assinantes
      setErrorMessage(""); // Limpa erros anteriores
      try {
        const res = await fetch("/api/whatsapp/generateCode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          // Trata erros da API para assinantes
          if (res.status === 401) {
            setErrorMessage("Não autenticado. Faça login novamente.");
          } else if (res.status === 403) {
            setErrorMessage("Seu plano não está ativo ou você não tem acesso a esta funcionalidade.");
          } else {
            const data = await res.json().catch(() => ({ error: "Falha ao obter código do WhatsApp (resposta não-JSON)." }));
            setErrorMessage(data.error || "Falha ao obter código do WhatsApp.");
          }
          setWhatsappCode(null); // Garante que não haja código em caso de erro
        } else {
          const data = await res.json();
          if (data.code) {
            setWhatsappCode(data.code);
          } else if (data.linked) {
            setWhatsappCode(null); // Usuário já vinculado, não precisa de código novo
          } else {
            // Caso a API retorne 200 OK mas sem 'code' ou 'linked' e sem 'error' explícito
            setErrorMessage(data.error || "Resposta inesperada ao obter código do WhatsApp.");
            setWhatsappCode(null);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar código do WhatsApp:", err);
        setErrorMessage("Falha na comunicação ao buscar código do WhatsApp. Tente novamente.");
        setWhatsappCode(null);
      } finally {
        setIsLoadingCode(false); // Finaliza o loading para assinantes
      }
    }

    fetchWhatsAppCode();
  }, [userId, canAccessFeatures]); // useEffect re-executa se canAccessFeatures mudar

  /**
   * Lida com o clique no botão "Abrir WhatsApp".
   * - Se !canAccessFeatures, previne a ação, mostra um toast e redireciona.
   * - Se canAccessFeatures, abre o WhatsApp com a mensagem apropriada.
   */
  function handleOpenWhatsAppClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (!canAccessFeatures) {
      event.preventDefault(); // Previne qualquer ação padrão do botão
      showToast("Para conversar com o IA Tuca, um plano premium é necessário. Conheça as opções!", 'info');
      onActionRedirect(); // Chama a função de redirecionamento passada pelo pai
      return;
    }

    // Lógica para assinantes
    if (isLoadingCode) return; // Não faz nada se ainda estiver carregando o código para um assinante

    if (errorMessage && !whatsappCode && !localStorage.getItem('whatsappLinkedPreviously')) {
      // Se houve um erro ao buscar o código e não há indicação de que já estava vinculado,
      // talvez seja melhor mostrar o erro ao invés de tentar abrir o WhatsApp.
      // Ou permitir abrir com a mensagem genérica. Por ora, vamos permitir.
      showToast(`Atenção: ${errorMessage}. Tentando abrir com mensagem genérica.`, 'warning');
    }
    
    const text = whatsappCode
      ? `Olá, data2content! Meu código é ${whatsappCode}`
      : "Olá, data2content! Quero receber dicas via WhatsApp."; // Mensagem genérica se não houver código (ou se já vinculado)

    const encodedText = encodeURIComponent(text);
    const whatsAppNumber = "15551767209"; // SUBSTITUA PELO NÚMERO CORRETO
    const link = `https://wa.me/${whatsAppNumber}?text=${encodedText}`;
    window.open(link, "_blank");
  }

  // A UI renderizada é sempre a mesma, baseada na sua imagem do plano ativo.
  // O comportamento do botão é o que muda com base em `canAccessFeatures`.
  return (
    <div className="border rounded-lg shadow p-4 sm:p-6 bg-white"> {/* Ajuste o bg-white/90 se necessário */}
      {/* O UpgradePopup foi removido */}

      <div className="flex items-center gap-2 mb-3">
        <FaWhatsapp className="text-green-500 w-5 h-5" />
        <h2 className="text-lg sm:text-xl font-bold text-gray-800">
          Consultor IA Tuca (WhatsApp) {/* Título como na imagem de referência do MainDashboard */}
        </h2>
      </div>

      <p className="text-sm text-gray-600 mb-4 leading-relaxed">
        Converse diretamente com nosso especialista para receber dicas e análises
        personalizadas das suas métricas do Instagram!
      </p>

      {/* Exibe a mensagem de erro somente se for um assinante e houver um erro real ao buscar o código */}
      {canAccessFeatures && errorMessage && (
        <div className="text-sm bg-red-50 p-2 rounded text-red-600 mb-3">
          {errorMessage}
        </div>
      )}

      <button
        onClick={handleOpenWhatsAppClick}
        // O botão só fica realmente desabilitado (e com estilo de loading)
        // se for um assinante e o código estiver sendo carregado.
        // Para não assinantes, ele sempre parecerá ativo, mas o onClick fará o redirecionamento.
        disabled={canAccessFeatures && isLoadingCode}
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
          flex items-center justify-center gap-2
          ${
            (canAccessFeatures && isLoadingCode)
              ? "bg-gray-400 cursor-not-allowed" // Estilo de loading para assinante
              : "bg-green-500 hover:bg-green-600" // Estilo normal/ativo
          }
        `}
      >
        {(canAccessFeatures && isLoadingCode) ? (
          <>
            <FaSpinner className="animate-spin w-4 h-4" />
            <span>Carregando...</span>
          </>
        ) : (
          "Abrir WhatsApp"
        )}
      </button>

      {/* Mantém o estilo do shimmer button, se desejar */}
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
          width: 50%; /* Ajustado para melhor efeito talvez */
          height: 100%;
          background: linear-gradient(
            100deg, /* Ajustado ângulo */
            rgba(255, 255, 255, 0) 20%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 80%
          );
          transform: skewX(-25deg); /* Ajustado skew */
          /* A animação só deve ocorrer no hover se não estiver desabilitado */
        }
        .shimmer-button:not(:disabled):hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          40% { 
            /* Ajuste para que o brilho passe mais rápido ou mais devagar */
            left: 150%;
          }
          100% {
            left: 150%;
          }
        }
      `}</style>
    </div>
  );
}
