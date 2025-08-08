// src/app/dashboard/PaymentPanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaSpinner, FaCheckCircle, FaInfoCircle, FaTimesCircle, FaLock } from "react-icons/fa";
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

function FeedbackMessage({ message, type }: { message: string; type: "success" | "error" | "info" }) {
  const Icon = type === "success" ? FaCheckCircle : type === "error" ? FaTimesCircle : FaInfoCircle;
  const cls = {
    success: "text-green-700 bg-green-50 border-green-200",
    error: "text-red-700 bg-red-50 border-red-200",
    info: "text-blue-700 bg-blue-50 border-blue-200",
  }[type];

  return (
    <div role="status" aria-live="polite" className={`mt-4 flex items-center gap-2 text-sm font-medium p-3 rounded-xl border ${cls}`}>
      <Icon className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export default function PaymentPanel({ user }: PaymentPanelProps) {
  // --- estados base
  const [affiliateCodeInput, setAffiliateCodeInput] = useState("");
  const [affiliateErr, setAffiliateErr] = useState<string | null>(null);
  const [isAffiliateCodeValid, setIsAffiliateCodeValid] = useState(true);
  const [showAffiliateField, setShowAffiliateField] = useState(false);

  const [agencyInviteCode, setAgencyInviteCode] = useState<string | null>(null);
  const [agencyMessage, setAgencyMessage] = useState<string | null>(null);
  const [refCodeAppliedMessage, setRefCodeAppliedMessage] = useState<string | null>(null);

  const [planType, setPlanType] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [initPoint, setInitPoint] = useState("");

  const affiliateRef = useRef<HTMLInputElement | null>(null);

  // --- precificação memorizada
  const {
    originalMonthlyPrice,
    discountedMonthlyPrice,
    totalAnnualPrice,
    originalAnnualPrice,
    discountPercentage,
    savingsAmount,
    selectedMonthlyPrice,
    totalPrice,
  } = useMemo(() => {
    const originalMonthlyPrice = agencyInviteCode ? AGENCY_GUEST_MONTHLY_PRICE : MONTHLY_PRICE;
    const discountedMonthlyPrice = agencyInviteCode ? AGENCY_GUEST_ANNUAL_MONTHLY_PRICE : ANNUAL_MONTHLY_PRICE;
    const totalAnnualPrice = discountedMonthlyPrice * 12;
    const originalAnnualPrice = originalMonthlyPrice * 12;
    const discountPercentage = Math.round(((originalAnnualPrice - totalAnnualPrice) / Math.max(originalAnnualPrice, 1)) * 100);
    const savingsAmount = originalAnnualPrice - totalAnnualPrice;
    const selectedMonthlyPrice = planType === "annual" ? discountedMonthlyPrice : originalMonthlyPrice;
    const totalPrice = planType === "annual" ? totalAnnualPrice : selectedMonthlyPrice;

    return {
      originalMonthlyPrice,
      discountedMonthlyPrice,
      totalAnnualPrice,
      originalAnnualPrice,
      discountPercentage,
      savingsAmount,
      selectedMonthlyPrice,
      totalPrice,
    };
  }, [agencyInviteCode, planType]);

  // --- carregar ref/agency via localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRefDataString = localStorage.getItem(AFFILIATE_REF_KEY);
    if (storedRefDataString) {
      try {
        const storedRefData = JSON.parse(storedRefDataString);
        if (storedRefData && storedRefData.code && storedRefData.expiresAt && Date.now() < storedRefData.expiresAt) {
          const codeFromStorage = String(storedRefData.code).toUpperCase();
          setAffiliateCodeInput(codeFromStorage);
          setShowAffiliateField(true);
          setRefCodeAppliedMessage(`Código de indicação ${codeFromStorage} aplicado!`);
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
          (async () => {
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
          })();
        } else {
          localStorage.removeItem(AGENCY_INVITE_KEY);
        }
      } catch {
        localStorage.removeItem(AGENCY_INVITE_KEY);
      }
    }
  }, []);

  // --- redirect automático quando initPoint chega
  useEffect(() => {
    if (initPoint) window.location.href = initPoint;
  }, [initPoint]);

  const isPending = user.planStatus === "pending";
  const isActive = user.planStatus === "active";

  // --- subscribe
  async function handleSubscribe(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    setInitPoint("");
    setIsAffiliateCodeValid(true);
    setAffiliateErr(null);
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
        if (data.error && (/afiliad/i.test(data.error) || /cupom/i.test(data.error))) {
          setIsAffiliateCodeValid(false);
          setAffiliateErr(data.error);
          setShowAffiliateField(true);
          setTimeout(() => affiliateRef.current?.focus(), 0);
        }
        setStatusMessage({ message: `Erro: ${data.error || "Falha ao iniciar assinatura."}`, type: "error" });
      } else {
        setStatusMessage({ message: data.message || "Redirecionando para o pagamento...", type: "info" });
        if (data.initPoint) setInitPoint(data.initPoint);
      }
    } catch (error: unknown) {
      let errorMsg = "Erro desconhecido ao processar assinatura.";
      if (error instanceof Error) errorMsg = error.message;
      setStatusMessage({ message: `Erro de rede: ${errorMsg}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }

  // --- helpers de exibição de preço (R$, inteiro, centavos) — corrigido o typo
  function renderBigPrice(value: number) {
    const brl = currencyFormatter.format(value); // ex: R$ 1.234,56
    const onlyNums = brl.replace(/[^\d,]/g, ""); // 1.234,56
    const [intPart, cents = "00"] = onlyNums.split(",");
    return (
      <div className="inline-flex items-baseline gap-1 leading-none">
        <span className="text-[13px] font-semibold text-gray-500">R$</span>
        <span className="font-extrabold tracking-tight text-brand-dark text-[clamp(28px,6vw,42px)]">{intPart}</span>
        <span className="text-sm font-semibold text-gray-500">,{cents}</span>
      </div>
    );
  }

  // --- sticky CTA no mobile: aparece quando o card sai do viewport
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const shouldShow = !entry.isIntersecting && !isActive && !isPending;
      setShowStickyCTA(shouldShow);
    }, { root: null, threshold: 0, rootMargin: "0px" });

    obs.observe(el);
    return () => obs.disconnect();
  }, [isActive, isPending]);

  // --- atalhos de lista
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
        "Você pode cancelar sua assinatura a qualquer momento no Mercado Pago. Seu acesso continua até o final do período pago.",
    },
    {
      question: "O pagamento é seguro?",
      answer: "Sim, processamos via Mercado Pago em ambiente criptografado.",
    },
  ];

  // --- estados ativos/pendentes (cards compactos)
  if (isActive) {
    return (
      <div className="border border-green-300 rounded-xl shadow-sm p-4 sm:p-6 bg-green-50 text-green-800">
        <div className="flex items-center gap-3 mb-2">
          <FaCheckCircle className="w-6 h-6 text-green-600" />
          <h2 className="text-lg font-semibold">Seu plano está ativo!</h2>
        </div>
        <p className="text-sm mb-1 pl-9">
          Acesso liberado até:{" "}
          <strong className="font-medium">
            {user.planExpiresAt ? new Date(user.planExpiresAt).toLocaleDateString("pt-BR") : "Data Indefinida"}
          </strong>
        </p>
        <p className="text-sm mt-2 pl-9">Agora conecte sua conta do Instagram e conclua o onboarding.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {isPending && (
        <div className="border border-yellow-300 rounded-xl shadow-sm p-4 sm:p-5 bg-yellow-50 text-yellow-800 mb-4">
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

      {/* CARD PRINCIPAL */}
      <form
        onSubmit={handleSubscribe}
        className="p-6 bg-white rounded-xl shadow-sm border border-gray-200"
        role="region"
        aria-labelledby="plano-title"
        ref={formRef}
      >
        <h3 id="plano-title" className="text-lg sm:text-xl font-bold text-center text-brand-dark mb-3">
          Plano {planType === "annual" ? "Anual" : "Mensal"} Data2Content
        </h3>

        {/* Toggle minimalista */}
        <fieldset className="mb-5" aria-label="Tipo de plano">
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-full border border-gray-200">
            <button
              type="button"
              onClick={() => setPlanType("monthly")}
              aria-pressed={planType === "monthly"}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                planType === "monthly" ? "bg-white text-brand-dark shadow-sm" : "text-gray-600 hover:text-brand-dark"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setPlanType("annual")}
              aria-pressed={planType === "annual"}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors inline-flex items-center justify-center gap-1 ${
                planType === "annual" ? "bg-white text-brand-dark shadow-sm" : "text-gray-600 hover:text-brand-dark"
              }`}
            >
              Anual
              {planType !== "annual" && discountPercentage > 0 && (
                <span className="ml-1 inline-flex px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold border border-green-200">
                  -{discountPercentage}%
                </span>
              )}
            </button>
          </div>
        </fieldset>

        {/* Preço hierárquico */}
        <div className="text-center mb-4">
          {renderBigPrice(totalPrice)}
          <p className="text-sm text-gray-600 mt-1">
            {planType === "annual" ? (
              <>
                equivale a {currencyFormatter.format(discountedMonthlyPrice)} <span className="text-gray-500">/ mês</span>
              </>
            ) : (
              <>
                {currencyFormatter.format(originalMonthlyPrice)} <span className="text-gray-500">/ mês</span>
              </>
            )}
          </p>
          {planType === "annual" && discountPercentage > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200">
              Economize {discountPercentage}%
            </div>
          )}
        </div>

        {/* CTA principal */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-pink text-white py-3 rounded-xl font-semibold disabled:opacity-70"
          data-testid="subscribe-cta"
        >
          {loading ? <FaSpinner className="w-5 h-5 animate-spin" /> : "Assinar agora"}
        </button>
        <p className="mt-2 text-center text-xs text-gray-500">
          Pagamento seguro via Mercado Pago. Sem fidelidade — cancele quando quiser.
        </p>

        {/* Mensagens */}
        {statusMessage && <FeedbackMessage message={statusMessage.message} type={statusMessage.type} />}

        {/* Código promocional */}
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setShowAffiliateField((prev) => !prev)} className="text-sm text-brand-pink underline">
            {showAffiliateField ? "Ocultar código promocional" : "Possui um código promocional?"}
          </button>
          {showAffiliateField && (
            <div className="mt-2">
              <label htmlFor="affiliateCode" className="sr-only">Código promocional</label>
              <input
                id="affiliateCode"
                ref={affiliateRef}
                type="text"
                value={affiliateCodeInput}
                onChange={(e) => setAffiliateCodeInput(e.target.value.toUpperCase())}
                className={`w-full rounded-xl border p-2 text-sm focus:ring-2 focus:ring-brand-pink focus:border-brand-pink ${!isAffiliateCodeValid || affiliateErr ? "border-red-500" : "border-gray-300"}`}
                placeholder="Ex: ABC123"
                aria-invalid={!isAffiliateCodeValid || !!affiliateErr}
                aria-describedby={!isAffiliateCodeValid || affiliateErr ? "affiliate-code-error" : undefined}
                autoComplete="off"
                inputMode="text"
              />
              {(!isAffiliateCodeValid || affiliateErr) && (
                <p id="affiliate-code-error" className="text-red-600 text-xs mt-1">{affiliateErr || "Código inválido"}</p>
              )}
            </div>
          )}
          {refCodeAppliedMessage && <p className="text-sm text-green-700 mt-2">{refCodeAppliedMessage}</p>}
          {agencyMessage && <p className="text-sm text-green-700 mt-1">{agencyMessage}</p>}
        </div>
      </form>

      {/* detalhes compactos */}
      <details className="bg-white rounded-xl border border-gray-200 p-4 mt-3">
        <summary className="cursor-pointer font-medium text-brand-dark">Benefícios do Plano</summary>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
          {benefitsList.map((benefit, idx) => (
            <li key={idx}>{benefit}</li>
          ))}
        </ul>
      </details>

      <details className="bg-white rounded-xl border border-gray-200 p-4">
        <summary className="cursor-pointer font-medium text-brand-dark">Perguntas Frequentes</summary>
        <div className="mt-2 space-y-2">
          {faqItems.map((item, idx) => (
            <div key={idx} className="border-b last:border-b-0">
              <p className="py-2 text-sm font-medium text-brand-dark">{item.question}</p>
              <p className="pb-2 text-sm text-gray-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </details>

      {/* faixa sticky CTA (mobile) */}
      {showStickyCTA && !isPending && (
        <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden" role="region" aria-label="Ação rápida de assinatura">
          <div className="mx-3 mb-3 rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="text-xs text-gray-500">{planType === "annual" ? "Plano Anual" : "Plano Mensal"}</div>
                <div className="text-base font-semibold text-brand-dark leading-tight">
                  {planType === "annual" ? `${currencyFormatter.format(discountedMonthlyPrice)} / mês` : `${currencyFormatter.format(originalMonthlyPrice)} / mês`}
                </div>
                {planType === "annual" && discountPercentage > 0 && (
                  <div className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-semibold border border-green-200">
                    Economize {discountPercentage}%
                  </div>
                )}
              </div>
              <button onClick={() => handleSubscribe()} disabled={loading} className="min-w-[120px] inline-flex items-center justify-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg font-semibold disabled:opacity-70">
                {loading ? <FaSpinner className="w-4 h-4 animate-spin" /> : "Assinar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* rodapé de segurança compacto */}
      <p className="text-center text-xs text-gray-600 mt-4 flex items-center justify-center gap-2 flex-wrap">
        <FaLock className="inline" aria-hidden="true" /> Pagamento Seguro • Consultor IA no WhatsApp • Cancelamento Livre
      </p>
    </div>
  );
}
