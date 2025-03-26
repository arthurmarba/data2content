"use client";

import React, { useState } from "react";
import { FaCheckCircle, FaLock, FaUserShield } from "react-icons/fa";

interface PaymentPanelProps {
  user: {
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateBalance?: number;
    affiliateCode?: string;
  };
}

export default function PaymentPanel({ user }: PaymentPanelProps) {
  const [affiliateCode, setAffiliateCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [initPoint, setInitPoint] = useState("");

  // Se o plano estiver ativo, exibe informações do plano
  if (user.planStatus === "active") {
    return (
      <div className="border rounded-lg shadow p-4 sm:p-6 bg-white/90">
        <h2 className="text-xl font-bold text-green-700 mb-2">Seu plano está ativo!</h2>
        <p className="text-sm text-gray-700 mb-1">
          Validade até:{" "}
          {user.planExpiresAt
            ? new Date(user.planExpiresAt).toLocaleDateString("pt-BR")
            : "indefinido"}
        </p>
        <p className="text-sm text-gray-700">
          Saldo de afiliado: R${user.affiliateBalance?.toFixed(2) ?? "0.00"}
        </p>
      </div>
    );
  }

  /**
   * REMOVA ou COMENTE este bloco, para não exibir o card de "Pagamento Pendente"
   * Assim, quando o status for "pending", o código cairá no else e mostrará
   * o card de assinatura + link de pagamento
   */
  // if (user.planStatus === "pending") {
  //   return (
  //     <div className="border rounded-lg shadow p-4 sm:p-6 bg-white/90">
  //       <h2 className="text-xl font-bold text-yellow-700 mb-2">Pagamento Pendente</h2>
  //       <p className="text-sm text-gray-700">
  //         Estamos aguardando a confirmação do seu pagamento.
  //         <br />
  //         Assim que for aprovado, seu plano será ativado automaticamente!
  //       </p>
  //     </div>
  //   );
  // }

  // Se o plano não está ativo (ou estiver pendente), exibe o card de assinatura
  async function handleSubscribe() {
    setLoading(true);
    setMessage("");
    setInitPoint("");

    try {
      const res = await fetch("/api/plan/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Envia cookies de sessão
        body: JSON.stringify({
          planType: "monthly",
          affiliateCode,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMessage(`Erro: ${data.error}`);
      } else {
        setMessage(data.message || "");
        if (data.initPoint) {
          setInitPoint(data.initPoint);
        }
      }
    } catch (error: unknown) {
      let errorMsg = "Erro desconhecido.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setMessage(`Erro: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-lg shadow p-4 sm:p-6 bg-white/90 relative">
      {/* Cabeçalho */}
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800">
          Assine agora e receba <br className="hidden sm:block" />
          dicas exclusivas via WhatsApp!
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Acesso completo e suporte ilimitado.
        </p>
      </div>

      {/* Vídeo explicativo */}
      <div className="aspect-w-16 aspect-h-9 mb-4 rounded-md border border-gray-200 overflow-hidden">
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/SEU_VIDEO_ID"
          title="Vídeo Explicativo"
          allowFullScreen
        />
      </div>

      {/* Card de Preço */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-4 mb-4 shadow-lg">
        <div className="text-center">
          <div className="flex items-end justify-center space-x-2 mb-2">
            <span className="text-4xl font-extrabold tracking-tight leading-none">R$19,90</span>
            <span className="text-base pb-1">/mês</span>
          </div>
          <p className="text-xs text-white/90 italic">Cancele quando quiser</p>
        </div>
      </div>

      {/* Benefícios */}
      <ul className="space-y-2 mb-4 text-sm">
        {/* ... lista de benefícios */}
      </ul>

      {/* Input de Cupom */}
      <label className="block mb-3">
        <span className="text-sm font-medium text-gray-700">
          Código de Afiliado (opcional)
        </span>
        <input
          type="text"
          value={affiliateCode}
          onChange={(e) => setAffiliateCode(e.target.value)}
          placeholder="Ex: ABC123"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500"
        />
      </label>

      {/* Botão de Assinatura */}
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className={`
          shimmer-button
          w-full
          bg-blue-600
          hover:bg-blue-700
          text-white
          font-semibold
          rounded-lg
          py-2
          transition-all
          duration-200
          ease-in-out
          transform
          hover:scale-[1.02]
          disabled:bg-gray-300
          disabled:cursor-not-allowed
          relative
          overflow-hidden
        `}
      >
        {loading ? "Processando..." : "Assinar Agora"}
      </button>

      {/* Mensagem de feedback */}
      {message && (
        <div className="mt-3 text-sm bg-gray-50 p-2 rounded text-gray-700">
          {message}
        </div>
      )}

      {/* Link de pagamento */}
      {initPoint && (
        <div className="mt-3 text-sm">
          <p className="mb-1 font-semibold text-gray-600">Link de Pagamento:</p>
          <a
            href={initPoint}
            target="_blank"
            rel="noreferrer"
            className="block text-blue-600 underline break-all"
          >
            {initPoint}
          </a>
        </div>
      )}

      {/* ... restante do card (testemunho, garantia etc.) */}

      {/* CSS para animação shimmer do botão */}
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
            rgba(255, 255, 255, 0.5) 50%,
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
