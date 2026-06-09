"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

interface TermsAcceptanceStepProps {
  userName?: string | null;
  callbackUrl: string;
}

const TermsAcceptanceStep: React.FC<TermsAcceptanceStepProps> = ({
  userName,
  callbackUrl,
}) => {
  const router = useRouter();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [communityOptIn, setCommunityOptIn] = useState(false);
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
        body: JSON.stringify({ acceptTerms: true, communityOptIn }),
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
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center gap-2">
            <span className="relative inline-block h-8 w-8 overflow-hidden align-middle">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="object-contain object-center scale-[2.4]"
                priority
              />
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-brand-dark">
              data2content
            </span>
          </span>
          <h1 className="text-2xl font-semibold text-gray-800 mt-4">
            {userName ? `Olá, ${userName}!` : "Bem-vindo(a) ao Data2Content!"}
          </h1>
          <p className="text-gray-600 mt-2 text-sm">
            Atualizamos nossos Termos e Política de Privacidade. Por favor,
            revise e confirme antes de continuar.
          </p>
        </div>

        {/* Resumo das mudanças */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 text-sm text-blue-800 space-y-1">
          <p className="font-semibold mb-2">O que mudou (junho/2026):</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              Bases legais declaradas para cada finalidade de tratamento (LGPD
              Art. 7º)
            </li>
            <li>
              Transferências internacionais de dados documentadas (Vercel,
              MongoDB, Upstash)
            </li>
            <li>Todos os 9 direitos do Art. 18 agora listados na Política</li>
            <li>
              Comunidade de Inspiração agora é <strong>opt-in opcional</strong>{" "}
              — você escolhe participar abaixo
            </li>
          </ul>
        </div>

        {/* Links para documentos */}
        <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-200 mb-5">
          Leia os documentos completos:{" "}
          <a
            href="/termos-e-condicoes"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-pink hover:underline"
          >
            Termos e Condições
          </a>{" "}
          e{" "}
          <a
            href="/politica-de-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-pink hover:underline"
          >
            Política de Privacidade
          </a>
          .
        </div>

        {/* Checkbox obrigatório — Termos */}
        <div className="mb-4">
          <label
            htmlFor="termsAccepted"
            className="flex items-start cursor-pointer gap-3"
          >
            <input
              id="termsAccepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (e.target.checked) setShowError(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink border-gray-300 rounded focus:ring-brand-pink"
            />
            <span className="text-sm text-gray-700">
              <strong>Li e aceito</strong> os Termos e Condições e a Política de
              Privacidade da Data2Content.{" "}
              <span className="text-red-500">*</span>
            </span>
          </label>
          {showError && (
            <p className="text-red-500 text-xs mt-1 ml-8">
              Você precisa aceitar os termos para continuar.
            </p>
          )}
        </div>

        {/* Checkbox opcional — Comunidade de Inspiração */}
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label
            htmlFor="communityOptIn"
            className="flex items-start cursor-pointer gap-3"
          >
            <input
              id="communityOptIn"
              type="checkbox"
              checked={communityOptIn}
              onChange={(e) => setCommunityOptIn(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink border-gray-300 rounded focus:ring-brand-pink"
            />
            <span className="text-sm text-gray-700">
              <strong>Quero participar da Comunidade de Inspiração</strong>{" "}
              <span className="text-xs text-gray-500">(opcional)</span>
              <br />
              <span className="text-xs text-gray-500">
                Seus posts públicos do Instagram (link, resumo de IA e
                indicadores qualitativos — nunca números exatos) poderão ser
                exibidos para outros criadores como exemplos inspiradores. Você
                pode alterar isso nas configurações do perfil a qualquer momento.
              </span>
            </span>
          </label>
        </div>

        {serverError && (
          <p className="text-red-500 text-sm mb-4 text-center">{serverError}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink
            ${termsAccepted && !isSubmitting ? "bg-brand-pink hover:bg-pink-700" : "bg-gray-300 cursor-not-allowed"}`}
        >
          {isSubmitting ? "Salvando..." : "Confirmar e continuar"}
        </button>
      </div>

      <footer className="text-center mt-8 py-4 text-xs text-gray-500">
        &copy; {new Date().getFullYear()} Data2Content. Todos os direitos
        reservados.
      </footer>
    </div>
  );
};

export default TermsAcceptanceStep;
