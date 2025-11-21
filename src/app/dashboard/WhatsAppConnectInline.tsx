"use client";

import React, { useEffect, useState } from "react";
import {
  FaWhatsapp,
  FaSpinner,
  FaCopy,
  FaCheckCircle,
  FaExclamationTriangle,
  FaRedoAlt,
} from "react-icons/fa";

type GenResponse =
  | { linked: true; phone: string }
  | { code: string; expiresAt?: string }
  | { error: string };

export default function WhatsAppConnectInline() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // --- helpers ---
  const isExpired = code && timeLeft === "expirado";

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/generateCode", { method: "POST" });
      const data: GenResponse = await res.json();

      if (!res.ok) {
        setError((data as any)?.error || "Falha ao gerar código.");
        setCode(null);
        setExpiresAt(null);
        setLinkedPhone(null);
        return;
      }

      if ((data as any).linked) {
        setLinkedPhone((data as any).phone || "");
        setCode(null);
        setExpiresAt(null);
        return;
      }

      if ((data as any).code) {
        setCode((data as any).code);
        setExpiresAt((data as any).expiresAt || null);
        setLinkedPhone(null);
        return;
      }

      // fallback
      setError("Resposta inesperada ao gerar o código.");
      setCode(null);
      setExpiresAt(null);
      setLinkedPhone(null);
    } catch (e: any) {
      setError(e?.message || "Erro inesperado.");
      setCode(null);
      setExpiresAt(null);
      setLinkedPhone(null);
    } finally {
      setLoading(false);
    }
  };

  // load on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      await refresh();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // countdown
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft("");
      return;
    }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("expirado");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts: string[] = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    };
    const id = setInterval(update, 1000);
    update();
    return () => clearInterval(id);
  }, [expiresAt]);

  const openWhatsApp = () => {
    const text = code
      ? `Olá, data2content! Meu código de verificação é: ${code}`
      : "Olá, data2content!";
    const encoded = encodeURIComponent(text);
    const number = "552120380975";
    const href = `https://wa.me/${number}?text=${encoded}`;
    // usar noopener/noreferrer por segurança
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    if (!code || isExpired) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // silencia erro de clipboard (ex.: http sem https)
    }
  };

  // estilos do container: mostra erro/expirado com tom de alerta
  const containerBase =
    "flex items-center justify-between rounded-lg px-3 py-2 border";
  const containerClass = error
    ? `${containerBase} border-red-200 bg-red-50 text-red-800`
    : isExpired
      ? `${containerBase} border-amber-200 bg-amber-50 text-amber-900`
      : `${containerBase} border-green-200 bg-green-50 text-green-900`;

  return (
    <div className="w-full mb-2">
      <div className={`${containerClass} flex-col items-start gap-3`}>
        {/* Status */}
        <div
          className="flex items-center gap-2 text-xs sm:text-sm w-full"
          role="status"
          aria-live="polite"
          id="whatsapp-status"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin text-green-600 flex-shrink-0" aria-hidden />
              <span>Preparando vínculo do WhatsApp…</span>
            </>
          ) : error ? (
            <>
              <FaExclamationTriangle className="text-red-600 flex-shrink-0" aria-hidden />
              <span>{error}</span>
            </>
          ) : linkedPhone ? (
            <>
              <FaCheckCircle className="text-green-600 flex-shrink-0" aria-hidden />
              <span>
                Conectado ao WhatsApp <span className="opacity-80">({linkedPhone})</span>
              </span>
            </>
          ) : code ? (
            isExpired ? (
              <>
                <FaExclamationTriangle className="text-amber-600 flex-shrink-0" aria-hidden />
                <span>
                  Código expirado. Gere um novo para concluir a verificação.
                </span>
              </>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2">
                  <FaWhatsapp className="text-green-600 flex-shrink-0" aria-hidden />
                  <span>Seu código de verificação:</span>
                </div>
                <div className="flex items-center justify-between bg-white/50 rounded px-2 py-1 w-full">
                  <strong className="tracking-widest text-lg">{code}</strong>
                  {timeLeft && (
                    <span className="text-xs text-green-700">
                      (expira em {timeLeft})
                    </span>
                  )}
                </div>
              </div>
            )
          ) : (
            <>
              <FaWhatsapp className="text-green-600 flex-shrink-0" aria-hidden />
              <span>Gere seu código para vincular o WhatsApp.</span>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 w-full justify-end border-t border-black/5 pt-2 mt-1">
          {!loading && code && !isExpired && (
            <button
              onClick={copy}
              className="text-xs px-3 py-2 rounded-lg bg-white text-green-800 border border-green-200 hover:bg-green-50 flex items-center gap-1.5 transition-colors"
              aria-label="Copiar código de verificação"
              title="Copiar código"
            >
              {copied ? "Copiado" : (
                <>
                  <FaCopy className="" aria-hidden /> Copiar
                </>
              )}
            </button>
          )}

          {!loading && (
            <button
              onClick={openWhatsApp}
              className="text-xs px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5 transition-colors shadow-sm"
              aria-label={linkedPhone ? "Abrir conversa no WhatsApp" : "Abrir WhatsApp para enviar o código"}
            >
              <FaWhatsapp className="text-sm" />
              {linkedPhone ? "Conversar" : "Abrir WhatsApp"}
            </button>
          )}

          {!loading && (error || isExpired || (!linkedPhone && !code)) && (
            <button
              onClick={refresh}
              className="text-xs px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-colors"
              aria-label="Gerar novo código de verificação"
              title="Gerar novo código"
            >
              <FaRedoAlt aria-hidden /> Gerar novo código
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
