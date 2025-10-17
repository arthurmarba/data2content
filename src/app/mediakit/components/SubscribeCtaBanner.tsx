"use client";

import React from "react";
import { Crown } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

export interface SubscribeCtaBannerProps {
  /** Se true, oculta o banner (já é assinante) */
  isSubscribed?: boolean;
  /** Texto principal (opcional) */
  title?: string;
  /** Subtexto (opcional) */
  description?: string;
  /** Rótulo do botão primário */
  primaryLabel?: string;
  /** Rótulo do botão secundário (exibido apenas ≥ sm) */
  secondaryLabel?: string;
  /** Classe extra no wrapper */
  className?: string;
}

/**
 * CTA de Assinatura (full-width dentro do container)
 * Dispara o mesmo evento do botão do Header: `open-subscribe-modal`.
 */
const SubscribeCtaBanner: React.FC<SubscribeCtaBannerProps> = ({
  isSubscribed,
  title = "Desbloqueie nossa IA avançada",
  description = "Torne-se assinante e utilize nossa IA para planejar conteúdo.",
  primaryLabel = "Seja assinante",
  secondaryLabel = "Ver planos",
  className = "",
}) => {
  if (isSubscribed) return null;

  const openSubscribe = () => {
    try {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    } catch (_) {
      // no-op SSR/edge
    }
  };

  return (
    <div className={`mb-6 sm:mb-8 ${className}`}>
      <div className="relative overflow-hidden rounded-xl border border-pink-200/70 bg-white shadow-sm">
        <div className="absolute inset-0 opacity-10 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-pink-100 p-2">
              <Crown className="w-5 h-5 text-pink-600" />
            </div>
            <div className="max-w-2xl">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h2>
              <p className="mt-1 text-sm sm:text-base text-gray-600">{description}</p>
            </div>
          </div>

          <div className="flex w-full sm:w-auto flex-col gap-2">
            <button
              onClick={openSubscribe}
              className="inline-flex w-full items-center justify-center rounded-md bg-pink-600 px-4 py-2 text-sm sm:text-base font-semibold text-white shadow hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
            >
              {primaryLabel}
            </button>
            <a
              href="https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-4 py-2 text-sm sm:text-base font-semibold text-emerald-600 shadow-sm hover:border-emerald-300 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-colors"
            >
              <FaWhatsapp aria-hidden="true" className="h-4 w-4" />
              Entrar na Comunidade (WhatsApp)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribeCtaBanner;
