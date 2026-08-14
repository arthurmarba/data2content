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
  const [disconnecting, setDisconnecting] = useState(false);

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

  const disconnect = async () => {
    if (!linkedPhone || disconnecting) return;
    if (!window.confirm("Desvincular este número do WhatsApp? Os alertas serão interrompidos.")) return;

    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/status", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao desvincular WhatsApp.");

      setLinkedPhone(null);
      setCode(null);
      setExpiresAt(null);
      setTimeLeft("");
    } catch (e: any) {
      setError(e?.message || "Erro inesperado ao desvincular WhatsApp.");
    } finally {
      setDisconnecting(false);
    }
  };

  // estilos do container: mostra erro/expirado com tom de alerta
  const containerBase =
    "flex items-center justify-between rounded-[var(--ds-radius-md)] border px-3 py-3 text-[13px]";
  const containerClass = error
    ? `${containerBase} border-[var(--ds-color-danger)] bg-[var(--ds-color-danger-soft)] text-[var(--ds-color-danger)]`
    : isExpired
      ? `${containerBase} border-[var(--ds-color-warning)] bg-[var(--ds-color-warning-soft)] text-[var(--ds-color-warning)]`
      : `${containerBase} border-[var(--ds-color-line)] bg-[var(--ds-color-success-soft)] text-[var(--ds-color-text)]`;

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
              <FaSpinner className="flex-shrink-0 animate-spin text-[var(--ds-color-success)]" aria-hidden />
              <span>Preparando vínculo do WhatsApp…</span>
            </>
          ) : error ? (
            <>
              <FaExclamationTriangle className="flex-shrink-0 text-[var(--ds-color-danger)]" aria-hidden />
              <span>{error}</span>
            </>
          ) : linkedPhone ? (
            <>
              <FaCheckCircle className="flex-shrink-0 text-[var(--ds-color-success)]" aria-hidden />
              <span>
                Conectado ao WhatsApp <span className="opacity-80">({linkedPhone})</span>
              </span>
            </>
          ) : code ? (
            isExpired ? (
              <>
                <FaExclamationTriangle className="flex-shrink-0 text-[var(--ds-color-warning)]" aria-hidden />
                <span>
                  Código expirado. Gere um novo para concluir a verificação.
                </span>
              </>
            ) : (
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center gap-2">
                  <FaWhatsapp className="flex-shrink-0 text-[var(--ds-color-success)]" aria-hidden />
                  <span>Seu código de verificação:</span>
                </div>
                <div className="flex w-full items-center justify-between rounded-[var(--ds-radius-sm)] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] px-3 py-2">
                  <strong className="tracking-widest text-lg">{code}</strong>
                  {timeLeft && (
                    <span className="text-xs text-[var(--ds-color-text-muted)]">
                      (expira em {timeLeft})
                    </span>
                  )}
                </div>
              </div>
            )
          ) : (
            <>
              <FaWhatsapp className="flex-shrink-0 text-[var(--ds-color-success)]" aria-hidden />
              <span>Gere seu código para vincular o WhatsApp.</span>
            </>
          )}
        </div>

        {/* Ações */}
        <div className="mt-1 flex w-full flex-wrap items-center justify-end gap-2 border-t border-[var(--ds-color-line)] pt-3">
          {!loading && code && !isExpired && (
            <button
              type="button"
              onClick={copy}
              className="ds-button ds-button--quiet ds-button--small"
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
              type="button"
              onClick={openWhatsApp}
              className="ds-button ds-button--primary ds-button--small"
              aria-label={linkedPhone ? "Abrir WhatsApp para acessar o Chat AI" : "Abrir WhatsApp para enviar o código"}
            >
              <FaWhatsapp className="text-sm" />
              Abrir WhatsApp
            </button>
          )}

          {!loading && linkedPhone && (
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="ds-button ds-button--danger ds-button--small"
            >
              {disconnecting ? "Desvinculando..." : "Desvincular"}
            </button>
          )}

          {!loading && (error || isExpired || (!linkedPhone && !code)) && (
            <button
              type="button"
              onClick={refresh}
              className="ds-button ds-button--quiet ds-button--small"
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
