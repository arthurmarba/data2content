"use client";

import React, { useState, useEffect } from "react";
// Importando ícones
import {
  FaCheckCircle,
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
  FaUserFriends,
  FaLock,
  FaChevronDown,
  FaChevronUp,
  FaCalendar,
  FaCalendarAlt,
} from "react-icons/fa";
// Importando Framer Motion
import { motion, AnimatePresence } from "framer-motion";
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
} from "@/config/pricing.config";
import type { PlanStatus } from '@/types/enums';

interface PaymentPanelProps {
  user: {
    planStatus?: PlanStatus;
    planExpiresAt?: string | null;
    affiliateBalance?: number;
    affiliateCode?: string;
  };
}

const AFFILIATE_REF_KEY = 'affiliateRefCode';
const AGENCY_INVITE_KEY = 'agencyInviteCode';
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// Componente FAQItem com visual aprimorado
const FAQItem = ({ question, answer }: { question: string; answer: string | React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    // Cada item do FAQ agora tem um fundo e sombra para parecer um "mini-card"
    <div className="bg-white rounded-lg shadow-sm mb-3 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full py-4 px-5 text-left text-gray-700 hover:bg-pink-50/50 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink focus-visible:ring-opacity-75"
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${question.replace(/\s+/g, '-')}`}
      >
        <span className="font-semibold text-sm sm:text-base text-brand-dark group-hover:text-brand-pink">{question}</span>
        {isOpen ? (
          <FaChevronUp className="w-5 h-5 text-brand-pink transform transition-transform duration-200" />
        ) : (
          <FaChevronDown className="w-5 h-5 text-gray-400 group-hover:text-brand-pink transform transition-transform duration-200" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`faq-answer-${question.replace(/\s+/g, '-')}`}
            initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: '0.5rem', marginBottom: '1rem' }}
            exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4 px-5 text-gray-600 text-sm leading-relaxed"> {/* Aumentado padding horizontal */}
              {typeof answer === 'string' ? <p>{answer}</p> : answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


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
      className={`flex items-center gap-2 text-sm font-medium p-3 rounded-xl border ${colorMap[type]} mt-4`}
      role="alert"
    >
      {iconMap[type]}
      <span>{message}</span>
    </motion.div>
  );
};

export default function PaymentPanel({ user }: PaymentPanelProps) {
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [isAffiliateCodeValid, setIsAffiliateCodeValid] = useState(true);
  const [affiliateCodeError, setAffiliateCodeError] = useState<string | null>(null);
  const [agencyInviteCode, setAgencyInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [initPoint, setInitPoint] = useState("");
  const [refCodeAppliedMessage, setRefCodeAppliedMessage] = useState<string | null>(null);
  const [agencyMessage, setAgencyMessage] = useState<string | null>(null);
  const [ctaClicked, setCtaClicked] = useState(false);
  const [planType, setPlanType] = useState<'monthly' | 'annual'>('annual');

  const originalMonthlyPrice = agencyInviteCode ? AGENCY_GUEST_MONTHLY_PRICE : MONTHLY_PRICE;
  const discountedMonthlyPrice = agencyInviteCode
    ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE
    : ANNUAL_MONTHLY_PRICE;
  const totalAnnualPrice = discountedMonthlyPrice * 12;
  const originalAnnualPrice = originalMonthlyPrice * 12;
  const discountPercentage = Math.round(
    ((originalAnnualPrice - totalAnnualPrice) / originalAnnualPrice) * 100
  );
  const savingsAmount = originalAnnualPrice - totalAnnualPrice;
  const selectedMonthlyPrice =
    planType === 'annual' ? discountedMonthlyPrice : originalMonthlyPrice;
  const totalPrice = planType === 'annual' ? totalAnnualPrice : selectedMonthlyPrice;
  const formattedTotalPrice = currencyFormatter.format(totalPrice);
  const formattedTotalPriceWithoutSymbol = formattedTotalPrice.replace('R$', '').trim();

  useEffect(() => {
    async function loadFromStorage() {
      if (typeof window === 'undefined') return;
      const storedRefDataString = localStorage.getItem(AFFILIATE_REF_KEY);
      if (storedRefDataString) {
        try {
          const storedRefData = JSON.parse(storedRefDataString);
          if (storedRefData && storedRefData.code && storedRefData.expiresAt) {
            if (Date.now() < storedRefData.expiresAt) {
              const codeFromStorage = String(storedRefData.code).toUpperCase();
              setAffiliateCodeInput(codeFromStorage);
              setRefCodeAppliedMessage(`Código de indicação ${codeFromStorage} aplicado! Você receberá um desconto.`);
              setIsAffiliateCodeValid(true);
              setAffiliateCodeError(null);
            } else {
              localStorage.removeItem(AFFILIATE_REF_KEY);
            }
          } else {
             localStorage.removeItem(AFFILIATE_REF_KEY);
          }
        } catch (error) {
          console.error('[PaymentPanel] Erro ao processar dados de referência do localStorage:', error);
          localStorage.removeItem(AFFILIATE_REF_KEY);
        }
      }

      const storedAgency = localStorage.getItem(AGENCY_INVITE_KEY);
      if (storedAgency) {
        try {
          const data = JSON.parse(storedAgency);
          if (data && data.code && data.expiresAt && Date.now() < data.expiresAt) {
            setAgencyInviteCode(String(data.code));
            try {
              const res = await fetch(`/api/agency/info/${data.code}`);
              if (res.ok) {
                const info = await res.json();
                setAgencyMessage(`Convite da agência ${info.name} aplicado!`);
              } else {
                setAgencyMessage(`Convite de agência ${data.code} aplicado!`);
              }
            } catch {
              setAgencyMessage(`Convite de agência ${data.code} aplicado!`);
            }
          } else {
            localStorage.removeItem(AGENCY_INVITE_KEY);
          }
        } catch (error) {
          console.error('[PaymentPanel] Erro ao processar invite de agência:', error);
          localStorage.removeItem(AGENCY_INVITE_KEY);
        }
      }
    }
    loadFromStorage();
  }, []);

  const isPending = user.planStatus === "pending";
  const isActive = user.planStatus === "active";

  if (isActive) {
      const bgColor = 'bg-green-50';
      const textColor = 'text-green-800';
      const borderColor = 'border-green-300';
      const IconComponent = FaCheckCircle;
      const iconColor = 'text-green-600';
      const title = 'Seu plano está ativo!';
      const description = `Acesso total liberado até: ${user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString("pt-BR") : "Data Indefinida"}`;
      const nextStep = 'Agora conecte sua conta do Instagram e conclua o onboarding.';

      return (
         <div className={`border ${borderColor} rounded-xl shadow-sm p-4 sm:p-6 ${bgColor} ${textColor}`}>
            <div className="flex items-center gap-3 mb-2">
               <IconComponent className={`w-6 h-6 ${iconColor} flex-shrink-0`} />
               <h2 className="text-lg font-semibold">{title}</h2>
           </div>
           <p className="text-sm mb-1 pl-9">
             {description.split(':')[0]}: <strong className="font-medium">{description.split(':')[1]}</strong>
           </p>
           <p className="text-sm mt-2 pl-9">{nextStep}</p>
         </div>
       );
  }

  async function handleSubscribe() {
    setCtaClicked(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    setLoading(true);
    setStatusMessage(null);
    setInitPoint("");
    setIsAffiliateCodeValid(true);
    setAffiliateCodeError(null);
    try {
      const res = await fetch("/api/plan/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planType,
          affiliateCode: affiliateCodeInput.trim() === "" ? undefined : affiliateCodeInput.trim(),
          agencyInviteCode: agencyInviteCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (
          data.error &&
          (data.error.toLowerCase().includes('afiliado') || data.error.toLowerCase().includes('cupom'))
        ) {
          setIsAffiliateCodeValid(false);
          setAffiliateCodeError(data.error);
        }
        setStatusMessage({ message: `Erro: ${data.error || 'Falha ao iniciar assinatura.'}`, type: 'error' });
      } else {
        setIsAffiliateCodeValid(true);
        setAffiliateCodeError(null);
        setStatusMessage({ message: data.message || "Link de pagamento gerado abaixo. Você será redirecionado.", type: 'info' });
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
      setCtaClicked(false);
    }
  }

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" }
    })
  };

  const benefitsList: string[] = [
      "Análises ILIMITADAS de métricas (via upload ou automação Instagram)",
      "Consultor IA Mobi 24/7 no seu WhatsApp para insights e planejamentos",
      "Estratégias de conteúdo 100% PERSONALIZADAS para seus objetivos",
      "Suporte PRIORITÁRIO individualizado via WhatsApp",
      "Acesso VIP a todas as novas funcionalidades e atualizações da plataforma",
  ];

  const testimonials = [
    {
      id: 1,
      name: "Joana S.",
      role: "Criadora de Conteúdo Digital",
      avatar: "https://placehold.co/60x60/E91E63/FFFFFF?text=JS", // ATUALIZAR
      quote: "Depois que assinei, minhas métricas melhoraram e as dicas no WhatsApp me ajudaram a dobrar meu engajamento! O IA Mobi é incrível. Recomendo demais.", // ATUALIZAR
      profileLink: null
    },
  ];
  const currentTestimonial = testimonials[0];

  const faqItems = [
    {
      question: "Como funciona o cancelamento?",
      answer: "Você pode cancelar sua assinatura a qualquer momento, diretamente no seu painel de configurações. Sem burocracia ou taxas extras. Seu acesso continuará ativo até o final do período já pago."
    },
    {
      question: "O pagamento é seguro?",
      answer: "Sim! Utilizamos o Mercado Pago, uma das plataformas de pagamento mais seguras e confiáveis da América Latina. Seus dados financeiros são processados diretamente por eles e não ficam armazenados em nossos servidores."
    },
    {
      question: "Quais formas de pagamento são aceitas?",
      answer: "Através do Mercado Pago, você pode pagar com cartão de crédito (principais bandeiras), Pix, boleto bancário e saldo em conta Mercado Pago."
    },
    {
      question: "Como o IA Mobi me ajuda na prática?",
      answer: (
        <>
          <p className="mb-2">O IA Mobi é seu consultor de marketing digital pessoal. Ele pode:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Analisar o desempenho dos seus posts do Instagram (métricas de alcance, engajamento, etc.).</li>
            <li>Gerar relatórios com insights sobre o que funciona melhor para sua audiência.</li>
            <li>Criar planejamentos de conteúdo personalizados (posts, Stories, Reels).</li>
            <li>Sugerir horários ideais para postar.</li>
            <li>Ajudar a definir e acompanhar seus objetivos de marketing.</li>
            <li>Fornecer dicas e conhecimentos sobre o ecossistema do Instagram.</li>
          </ul>
          <p className="mt-2">Tudo isso através de uma conversa didática e proativa no WhatsApp!</p>
        </>
      )
    },
    {
        question: "Preciso conectar minha conta do Instagram?",
        answer: "Para análises automáticas e insights mais profundos, recomendamos conectar sua conta profissional do Instagram. No entanto, você também pode enviar prints das suas métricas manualmente para análise pelo IA Mobi."
    }
  ];

  const videoIndex = 0;
  const paymentBlockIndex = 1;
  const benefitsGridIndex = 2;
  const faqIndex = benefitsGridIndex + benefitsList.length;
  const testimonialIndex = faqIndex + 1;
  const guaranteesIndex = testimonialIndex + 1;

  return (
    <div className="space-y-8 sm:space-y-10 font-sans">
      {isPending && (
        <div className={`border border-yellow-300 rounded-xl shadow-sm p-4 sm:p-6 bg-yellow-50 text-yellow-800`}>
          <div className="flex items-center gap-3 mb-2">
            <FaSpinner className="w-6 h-6 text-yellow-600 flex-shrink-0 animate-spin" />
            <h2 className="text-lg font-semibold">Pagamento Pendente</h2>
          </div>
          <p className="text-sm mb-1 pl-9">
            Estamos aguardando a confirmação do seu pagamento. Assim que for aprovado, seu plano será ativado automaticamente!
          </p>
          <p className="text-sm mt-2 pl-9">
            Assim que confirmado, conecte sua conta do Instagram para liberar todos os recursos.
          </p>
        </div>
      )}
      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={videoIndex}
      >
        <h2 className="text-2xl font-semibold text-brand-dark mb-4 text-center sm:text-left" id="video-explicativo-title">
          Transforme Seus Dados em <span className="text-brand-pink">Resultados Reais!</span>
        </h2>
        <div className="aspect-w-16 aspect-h-9 rounded-xl overflow-hidden shadow-lg border border-gray-200 ring-1 ring-black/5">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/watch?v=n5E_hLThxEA" // ATUALIZAR VIDEO_ID_PLACEHOLDER
            title="Vídeo Explicativo da Assinatura Data2Content"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            aria-labelledby="video-explicativo-title"
          ></iframe>
        </div>
      </motion.div>

      <div className="space-y-8 sm:space-y-10 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-8">
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          custom={paymentBlockIndex}
          role="region"
          aria-labelledby="plano-title"
        >
        <motion.div
          className="relative p-[1px] rounded-2xl bg-gradient-to-r from-brand-pink via-brand-dark to-brand-pink animate-[spin_6s_linear_infinite]"
          whileHover={{ scale: 1.02, rotate: 0.2 }}
          transition={{ type: 'spring', stiffness: 150 }}
        >
          <div className="rounded-2xl bg-white dark:bg-brand-dark p-6 shadow-lg space-y-6">
            <div className="text-center">
          <h3 id="plano-title" className="text-xl sm:text-2xl font-bold text-brand-pink mb-1 tracking-wide uppercase">
            Plano {planType === 'annual' ? 'Anual' : 'Mensal'} Data2Content Completo
          </h3>
          <fieldset className="mt-3">
            <legend className="text-sm font-medium text-brand-dark mb-2">Tipo de plano</legend>
            <div className="flex justify-center gap-4">
              <motion.button
                type="button"
                onClick={() => setPlanType('monthly')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                  planType === 'monthly'
                    ? 'bg-brand-pink text-brand-light border-brand-pink'
                    : 'bg-brand-light text-brand-pink border-brand-pink'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 150 }}
              >
                <FaCalendar className="w-4 h-4" />
                <span className="flex flex-col items-start">
                  <span className="text-sm">Mensal</span>
                  <span className="text-sm text-gray-600">
                    R$ {currencyFormatter.format(originalMonthlyPrice)} / mês
                  </span>
                </span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setPlanType('annual')}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
                  planType === 'annual'
                    ? 'bg-brand-pink text-brand-light border-brand-pink'
                    : 'bg-brand-light text-brand-pink border-brand-pink'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 150 }}
              >
                <FaCalendarAlt className="w-4 h-4" />
                <span className="flex flex-col items-start">
                  <span className="text-sm">Anual</span>
                  <span className="text-sm text-gray-600">
                    R$ {currencyFormatter.format(discountedMonthlyPrice)} / mês (cobrança anual)
                  </span>
                </span>
                <span className="absolute bg-brand-pink text-white text-xs px-2 py-0.5 rounded-full -top-2 -right-2">
                  Mais vantajoso
                </span>
              </motion.button>
            </div>
          </fieldset>
          <div className="flex items-baseline justify-center space-x-1 text-brand-dark mt-2">
              <span className="text-2xl font-medium">R$</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={planType}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="text-6xl font-extrabold tracking-tight leading-none text-brand-pink"
                >
                  <span className="font-mono tabular-nums">{formattedTotalPriceWithoutSymbol}</span>
                </motion.span>
              </AnimatePresence>
              <span className="text-xl font-medium text-brand-dark/80">{planType === 'annual' ? '/ano' : '/mês'}</span>
              <AnimatePresence mode="wait">
                {planType === 'annual' && (
                  <motion.span
                    key={planType}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="ml-2 flex items-center gap-2"
                  >
                    <span className="text-sm line-through text-brand-dark/50">
                      R$ {originalAnnualPrice.toFixed(2).replace('.', ',')}
                    </span>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={planType}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="bg-brand-pink text-brand-light text-xs font-semibold px-2 py-0.5 rounded"
                      >
                        -{discountPercentage}%
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                )}
              </AnimatePresence>
          </div>
          {planType === 'annual' && (
            <span className="text-sm text-gray-600">
              Equivale a {currencyFormatter.format(discountedMonthlyPrice)} / mês
            </span>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cobrança anual única. Cancelamento a qualquer momento.
          </p>
          <p className="text-sm text-brand-dark/70 mt-2 font-light">
            {planType === 'annual'
              ? `Economize R$ ${savingsAmount.toFixed(2).replace('.', ',')} (${discountPercentage}%) com 12 meses de acesso completo.`
              : 'Investimento mínimo, resultados máximos. Cancele quando quiser.'}
          </p>
        </div>

        <div className={`${loading || ctaClicked ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="relative">
                <input
                  id="affiliateCodeInputPayment"
                  type="text"
                  value={affiliateCodeInput}
                  onChange={(e) => {
                      setAffiliateCodeInput(e.target.value.toUpperCase());
                      setIsAffiliateCodeValid(true);
                      setAffiliateCodeError(null);
                      if (refCodeAppliedMessage) {
                          setRefCodeAppliedMessage(null);
                      }
                  }}
                  placeholder=" "
                  disabled={loading || ctaClicked}
                  className={`peer w-full bg-white border ${isAffiliateCodeValid ? 'border-gray-300' : 'border-red-500 text-red-700'} rounded-lg px-3 py-2 text-brand-dark placeholder:text-sm placeholder:text-gray-500 focus:border-brand-pink focus:ring-brand-pink disabled:opacity-50 disabled:bg-gray-100`}
                  aria-describedby="ref-code-message"
                  aria-invalid={!isAffiliateCodeValid}
                />
                <label
                  htmlFor="affiliateCodeInputPayment"
                  className="absolute left-3 top-2 text-xs text-gray-500 transition-all peer-focus:-top-2 peer-focus:text-[10px] peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-xs"
                >
                  Código de Afiliado <span className="font-light">(Opcional)</span>
                </label>
              </div>
              <div id="ref-code-message" aria-live="polite">
                {!isAffiliateCodeValid && affiliateCodeError && !loading && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
                    <FaTimesCircle className="w-3.5 h-3.5" />
                    {affiliateCodeError}
                  </p>
                )}
                {isAffiliateCodeValid && refCodeAppliedMessage && !loading && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
                    <FaCheckCircle className="w-3.5 h-3.5"/>
                    {refCodeAppliedMessage}
                  </p>
                )}
                {agencyMessage && !loading && (
                  <p className="mt-2 text-sm text-gray-500 flex items-center gap-1.5">
                    <FaCheckCircle className="w-3.5 h-3.5"/>
                    {agencyMessage}
                  </p>
                )}
              </div>
        </div>

        <motion.button
          onClick={handleSubscribe}
          disabled={loading || ctaClicked}
          whileHover={!(loading || ctaClicked) ? { scale: 1.02, y: -1, boxShadow: '0 12px 25px -8px rgba(233, 30, 99, 0.5)' } : {}}
          whileTap={!(loading || ctaClicked) ? { scale: 0.97 } : {}}
          transition={{ type: "spring", stiffness: 350, damping: 17 }}
          className={`relative w-full px-6 py-4 bg-white border border-brand-pink text-brand-dark text-lg font-bold rounded-full hover:bg-brand-pink/10 transition-all duration-200 ease-out disabled:opacity-60 disabled:cursor-not-allowed shadow-xl flex items-center justify-center gap-2 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-brand-pink ${(loading || ctaClicked) ? 'cursor-wait' : ''}`}
          aria-label={`Assinar o plano ${planType === 'annual' ? 'Anual' : 'Mensal'} Data2Content Completo por ${formattedTotalPrice} ${planType === 'annual' ? 'por ano' : 'por mês'}`}
        >
          <span className="absolute inset-0 rounded-full overflow-hidden">
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_infinite]"></span>
          </span>
          {loading ? (
            <>
              <FaSpinner className="animate-spin w-5 h-5" />
              <span>PROCESSANDO...</span>
            </>
          ) : ctaClicked ? (
            <>
              <FaCheckCircle className="w-5 h-5" />
              <span>AGUARDE...</span>
            </>
          ) : (
            <>
              <FaArrowRight className="w-5 h-5 opacity-90" />
              <span>{planType === 'annual' ? 'QUERO O PLANO ANUAL!' : 'QUERO O PLANO MENSAL!'}</span>
            </>
          )}
        </motion.button>

        <AnimatePresence>
            {statusMessage && <FeedbackMessage message={statusMessage.message} type={statusMessage.type} />}
        </AnimatePresence>

        {initPoint && !statusMessage?.message.startsWith("Erro") && (
            <div className="mt-6 text-center">
            <a
                href={initPoint}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-8 py-3 bg-green-600 text-brand-light text-base font-semibold rounded-full hover:bg-green-700 transition-default shadow-md hover:shadow-lg"
                aria-label="Finalizar pagamento seguro no Mercado Pago"
            >
                <FaExternalLinkAlt className="w-4 h-4"/>
                Finalizar Pagamento Seguro
            </a>
            <p className="text-xs text-brand-dark/70 mt-2.5 font-light">
              (Você será redirecionado para um ambiente seguro do Mercado Pago)
            </p>
            </div>
        )}
          </div>
        </motion.div>
      </motion.div>
        <div className="space-y-8 sm:space-y-10">
          <motion.div
            variants={sectionVariants} initial="hidden" animate="visible" custom={benefitsGridIndex}
            className="pt-4"
            role="region"
            aria-labelledby="beneficios-title"
          >
            <h3 id="beneficios-title" className="text-xl font-semibold text-brand-dark mb-5 text-center sm:text-left">O que você ganha ao assinar:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benefitsList.map((benefit, index) => (
                  <motion.div
                    key={index}
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    custom={benefitsGridIndex + index * 0.1}
                    className="flex items-start p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow ring-1 ring-black/5"
                    whileHover={{ scale: 1.03 }}
                  >
                    <FaCheckCircle aria-hidden="true" className="text-green-500 mr-3 mt-1 flex-shrink-0 w-5 h-5" />
                    <span className="text-base font-medium text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: benefit.replace(/ILIMITADAS|24\/7|PERSONALIZADAS|PRIORITÁRIO|VIP/g, '<strong class=\"text-brand-pink\">$&</strong>') }}></span>
                  </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={sectionVariants} initial="hidden" animate="visible" custom={faqIndex}
            className="pt-6 pb-4"
            role="region"
            aria-labelledby="faq-title"
          >
            <h3 id="faq-title" className="text-xl font-semibold text-brand-dark mb-6 text-center">Perguntas Frequentes (FAQ)</h3>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2 sm:p-4 space-y-2">
              {faqItems.map((item, index) => (
                // O componente FAQItem agora é responsável pelo seu próprio \"card\" visual
                <FAQItem key={index} question={item.question} answer={item.answer} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={testimonialIndex}
         className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg ring-1 ring-black/5"
         role="region"
         aria-labelledby="depoimentos-title"
      >
            <h3 id="depoimentos-title" className="text-xl font-semibold text-brand-dark mb-5 text-center flex items-center justify-center gap-2">
                <FaUserFriends aria-hidden="true" /> O que nossos criadores dizem:
            </h3>
            <div className="relative">
              {currentTestimonial && (
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4">
                  <img 
                    src={currentTestimonial.avatar} 
                    alt={`Avatar de ${currentTestimonial.name}`}
                    className="w-16 h-16 rounded-full flex-shrink-0 border-2 border-white shadow-lg ring-1 ring-brand-pink/50"
                  />
                  <div className="flex-grow text-center sm:text-left">
                    <blockquote className="font-sans text-lg italic text-gray-700 relative px-4 py-2 font-light bg-brand-light/30 rounded-md">
                      <FaQuoteLeft aria-hidden="true" className="absolute left-2 -top-2 text-3xl text-brand-pink/30 opacity-80" />
                      {currentTestimonial.quote}
                      <FaQuoteRight aria-hidden="true" className="absolute right-2 -bottom-2 text-3xl text-brand-pink/30 opacity-80" />
                    </blockquote>
                    <cite className="block mt-3 text-md font-semibold text-brand-dark text-center sm:text-right not-italic">
                      {currentTestimonial.name}
                    </cite>
                    <p className="text-sm text-gray-600 font-light text-center sm:text-right">
                      {currentTestimonial.role}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {testimonials.length > 1 && (
                <p className="text-xs text-gray-500 text-center mt-4">
                    (Em breve: mais depoimentos em um carrossel interativo!)
                </p>
            )}
       </motion.div>

      <motion.div
         variants={sectionVariants} initial="hidden" animate="visible" custom={guaranteesIndex}
         className="space-y-8 pt-8 pb-4 border-t border-gray-200"
         role="region"
         aria-labelledby="garantias-title"
      >
        <h3 id="garantias-title" className="text-xl font-semibold text-brand-dark mb-6 text-center">Sua Assinatura Segura e Flexível:</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm">
            <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow ring-1 ring-black/5">
                <FaShieldAlt aria-hidden="true" className="w-8 h-8 text-blue-500 mb-2" />
                <span className="font-semibold text-gray-700 leading-tight text-base mb-0.5">Pagamento Seguro</span>
                <span className="text-xs text-gray-600 font-light">Via Mercado Pago</span>
                <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                    <FaLock size={12} /> <span>Ambiente Criptografado</span>
                </div>
            </div>
             <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow ring-1 ring-black/5">
                <FaWhatsapp aria-hidden="true" className="w-8 h-8 text-green-500 mb-2" />
                <span className="font-semibold text-gray-700 leading-tight text-base mb-0.5">Consultor Estratégico IA</span>
                <span className="text-xs text-gray-600 font-light">Via WhatsApp</span>
            </div>
             <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow ring-1 ring-black/5">
                <FaThumbsUp aria-hidden="true" className="w-8 h-8 text-brand-pink mb-2" />
                <span className="font-semibold text-gray-700 leading-tight text-base mb-0.5">Cancelamento Livre</span>
                <span className="text-xs text-gray-600 font-light">Quando quiser</span>
            </div>
        </div>
      </motion.div>


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
          width: 75%;
          height: 100%;
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          opacity: 0.8;
        }
        .shimmer-button:not(:disabled):hover::before {
            animation: shimmer 2.5s infinite linear;
        }
        .shimmer-button:disabled::before {
            animation: none;
            display: none;
        }
        @keyframes shimmer {
          0% { left: -150%; }
          40% { left: 150%; }
          100% { left: 150%; }
        }
        *:focus-visible {
            outline: 3px solid #E91E63; /* Cor brand-pink */
            outline-offset: 2px;
            border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
