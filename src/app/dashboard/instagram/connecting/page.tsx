"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

export default function InstagramConnectingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const [message, setMessage] = useState<string>("A processar retorno do Facebook…");
  const [error, setError] = useState<string | null>(null);
  const onceRef = useRef(false);

  const faqLinkForError = (err: string | null): { href: string; label: string } | null => {
    if (!err) return null;
    const e = err.toLowerCase();
    if (e.includes("#10") || e.includes("#200") || e.includes("permiss")) {
      return { href: "/dashboard/instagram/faq#erros-permissoes", label: "Permissão negada (#10/#200) — abrir solução" };
    }
    if (e.includes("token") || e.includes("expirado") || e.includes("inválido")) {
      return { href: "/dashboard/instagram/faq#token-expirado", label: "Token expirado/ inválido — abrir solução" };
    }
    if (e.includes("já vinculado") || e.includes("alreadylinked") || e.includes("facebookalreadylinked")) {
      return { href: "/dashboard/instagram/faq#conta-vinculada", label: "Conta já vinculada — abrir solução" };
    }
    if (e.includes("não encontramos") || e.includes("sem contas") || e.includes("no_ig_account") || e.includes("no ig account")) {
      return { href: "/dashboard/instagram/faq#ig-profissional", label: "Conta IG não encontrada — abrir solução" };
    }
    return { href: "/dashboard/instagram/faq#ajuda", label: "Ver ajuda — FAQ" };
  };

  useEffect(() => {
    // Limpa o instagramLinked=true da URL
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [sp]);

  useEffect(() => {
    if (onceRef.current) return;
    if (status === "loading") return;
    onceRef.current = true;

    const run = async () => {
      try {
        setMessage("Atualizando sessão…");
        const updated = await update();
        const u = updated?.user as any;
        if (!u) {
          setError("Não foi possível atualizar sua sessão. Tente novamente.");
          return;
        }

        if (u.instagramConnected) {
          router.replace("/dashboard/media-kit?instagramLinked=true");
          return;
        }

        const accounts = Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : [];

        if (accounts.length === 1 && accounts[0]?.igAccountId) {
          setMessage("Conectando sua única conta disponível…");
          const res = await fetch("/api/instagram/connect-selected-account", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ instagramAccountId: accounts[0].igAccountId }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.error || "Falha ao finalizar a conexão.");
          }
          await update();
          router.replace("/dashboard/media-kit?instagramLinked=true");
          return;
        }

        if (accounts.length > 1) {
          setMessage("Várias contas encontradas. Redirecionando para seleção…");
          router.replace("/dashboard/chat?instagramLinked=true");
          return;
        }

        setError(
          u.igConnectionError ||
            "Não encontramos contas Instagram profissionais nesta conta do Facebook. Verifique as permissões e tente novamente."
        );
      } catch (e: any) {
        setError(e?.message || "Erro inesperado ao finalizar a conexão.");
      }
    };
    run();
  }, [status, update, router]);

  return (
    <main className="max-w-xl mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Conectando Instagram…</h1>
      {!error ? (
        <p className="text-gray-600 mt-3">{message}</p>
      ) : (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 inline-block text-left max-w-lg">
          <p className="font-medium">Não foi possível concluir:</p>
          <p className="text-sm mt-1">{error}</p>
          {(() => {
            const e = (error || '').toLowerCase();
            const isNoIgDetected =
              e.includes('nenhuma conta profissional do instagram') ||
              e.includes('conta profissional do instagram') ||
              e.includes('não encontramos contas instagram') ||
              e.includes('no_ig_account') ||
              e.includes('no ig account');
            const isNoPageDetected = e.includes('nenhuma página') || e.includes('no pages');
            if (isNoIgDetected || isNoPageDetected) {
              return (
                <div className="text-sm text-red-800 mt-2">
                  <p className="font-medium">Checklist para resolver:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      Tornar sua conta IG <b>Profissional/Criador</b> e vincular a uma Página do Facebook.
                    </li>
                    <li>
                      Caso não tenha Página, crie uma e vincule seu IG a ela.
                    </li>
                    <li>
                      Refaça a conexão logando no Facebook que administra essa Página.
                    </li>
                  </ul>
                  <p className="mt-2">
                    Ajuda passo a passo:
                    {" "}
                    <a href="/dashboard/instagram/faq#ig-profissional" className="underline text-blue-700 hover:text-blue-800">IG Profissional</a>
                    {" • "}
                    <a href="/dashboard/instagram/faq#criar-pagina" className="underline text-blue-700 hover:text-blue-800">Criar Página</a>
                    {" • "}
                    <a href="/dashboard/instagram/faq#vincular-ig-pagina" className="underline text-blue-700 hover:text-blue-800">Vincular IG à Página</a>
                  </p>
                </div>
              );
            }
            return null;
          })()}
          {faqLinkForError(error) && (
            <p className="text-sm mt-2">
              <a
                href={faqLinkForError(error)!.href}
                className="underline font-medium text-blue-700 hover:text-blue-800"
              >
                {faqLinkForError(error)!.label}
              </a>
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.replace("/dashboard/instagram/connect")}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.replace("/dashboard/onboarding")}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
