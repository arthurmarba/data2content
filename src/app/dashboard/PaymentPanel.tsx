"use client";

import { useState, useEffect } from "react";
import {
  FaSpinner,
  FaCheckCircle,
  FaInfoCircle,
  FaTimesCircle,
  FaCalendar,
  FaCalendarAlt,
  FaLock,
  FaWhatsapp,
  FaThumbsUp,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
} from "@/config/pricing.config";
import type { PlanStatus } from "@/types/enums";

interface PaymentPanelProps {
  user: {
    planStatus?: PlanStatus;
    planExpiresAt?: string | null;
    affiliateBalance?: number;
    affiliateCode?: string;
  };
}

const AFFILIATE_REF_KEY = "affiliateRefCode";
const AGENCY_INVITE_KEY = "agencyInviteCode";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const FAQItem = ({ question, answer }: { question: string; answer: string | React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center py-2 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-medium text-brand-dark">{question}</span>
        {isOpen ? (
          <FaChevronUp className="w-4 h-4 text-brand-pink" />
        ) : (
          <FaChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="pb-2 text-sm text-gray-600">{answer}</div>}
    </div>
  );
};

const FeedbackMessage = ({ message, type }: { message: string; type: "success" | "error" | "info" }) => {
  const iconMap = {
    success: <FaCheckCircle className="text-green-500" />,
    error: <FaTimesCircle className="text-red-500" />,
    info: <FaInfoCircle className="text-blue-500" />,
  };
  const colorMap = {
    success: "text-green-700 bg-green-50 border-green-200",
    error: "text-red-700 bg-red-50 border-red-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
  };
  return (
    <div className={`mt-4 flex items-center gap-2 text-sm font-medium p-3 rounded-xl border ${colorMap[type]}`} role="alert">
      {iconMap[type]}
      <span>{message}</span>
    </div>
  );
};

export default function PaymentPanel({ user }: PaymentPanelProps) {
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [isAffiliateCodeValid, setIsAffiliateCodeValid] = useState(true);
  const [affiliateCodeError, setAffiliateCodeError] = useState<string | null>(null);
  const [agencyInviteCode, setAgencyInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [initPoint, setInitPoint] = useState("");
  const [refCodeAppliedMessage, setRefCodeAppliedMessage] = useState<string | null>(null);
  const [agencyMessage, setAgencyMessage] = useState<string | null>(null);
  const [planType, setPlanType] = useState<"monthly" | "annual">("annual");
  const [showAffiliateField, setShowAffiliateField] = useState(false);

  const originalMonthlyPrice = agencyInviteCode ? AGENCY_GUEST_MONTHLY_PRICE : MONTHLY_PRICE;
  const discountedMonthlyPrice = agencyInviteCode ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE;
  const totalAnnualPrice = discountedMonthlyPrice * 12;
  const originalAnnualPrice = originalMonthlyPrice * 12;
  const discountPercentage = Math.round(((originalAnnualPrice - totalAnnualPrice) / originalAnnualPrice) * 100);
  const savingsAmount = originalAnnualPrice - totalAnnualPrice;
  const selectedMonthlyPrice = planType === "annual" ? discountedMonthlyPrice : originalMonthlyPrice;
  const totalPrice = planType === "annual" ? totalAnnualPrice : selectedMonthlyPrice;
  const formattedTotalPrice = currencyFormatter.format(totalPrice);
  const formattedTotalPriceWithoutSymbol = formattedTotalPrice.replace("R$", "").trim();

  useEffect(() => {
    async function loadFromStorage() {
      if (typeof window === "undefined") return;
      const storedRefDataString = localStorage.getItem(AFFILIATE_REF_KEY);
      if (storedRefDataString) {
        try {
          const storedRefData = JSON.parse(storedRefDataString);
          if (storedRefData && storedRefData.code && storedRefData.expiresAt && Date.now() < storedRefData.expiresAt) {
            const codeFromStorage = String(storedRefData.code).toUpperCase();
            setAffiliateCodeInput(codeFromStorage);
            setRefCodeAppliedMessage(`Código de indicação ${codeFromStorage} aplicado! Você receberá um desconto.`);
          } else {
            localStorage.removeItem(AFFILIATE_REF_KEY);
          }
        } catch {
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
        } catch {
          localStorage.removeItem(AGENCY_INVITE_KEY);
        }
      }
    }
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (initPoint) {
      window.location.href = initPoint;
    }
  }, [initPoint]);

  const isPending = user.planStatus === "pending";
  const isActive = user.planStatus === "active";

  if (isActive) {
    return (
      <div className="border border-green-300 rounded-xl shadow-sm p-4 sm:p-6 bg-green-50 text-green-800">
        <div className="flex items-center gap-3 mb-2">
          <FaCheckCircle className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-semibold">Seu plano está ativo!</h2>
        </div>
        <p className="text-sm mb-1 pl-9">
          Acesso liberado até: <strong className="font-medium">{user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString("pt-BR") : "Data Indefinida"}</strong>
        </p>
        <p className="text-sm mt-2 pl-9">Agora conecte sua conta do Instagram e conclua o onboarding.</p>
      </div>
    );
  }

  async function handleSubscribe() {
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
        if (data.error && (data.error.toLowerCase().includes("afiliado") || data.error.toLowerCase().includes("cupom"))) {
          setIsAffiliateCodeValid(false);
          setAffiliateCodeError(data.error);
        }
        setStatusMessage({ message: `Erro: ${data.error || "Falha ao iniciar assinatura."}`, type: "error" });
      } else {
        setStatusMessage({ message: data.message || "Redirecionando para o pagamento...", type: "info" });
        if (data.initPoint) {
          setInitPoint(data.initPoint);
        }
      }
    } catch (error: unknown) {
      let errorMsg = "Erro desconhecido ao processar assinatura.";
      if (error instanceof Error) errorMsg = error.message;
      setStatusMessage({ message: `Erro de rede: ${errorMsg}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const benefitsList: string[] = [
    "Análises ilimitadas de métricas",
    "Consultor IA no WhatsApp 24/7",
    "Estratégias de conteúdo personalizadas",
    "Suporte prioritário individual",
    "Acesso a todas as novas funcionalidades",
  ];

  const faqItems = [
    {
      question: "Como funciona o cancelamento?",
      answer:
        "Você pode cancelar sua assinatura a qualquer momento no painel de configurações. Seu acesso continua até o final do período pago.",
    },
    {
      question: "O pagamento é seguro?",
      answer: "Sim, processamos via Mercado Pago em ambiente criptografado.",
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-10 font-sans">
      {isPending && (
        <div className="border border-yellow-300 rounded-xl shadow-sm p-4 sm:p-6 bg-yellow-50 text-yellow-800">
          <div className="flex items-center gap-3 mb-2">
            <FaSpinner className="w-6 h-6 text-yellow-600 animate-spin" />
            <h2 className="text-lg font-semibold">Pagamento Pendente</h2>
          </div>
          <p className="text-sm mb-1 pl-9">
            Estamos aguardando a confirmação do seu pagamento. Assim que for aprovado, seu plano será ativado automaticamente!
          </p>
          <p className="text-sm mt-2 pl-9">Assim que confirmado, conecte sua conta do Instagram para liberar todos os recursos.</p>
        </div>
      )}

      <div className="max-w-md mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200" role="region" aria-labelledby="plano-title">
        <h3 id="plano-title" className="text-xl font-bold text-center text-brand-dark mb-4">
          Plano {planType === "annual" ? "Anual" : "Mensal"} Data2Content
        </h3>
        <div className="flex justify-center gap-4 mb-4">
          <button
            type="button"
            onClick={() => setPlanType("monthly")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
              planType === "monthly" ? "bg-brand-pink text-white border-brand-pink" : "bg-white text-brand-pink border-brand-pink"
            }`}
          >
            <FaCalendar className="w-4 h-4" /> Mensal
          </button>
          <button
            type="button"
            onClick={() => setPlanType("annual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${
              planType === "annual" ? "bg-brand-pink text-white border-brand-pink" : "bg-white text-brand-pink border-brand-pink"
            }`}
          >
            <FaCalendarAlt className="w-4 h-4" /> Anual
          </button>
        </div>
        <div className="text-center mb-4">
          <span className="text-4xl font-bold text-brand-dark">{formattedTotalPriceWithoutSymbol}</span>
          <span className="text-sm font-medium text-gray-600 ml-1">R$</span>
          <p className="text-sm text-gray-600">
            {planType === "annual"
              ? `equivalente a ${currencyFormatter.format(discountedMonthlyPrice)} / mês`
              : `${currencyFormatter.format(originalMonthlyPrice)} por mês`}
          </p>
          {planType === "annual" && (
            <p className="text-xs text-green-600 mt-1">
              Economize {discountPercentage}% ({currencyFormatter.format(savingsAmount)}/ano)
            </p>
          )}
        </div>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-pink text-white py-3 rounded-xl font-semibold"
        >
          {loading ? <FaSpinner className="w-5 h-5 animate-spin" /> : "Assinar"}
        </button>
        {statusMessage && <FeedbackMessage message={statusMessage.message} type={statusMessage.type} />}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAffiliateField((prev) => !prev)}
            className="text-sm text-brand-pink underline"
          >
            {showAffiliateField ? "Ocultar código promocional" : "Possui um código promocional?"}
          </button>
          {showAffiliateField && (
            <div className="mt-2">
              <input
                type="text"
                value={affiliateCodeInput}
                onChange={(e) => setAffiliateCodeInput(e.target.value.toUpperCase())}
                className={`w-full rounded-xl border p-2 text-sm focus:ring-2 focus:ring-brand-pink focus:border-brand-pink ${
                  !isAffiliateCodeValid ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Ex: ABC123"
                aria-invalid={!isAffiliateCodeValid}
                aria-describedby="affiliate-code-error"
              />
              {!isAffiliateCodeValid && affiliateCodeError && (
                <p id="affiliate-code-error" className="text-red-500 text-xs mt-1">
                  {affiliateCodeError}
                </p>
              )}
            </div>
          )}
          {refCodeAppliedMessage && <p className="text-sm text-green-700 mt-2">{refCodeAppliedMessage}</p>}
          {agencyMessage && <p className="text-sm text-green-700 mt-1">{agencyMessage}</p>}
        </div>
      </div>

      <details className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-4">
        <summary className="cursor-pointer font-medium text-brand-dark">Benefícios do Plano</summary>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {benefitsList.map((benefit, idx) => (
            <li key={idx}>{benefit}</li>
          ))}
        </ul>
      </details>

      <details className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-4">
        <summary className="cursor-pointer font-medium text-brand-dark">Perguntas Frequentes</summary>
        <div className="mt-2 space-y-2">
          {faqItems.map((item, idx) => (
            <FAQItem key={idx} question={item.question} answer={item.answer} />
          ))}
        </div>
      </details>

      <p className="text-center text-xs text-gray-600 mt-4 flex items-center justify-center gap-2 flex-wrap">
        <FaLock className="inline" aria-hidden="true" /> Pagamento Seguro
        <span className="mx-1">•</span>
        <FaWhatsapp className="inline" aria-hidden="true" /> Consultor IA no WhatsApp
        <span className="mx-1">•</span>
        <FaThumbsUp className="inline" aria-hidden="true" /> Cancelamento Livre
      </p>
    </div>
  );
}

