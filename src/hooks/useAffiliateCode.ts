// src/hooks/useAffiliateCode.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Ordem de resolução corrigida:
 * 1) Query string (?ref= ou ?aff=)
 * 2) Cookie `d2c_ref`
 * 3) localStorage `d2c_ref`
 * O hook agora roda apenas uma vez para capturar o código do referenciador.
 */
export function useAffiliateCode() {
  const [code, setCode] = useState<string>("");

  const normalize = (v: string) => (v || "").trim().toUpperCase();

  useEffect(() => {
    // 1) URL params (prioridade máxima)
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ref") || params.get("aff");
    if (fromUrl) {
      const normalized = normalize(fromUrl);
      setCode(normalized);
      try {
        // Garante que a informação persista no localStorage
        localStorage.setItem("d2c_ref", normalized);
      } catch { /* ignore */ }
      return; // Encontrou, não precisa procurar mais
    }

    // 2) Cookie (se não houver na URL)
    const match = document.cookie.match(/(?:^|; )d2c_ref=([^;]+)/);
    const rawCookie = match?.[1] ?? "";
    const fromCookie = rawCookie ? decodeURIComponent(rawCookie) : "";
    if (fromCookie) {
      setCode(normalize(fromCookie));
      return; // Encontrou, não precisa procurar mais
    }

    // 3) localStorage (último recurso)
    try {
      const fromLS = localStorage.getItem("d2c_ref") || "";
      if (fromLS) {
        setCode(normalize(fromLS));
      }
    } catch { /* ignore */ }

  // A dependência foi alterada para [], fazendo com que o hook rode
  // apenas uma vez na montagem, capturando o código do referenciador
  // sem o risco de ser sobrescrito pela sessão do novo usuário.
  }, []);

  return code;
}