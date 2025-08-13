import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * Resolves the affiliate code from multiple sources in the following order:
 * 1. Query string (?ref= or ?aff=)
 * 2. Cookie `d2c_ref`
 * 3. localStorage `d2c_ref`
 * 4. Session (`session.user.affiliateCode`)
 */
export function useAffiliateCode() {
  const { data: session } = useSession();
  const [code, setCode] = useState<string>("");

  useEffect(() => {
    // 1) URL params
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("ref") || params.get("aff");
    if (fromUrl) {
      const normalized = fromUrl.toUpperCase();
      setCode(normalized);
      try {
        localStorage.setItem("d2c_ref", normalized);
      } catch {
        // ignore
      }
      return;
    }

    // 2) Cookie
    const match = document.cookie.match(/(?:^|; )d2c_ref=([^;]+)/);
    const fromCookie = match ? decodeURIComponent(match[1]) : "";
    if (fromCookie) {
      setCode(fromCookie.toUpperCase());
      return;
    }

    // 3) localStorage
    try {
      const fromLS = localStorage.getItem("d2c_ref") || "";
      if (fromLS) {
        setCode(fromLS.toUpperCase());
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
      setCode(String(fromSession).toUpperCase());
    }
  }, [session]);

  return code;
}

