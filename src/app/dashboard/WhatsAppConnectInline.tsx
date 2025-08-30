"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaWhatsapp, FaSpinner, FaCopy, FaCheckCircle } from "react-icons/fa";

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch("/api/whatsapp/generateCode", { method: "POST" });
        const data: GenResponse = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError((data as any)?.error || "Falha ao gerar código.");
          setCode(null); setExpiresAt(null); setLinkedPhone(null);
        } else if ((data as any).linked) {
          setLinkedPhone((data as any).phone || "");
          setCode(null); setExpiresAt(null);
        } else if ((data as any).code) {
          setCode((data as any).code);
          setExpiresAt((data as any).expiresAt || null);
          setLinkedPhone(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Erro inesperado.");
        setCode(null); setExpiresAt(null); setLinkedPhone(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!expiresAt) { setTimeLeft(""); return; }
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("expirado"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts: string[] = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    };
    const id = setInterval(update, 1000); update();
    return () => clearInterval(id);
  }, [expiresAt]);

  const openWhatsApp = () => {
    const text = code
      ? `Olá, data2content! Meu código de verificação é: ${code}`
      : "Olá, data2content!";
    const encoded = encodeURIComponent(text);
    const number = "552120380975";
    window.open(`https://wa.me/${number}?text=${encoded}`, "_blank");
  };

  const copy = async () => {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false), 1500); } catch {}
  };

  return (
    <div className="w-full mb-2">
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 text-green-900 px-3 py-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <FaWhatsapp className="text-green-600" />
          {loading ? (
            <span className="flex items-center gap-2"><FaSpinner className="animate-spin"/> Preparando vínculo do WhatsApp…</span>
          ) : linkedPhone ? (
            <span className="flex items-center gap-2"><FaCheckCircle/> Conectado ao WhatsApp ({linkedPhone})</span>
          ) : code ? (
            <span className="flex items-center gap-2">
              Código: <strong className="tracking-widest">{code}</strong>
              {timeLeft && <span className="text-green-700">(expira em {timeLeft})</span>}
            </span>
          ) : error ? (
            <span className="text-red-700">{error}</span>
          ) : (
            <span>Gere seu código para vincular o WhatsApp.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && code && (
            <button onClick={copy} className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-white text-green-800 border border-green-300 hover:bg-green-100">
              {copied ? 'Copiado' : <><FaCopy className="inline mr-1"/> Copiar</>}
            </button>
          )}
          {!loading && (
            <button onClick={openWhatsApp} className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700">
              {linkedPhone ? 'Conversar com IA' : 'Abrir WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

