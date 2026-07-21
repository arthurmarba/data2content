"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";

function LoginContent() {
  const searchParams = useSearchParams();
  const startedAutomatically = useRef(false);
  const [failed, setFailed] = useState(false);

  const startGoogleLogin = useCallback(async () => {
    setFailed(false);

    try {
      await submitGoogleSignInFallback(
        searchParams.get("callbackUrl") || MAIN_DASHBOARD_ROUTE,
      );
    } catch {
      setFailed(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (startedAutomatically.current) return;
    startedAutomatically.current = true;
    void startGoogleLogin();
  }, [startGoogleLogin]);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-white px-6 text-center">
      <div className="w-full max-w-sm">
        <img
          src="/images/Colorido-Simbolo.png"
          alt="Data2Content"
          className="mx-auto h-auto w-32 brightness-0"
        />
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">
          {failed ? "Não foi possível abrir o Google" : "Abrindo login do Google..."}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {failed
            ? "Tente novamente para acessar sua conta."
            : "Você será redirecionado em instantes."}
        </p>

        {failed ? (
          <button
            type="button"
            onClick={() => void startGoogleLogin()}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/30 focus-visible:ring-offset-2"
          >
            Tentar novamente com Google
          </button>
        ) : (
          <div
            className="mx-auto mt-6 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950"
            aria-label="Carregando"
          />
        )}
      </div>
    </main>
  );
}

export default function LoginClient() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-white" />}>
      <LoginContent />
    </Suspense>
  );
}
