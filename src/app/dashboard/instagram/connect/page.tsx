"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function InstagramPreConnectPage() {
  const router = useRouter();
  const { status } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/iniciar-vinculacao-fb", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Falha ao preparar a vinculação.");
      }
      // Pós-callback iremos para a página de conexão em progresso
      signIn("facebook", { callbackUrl: "/dashboard/instagram/connecting?instagramLinked=true" });
    } catch (e: any) {
      setError(e?.message || "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Conectar Instagram</h1>
      <p className="text-gray-600 mt-2">
        Antes de continuar, entenda o que iremos pedir no Facebook e por quê.
      </p>

      <section className="mt-6 grid gap-4">
        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-medium text-gray-900">O que será pedido</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>Localizar sua conta Instagram profissional.</li>
            <li>Ler métricas e posts públicos (somente leitura).</li>
          </ul>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-medium text-gray-900">Pré-requisitos (checklist rápido)</h2>
          <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
            <li>
              Sua conta é <b>Profissional / Criador</b>. 
              <a className="ml-1 underline text-blue-700 hover:text-blue-800" href="/dashboard/instagram/faq#ig-profissional">Como tornar profissional</a>
            </li>
            <li>
              Você possui uma <b>Página do Facebook</b>.
              <a className="ml-1 underline text-blue-700 hover:text-blue-800" href="/dashboard/instagram/faq#criar-pagina">Como criar página</a>
            </li>
            <li>
              Seu Instagram está <b>vinculado</b> a essa Página.
              <a className="ml-1 underline text-blue-700 hover:text-blue-800" href="/dashboard/instagram/faq#vincular-ig-pagina">Como vincular IG à Página</a>
            </li>
            <li>
              Faça login no Facebook com o <b>mesmo usuário</b> que administra a Página.
            </li>
          </ul>
        </div>

        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="font-medium text-gray-900">Segurança</h2>
          <p className="text-sm text-gray-700 mt-2">Plataforma credenciada pela Meta, com acesso de leitura às métricas.</p>
          <p className="text-xs text-gray-500 mt-2">Quer detalhes? <a href="/dashboard/instagram/faq" className="underline text-blue-700 hover:text-blue-800">Veja o FAQ</a>.</p>
        </div>
      </section>

      {error && (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        <button
          onClick={startConnect}
          disabled={loading || status === "loading"}
          className={`inline-flex items-center px-4 py-2 rounded-md text-white ${loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Abrindo Facebook…" : "Entendi, conectar com Facebook"}
        </button>
        <button
          onClick={() => router.push("/dashboard/home?intent=instagram")}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Conectar depois
        </button>
        <button
          onClick={() => router.push("/dashboard/instagram/faq")}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Preciso de ajuda (FAQ)
        </button>
      </div>
    </main>
  );
}
