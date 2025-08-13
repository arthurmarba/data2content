// src/hooks/useAffiliateCode.ts
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Ordem de resolução:
 * 1) Query string (?ref= ou ?aff=)
 * 2) Cookie `d2c_ref`
 * 3) localStorage `d2c_ref`
 * 4) Sessão (session.user.affiliateCode)
 */
export function useAffiliateCode() {
  const { data: session } = useSession();
  const [code, setCode] = useState<string>("");

  const normalize = (v: string) => v.trim().toUpperCase();

  useEffect(() => {
    // 1) URL params
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ref") || params.get("aff");
    if (fromUrl) {
      const normalized = normalize(fromUrl);
      setCode(normalized);
      try {
        localStorage.setItem("d2c_ref", normalized);
      } catch {
        // ignore
      }
      return;
    }

    // 2) Cookie legível no client (middleware define httpOnly=false)
    const match = document.cookie.match(/(?:^|; )d2c_ref=([^;]+)/);
    const rawCookie = match?.[1] ?? "";
    const fromCookie = rawCookie ? decodeURIComponent(rawCookie) : "";
    if (fromCookie) {
      setCode(normalize(fromCookie));
      return;
    }

    // 3) localStorage
    try {
      const fromLS = localStorage.getItem("d2c_ref") || "";
      if (fromLS) {
        setCode(normalize(fromLS));
        return;
      }
    } catch {
      // ignore
    }

    // 4) session
    const fromSession =
      (session as any)?.user?.affiliateCode ||
      (session as any)?.affiliateCode ||
      "";
    if (fromSession) {
      setCode(normalize(String(fromSession)));
    }
  }, [session]);

  return code;
}
