"use client";

import React from "react";
import { Crown } from "lucide-react";

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
  description = "Torne-se assinante e utilize nossa IA para planejamento de conteúdo.",
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
      <div className="relative overflow-hidden rounded-xl border border-pink-200 bg-white">
        <div className="absolute inset-0 opacity-10 bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-pink-100 p-2">
              <Crown className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openSubscribe}
              className="inline-flex items-center justify-center rounded-md bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
            >
              {primaryLabel}
            </button>
            {secondaryLabel && (
              <button
                onClick={openSubscribe}
                className="hidden sm:inline-flex items-center justify-center rounded-md border border-pink-200 px-3 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-50"
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscribeCtaBanner;
