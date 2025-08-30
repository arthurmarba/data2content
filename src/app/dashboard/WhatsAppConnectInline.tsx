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
      <div className={containerClass}>
        {/* Status */}
        <div
          className="flex items-center gap-2 text-xs sm:text-sm"
          role="status"
          aria-live="polite"
          id="whatsapp-status"
        >
          {loading ? (
            <>
              <FaSpinner className="animate-spin text-green-600" aria-hidden />
              <span>Preparando vínculo do WhatsApp…</span>
            </>
          ) : error ? (
            <>
              <FaExclamationTriangle className="text-red-600" aria-hidden />
              <span>{error}</span>
            </>
          ) : linkedPhone ? (
            <>
              <FaCheckCircle className="text-green-600" aria-hidden />
              <span>
                Conectado ao WhatsApp <span className="opacity-80">({linkedPhone})</span>
              </span>
            </>
          ) : code ? (
            isExpired ? (
              <>
                <FaExclamationTriangle className="text-amber-600" aria-hidden />
                <span>
                  Código expirado. Gere um novo para concluir a verificação.
                </span>
              </>
            ) : (
              <>
                <FaWhatsapp className="text-green-600" aria-hidden />
                <span className="flex items-center gap-2">
                  Código:{" "}
                  <strong className="tracking-widest">{code}</strong>
                  {timeLeft && (
                    <span className="text-green-700">
                      (expira em {timeLeft})
                    </span>
                  )}
                </span>
              </>
            )
          ) : (
            <>
              <FaWhatsapp className="text-green-600" aria-hidden />
              <span>Gere seu código para vincular o WhatsApp.</span>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {!loading && code && !isExpired && (
            <button
              onClick={copy}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white text-green-800 border border-green-300 hover:bg-green-100"
              aria-label="Copiar código de verificação"
              title="Copiar código"
            >
              {copied ? "Copiado" : (
                <>
                  <FaCopy className="inline mr-1" aria-hidden /> Copiar
                </>
              )}
            </button>
          )}

          {!loading && (
            <button
              onClick={openWhatsApp}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700"
              aria-label={linkedPhone ? "Abrir conversa no WhatsApp" : "Abrir WhatsApp para enviar o código"}
            >
              {linkedPhone ? "Conversar com IA" : "Abrir WhatsApp"}
            </button>
          )}

          {!loading && (error || isExpired || (!linkedPhone && !code)) && (
            <button
              onClick={refresh}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white border hover:bg-gray-50 text-gray-800 flex items-center gap-2"
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
