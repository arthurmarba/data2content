"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import {
  normalizeInternalCallbackUrl,
  submitGoogleSignInFallback,
} from "@/lib/auth/googleLogin";

function LoginContent() {
  const searchParams = useSearchParams();
  const startedAutomatically = useRef(false);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const isReviewAccess = searchParams.get("review") === "1";
  const callbackUrl = normalizeInternalCallbackUrl(
    searchParams.get("callbackUrl") || MAIN_DASHBOARD_ROUTE,
  );

  const startGoogleLogin = useCallback(async () => {
    setFailed(false);

    try {
      await submitGoogleSignInFallback(
        callbackUrl,
      );
    } catch {
      setFailed(true);
    }
  }, [callbackUrl]);

  useEffect(() => {
    if (isReviewAccess) return;
    if (startedAutomatically.current) return;
    startedAutomatically.current = true;
    void startGoogleLogin();
  }, [isReviewAccess, startGoogleLogin]);

  const submitReviewAccess = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reviewLoading) return;

    setReviewLoading(true);
    setReviewError(null);
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        callbackUrl,
        redirect: false,
      });

      if (!result?.ok) {
        setReviewError("E-mail ou senha de revisão inválidos.");
        return;
      }

      window.location.assign(result.url || callbackUrl);
    } catch {
      setReviewError("Não foi possível entrar. Tente novamente.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (isReviewAccess) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#FAFAFB] px-6 py-10">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-7 shadow-[0_18px_50px_rgba(24,24,27,0.08)] ring-1 ring-zinc-200/80 sm:p-8">
          <img
            src="/images/Colorido-Simbolo.png"
            alt="Data2Content"
            className="h-auto w-24 brightness-0"
          />
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
            Meta App Review
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950">
            Acesso de revisão
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Use as credenciais de teste fornecidas nas instruções do aplicativo.
          </p>

          <form className="mt-7 space-y-4" onSubmit={submitReviewAccess}>
            <label className="block text-sm font-semibold text-zinc-800">
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-normal text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-950/10"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-800">
              Senha
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                className="mt-2 min-h-12 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-normal text-zinc-950 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-950/10"
              />
            </label>

            {reviewError ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {reviewError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={reviewLoading}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reviewLoading ? "Entrando..." : "Entrar na conta de teste"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void startGoogleLogin()}
            className="mt-5 w-full text-center text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline"
          >
            Usar login do Google
          </button>
        </div>
      </main>
    );
  }

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
