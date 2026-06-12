"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";

interface TermsAcceptanceStepProps {
  userName?: string | null;
  callbackUrl: string;
}

const CHANGES = [
  "Bases legais LGPD declaradas por finalidade (Art. 7º)",
  "Transferências internacionais documentadas (Vercel, MongoDB, Upstash)",
  "Todos os 9 direitos do Art. 18 listados",
  "Comunidade de Inspiração vira opt-in — você decide abaixo",
];

const TermsAcceptanceStep: React.FC<TermsAcceptanceStepProps> = ({
  userName,
  callbackUrl,
}) => {
  const router = useRouter();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!termsAccepted) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setServerError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/accept-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptTerms: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data.error ?? "Erro ao salvar aceite. Tente novamente.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo + greeting */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center justify-center gap-1.5 mb-4">
            <span className="relative inline-block h-7 w-7 overflow-hidden align-middle">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="object-contain object-center scale-[2.4]"
                priority
              />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-brand-dark">
              data2content
            </span>
          </span>
          <h1 className="text-xl font-semibold text-zinc-900">
            {userName ? `Olá, ${userName}` : "Bem-vindo(a)"}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Atualizamos nossos termos. Revise e confirme.
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">

          {/* O que mudou */}
          <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-3">
              O que mudou · junho/2026
            </p>
            <ul className="space-y-2">
              {CHANGES.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                    <Check className="h-2.5 w-2.5 text-emerald-600" strokeWidth={3} />
                  </span>
                  <span className="text-[13px] text-zinc-600 leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links para os docs */}
          <div className="px-5 py-3 border-b border-zinc-100 flex gap-4">
            <a
              href="/termos-e-condicoes"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] font-medium text-brand-pink hover:underline"
            >
              Termos <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href="/politica-de-privacidade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] font-medium text-brand-pink hover:underline"
            >
              Privacidade <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Checkbox obrigatório */}
          <div className="px-5 py-4 border-b border-zinc-100">
            <label htmlFor="termsAccepted" className="flex items-start gap-3 cursor-pointer">
              <div className="mt-0.5 relative flex items-center">
                <input
                  id="termsAccepted"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setShowError(false);
                  }}
                  className="h-5 w-5 shrink-0 rounded border-zinc-300 text-brand-pink focus:ring-brand-pink"
                />
              </div>
              <span className="text-[13px] text-zinc-700 leading-snug">
                Li e aceito os{" "}
                <span className="font-semibold">Termos e a Política de Privacidade</span>.{" "}
                <span className="text-red-400">*</span>
              </span>
            </label>
            {showError && (
              <p className="text-red-500 text-[11px] mt-1.5 ml-8">
                Aceite os termos para continuar.
              </p>
            )}
          </div>

        </div>

        {/* Erro servidor */}
        {serverError && (
          <p className="text-red-500 text-xs mt-3 text-center">{serverError}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`mt-4 w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink
            ${termsAccepted && !isSubmitting
              ? "bg-brand-pink hover:bg-pink-700 shadow-sm"
              : "bg-zinc-200 text-zinc-400 cursor-not-allowed"}`}
        >
          {isSubmitting ? "Salvando…" : "Confirmar e continuar"}
        </button>

        <p className="text-center text-[11px] text-zinc-400 mt-5">
          © {new Date().getFullYear()} Data2Content
        </p>
      </div>
    </div>
  );
};

export default TermsAcceptanceStep;
