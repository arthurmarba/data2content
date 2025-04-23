"use client";

import React, { useState } from "react";
// Importando ícones
import {
  FaCheckCircle,
  FaLock,
  FaUserShield,
  FaSpinner,
  FaExternalLinkAlt,
  FaInfoCircle,
  FaTimesCircle,
  FaArrowRight,
  FaQuoteLeft,
  FaQuoteRight,
  FaShieldAlt,
  FaThumbsUp,
  FaWhatsapp,
} from "react-icons/fa";
// Importando Framer Motion
import { motion, AnimatePresence } from "framer-motion";

interface PaymentPanelProps {
  user: {
    planStatus?: string;
    planExpiresAt?: string | null;
    affiliateBalance?: number;
    affiliateCode?: string;
  };
}

// --- Componente auxiliar para mensagens de feedback (Estilo para Tema Claro) ---
const FeedbackMessage = ({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) => {
  const iconMap = {
    success: <FaCheckCircle className="text-green-500" />,
    error: <FaTimesCircle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
  };
  const colorMap = {
    success: 'text-green-700 bg-green-50 border-green-200',
    error: 'text-red-700 bg-red-50 border-red-200',
    info: 'text-blue-700 bg-blue-50 border-blue-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      // Usando rounded-lg
      className={`flex items-center gap-2 text-sm font-medium p-3 rounded-lg border ${colorMap[type]} mt-4`}
    >
      {iconMap[type]}
      <span>{message}</span>
    </motion.div>
  );
};


/**
 * Painel de Assinatura ou Status do Plano
 * (Versão com card de assinatura otimizado v21: Alinhado ao manual da marca)
 */
export default function PaymentPanel({ user }: PaymentPanelProps) {
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [initPoint, setInitPoint] = useState("");

  // --- Estados de plano ATIVO e PENDENTE (mantidos como antes, tema claro) ---
  if (user.planStatus === "active" || user.planStatus === "pending") {
     // ... (código para plano ativo/pendente mantido como na v19) ...
      const isPending = user.planStatus === "pending";
      const bgColor = isPending ? 'bg-yellow-50' : 'bg-green-50';
      const textColor = isPending ? 'text-yellow-800' : 'text-green-800';
      const borderColor = isPending ? 'border-yellow-200' : 'border-green-200';
      const Icon = isPending ? FaSpinner : FaCheckCircle;
      const iconColor = isPending ? 'text-yellow-600' : 'text-green-600';
      const title = isPending ? 'Pagamento Pendente' : 'Seu plano está ativo!';
      const description = isPending
        ? 'Estamos aguardando a confirmação do seu pagamento. Assim que for aprovado, seu plano será ativado automaticamente!'
        : `Acesso total liberado até: ${user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString("pt-BR") : "Data Indefinida"}`;

      return (
         // Usando rounded-2xl
         <div className={`border ${borderColor} rounded-2xl shadow-sm p-4 sm:p-6 ${bgColor} ${textColor}`}>
            <div className="flex items-center gap-3 mb-2">
               <Icon className={`w-6 h-6 ${iconColor} flex-shrink-0 ${isPending ? 'animate-spin' : ''}`} />
               <h2 className="text-lg font-semibold">{title}</h2>
           </div>
           <p className={`text-sm mb-1 ${isPending ? 'pl-9' : 'pl-9'}`}>
             {isPending ? description : <>{description.split(':')[0]}: <strong className="font-medium">{description.split(':')[1]}</strong></>}
           </p>
         </div>
       );
  }


  // --- Lógica de Assinatura (mantida como antes) ---
  async function handleSubscribe() {
    // ... (código da função handleSubscribe mantido) ...
    setLoading(true);
    setStatusMessage(null);
    setInitPoint("");

    try {
      console.log("Iniciando assinatura com código:", affiliateCodeInput || "Nenhum");
      const res = await fetch("/api/plan/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planType: "monthly",
          affiliateCode: affiliateCodeInput,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
         setStatusMessage({ message: `Erro: ${data.error || 'Falha ao iniciar assinatura.'}`, type: 'error' });
      } else {
        setStatusMessage({ message: data.message || "Link de pagamento gerado abaixo.", type: 'info' });
        if (data.initPoint) {
          setInitPoint(data.initPoint);
        }
      }
    } catch (error: unknown) {
      console.error("Erro ao processar assinatura:", error);
      let errorMsg = "Erro desconhecido ao processar assinatura.";
      if (error instanceof Error) { errorMsg = error.message; }
       setStatusMessage({ message: `Erro de rede: ${errorMsg}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // --- Variantes de Animação para Seções Gerais ---
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  // --- Lista de Benefícios (para cálculo de delay) ---
  const benefitsList = [
      "Envie métricas ILIMITADAS para análise",
      "Consultor IA Tuca 24/7 no seu WhatsApp",
      "Estratégias 100% PERSONALIZADAS para você",
      "Suporte PRIORITÁRIO via WhatsApp",
      "Acesso VIP a novas funcionalidades",
  ];

  // --- Índices de Animação Recalculados (Ordem v19) ---
  const videoIndex = 0;
  const paymentBlockIndex = 1;
  const benefitsGridIndex = 2;
  const firstBenefitCardIndex = benefitsGridIndex;
  const lastBenefitCardIndex = firstBenefitCardIndex + benefitsList.length -1;
  const testimonialIndex = lastBenefitCardIndex + 1;
  const guaranteesIndex = testimonialIndex + 1;
  const paymentLinkIndex = guaranteesIndex + 1;


  // --- Painel de Assinatura OTIMIZADO v21 ---
  return (
    // Container principal com espaçamento ajustado
    <div className="space-y-6 sm:space-y-8 font-sans">

      {/* Vídeo do YouTube (rounded-2xl) */}
      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={videoIndex}
         className="aspect-w-16 aspect-h-9 rounded-2xl overflow-hidden shadow-md border border-gray-200 ring-1 ring-black/5"
      >
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1"
          title="Vídeo Explicativo da Assinatura"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe>
      </motion.div>

      {/* --- Bloco Integrado: Preço, Cupom, Botão --- */}
      <motion.div
        variants={sectionVariants} initial="hidden" animate="visible" custom={paymentBlockIndex} // Índice 1
        // Fundo rosa sutil mantido
        className="p-5 bg-brand-pink/5 border border-brand-pink/10 rounded-2xl shadow-sm space-y-5"
      >
        {/* Seção de Preço */}
        <div className="text-center">
          <div className="mb-1">
              {/* font-semibold é adequado para subtítulo */}
              <span className="text-sm font-semibold text-brand-pink block tracking-wide uppercase">Plano Mensal Completo</span>
              <div className="flex items-baseline justify-center space-x-1 text-brand-dark mt-1">
                  <span className="text-xl font-medium">R$</span>
                  {/* Alterado para font-bold conforme manual */}
                  <span className="text-5xl font-bold tracking-tight leading-none text-brand-pink">19,90</span>
                  <span className="text-lg font-medium text-brand-dark/70">/mês</span>
              </div>
          </div>
           {/* font-regular (padrão) ou font-light para texto corrido */}
          <p className="text-xs text-brand-dark/60 mt-1.5 font-light">Cancele quando quiser, sem burocracia.</p>
        </div>

        {/* Input para Cupom de Afiliado */}
        <div className={`${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              {/* font-medium é adequado para label */}
              <label htmlFor="affiliateCodeInput" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código de Afiliado <span className="text-xs text-gray-500 font-light">(Opcional)</span>
              </label>
              <input
                id="affiliateCodeInput"
                type="text"
                value={affiliateCodeInput}
                onChange={(e) => setAffiliateCodeInput(e.target.value.toUpperCase())}
                placeholder="Insira o código aqui se tiver um"
                disabled={loading}
                className="block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition placeholder-gray-400 disabled:opacity-50 disabled:bg-gray-100"
              />
        </div>

        {/* Botão de Assinatura CTA */}
        <motion.button
          onClick={handleSubscribe}
          disabled={loading}
          whileHover={{ scale: 1.03, y: -2, boxShadow: '0 10px 20px -5px rgba(233, 30, 99, 0.4)' }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className={`
            shimmer-button
            w-full px-6 py-3.5 bg-gradient-to-br from-brand-pink to-pink-600 text-white text-lg font-bold rounded-full {/* font-bold para botão */}
            hover:shadow-xl transition-all duration-200 ease-out
            disabled:opacity-60 disabled:cursor-not-allowed
            shadow-lg flex items-center justify-center gap-2 relative overflow-hidden
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink focus:ring-opacity-70
            ${loading ? 'cursor-wait' : ''}
          `}
        >
          {loading ? (
            <> <FaSpinner className="animate-spin w-5 h-5" /> <span>Processando...</span> </>
          ) : (
            <> Quero Desbloquear Meu Acesso! <motion.span className="inline-block" transition={{ type: 'spring', stiffness: 300 }}> <FaArrowRight className="w-5 h-5 ml-1 opacity-90" /> </motion.span> </>
          )}
        </motion.button>

        {/* Mensagem de feedback e Link de Pagamento */}
        <AnimatePresence>
            {statusMessage && <FeedbackMessage message={statusMessage.message} type={statusMessage.type} />}
        </AnimatePresence>

        {initPoint && !statusMessage?.message.startsWith("Erro") && (
            <div className="mt-5 text-center">
            <a
                href={initPoint}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white text-sm font-semibold rounded-full hover:bg-green-700 transition-default shadow-sm"
            >
                <FaExternalLinkAlt className="w-3 h-3"/>
                Finalizar Pagamento Seguro
            </a>
            <p className="text-xs text-brand-dark/60 mt-2 font-light">Você será redirecionado para o Mercado Pago.</p>
            </div>
        )}

      </motion.div>
      {/* --- Fim do Bloco Integrado --- */}


      {/* Lista de Benefícios em Grid de Cards (Fundo branco) */}
      <motion.div
        variants={sectionVariants} initial="hidden" animate="visible" custom={benefitsGridIndex} // Índice 2
        className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2"
      >
        {benefitsList.map((benefit, index) => (
            <motion.div
              key={index}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              custom={firstBenefitCardIndex + index}
              // Alterado para bg-white, mantido rounded-xl
              className="flex items-start p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow ring-1 ring-black/5"
            >
              <FaCheckCircle className="text-green-500 mr-2.5 mt-0.5 flex-shrink-0" />
              {/* font-medium pode ser considerado subtítulo ou texto corrido */}
              <span className="text-base font-medium text-brand-dark/90 leading-snug" dangerouslySetInnerHTML={{ __html: benefit.replace(/ILIMITADAS|24\/7|PERSONALIZADAS|PRIORITÁRIO|VIP/g, '<strong>$&</strong>') }}></span>
            </motion.div>
        ))}
      </motion.div>

      {/* Testemunho Visual (Fundo branco) */}
      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={testimonialIndex}
         // Alterado para bg-white
         className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-center sm:text-left"
      >
            <div className="flex flex-col sm:flex-row items-center gap-4">
            <img src="https://placehold.co/48x48/E91E63/FFFFFF?text=JS" alt="Avatar Joana S." className="w-12 h-12 rounded-full flex-shrink-0 border-2 border-white shadow-md ring-1 ring-black/5"/>
            <div className="flex-grow">
              {/* font-regular (padrão) ou font-light para texto corrido */}
              <p className="font-sans text-base italic text-brand-dark/90 relative px-3 font-light">
                <FaQuoteLeft className="absolute left-0 -top-1 text-2xl text-gray-300 opacity-60" aria-hidden="true" />
                Depois que assinei, minhas métricas melhoraram e as dicas no WhatsApp
                me ajudaram a dobrar meu engajamento! Recomendo demais.
                <FaQuoteRight className="absolute right-0 -bottom-1 text-2xl text-gray-300 opacity-60" aria-hidden="true" />
              </p>
              {/* font-semibold é adequado para subtítulo */}
              <p className="mt-2.5 text-sm font-semibold text-brand-dark">Joana S.</p>
               {/* font-regular (padrão) ou font-light para texto corrido */}
              <p className="text-xs text-brand-dark/70 font-light">Criadora de Conteúdo Digital</p>
            </div>
          </div>
       </motion.div>


      {/* Seção de Confiança (Garantias - Fundo branco) */}
      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={guaranteesIndex}
         className="space-y-6 pt-6 border-t border-gray-200"
      >
        {/* Garantias e Segurança em Itens */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-sm text-brand-dark/80 flex-wrap">
             {/* Usando bg-white, mantido rounded-2xl */}
            <div className="flex flex-col items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow ring-1 ring-black/5">
                <FaShieldAlt className="w-6 h-6 text-blue-500 mb-1.5" />
                 {/* font-semibold é adequado para subtítulo */}
                <span className="font-semibold text-brand-dark leading-tight">Pagamento Seguro</span>
                 {/* font-regular (padrão) ou font-light para texto corrido */}
                <span className="text-xs text-brand-dark/70 mt-0.5 font-light">Via Mercado Pago</span>
            </div>
             <div className="flex flex-col items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow ring-1 ring-black/5">
                <FaWhatsapp className="w-6 h-6 text-green-500 mb-1.5" />
                <span className="font-semibold text-brand-dark leading-tight">Suporte Humanizado</span>
                <span className="text-xs text-brand-dark/70 mt-0.5 font-light">Via WhatsApp</span>
            </div>
             <div className="flex flex-col items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow ring-1 ring-black/5">
                <FaThumbsUp className="w-6 h-6 text-brand-pink mb-1.5" />
                <span className="font-semibold text-brand-dark leading-tight">Cancelamento Livre</span>
                <span className="text-xs text-brand-dark/70 mt-0.5 font-light">Quando quiser</span>
            </div>
        </div>
      </motion.div>

      {/* CSS para o efeito Shimmer (Mantido) */}
      <style jsx>{`
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%; /* Start off screen */
          width: 75%;
          height: 100%;
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.3) 50%, /* White shimmer, adjust opacity */
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          opacity: 0.8; /* Adjust shimmer visibility */
          animation: shimmer 2.5s infinite linear; /* Adjust duration */
        }

        /* Não aplica shimmer se o botão estiver desabilitado */
        .shimmer-button:disabled::before {
            animation: none;
            display: none;
        }

        @keyframes shimmer {
          0% {
            left: -150%;
          }
          40% { /* Control timing */
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
