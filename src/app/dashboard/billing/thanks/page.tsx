// src/app/dashboard/billing/thanks/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaCheckCircle, FaWhatsapp, FaArrowRight, FaComments } from 'react-icons/fa';

export default function SubscriptionThanksPage() {
  const router = useRouter();
  const { update } = useSession();
  const vipGroupUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
    process.env.NEXT_PUBLIC_COMMUNITY_URL ||
    "/planning/whatsapp";

  // Atualiza a sessão para garantir que o status de assinatura esteja correto
  useEffect(() => {
    update();
  }, [update]);

  // Redireciona o usuário para o chat após alguns segundos
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/dashboard/chat');
    }, 5000); // 5 segundos

    return () => clearTimeout(timer); // Limpa o timer se o componente for desmontado
  }, [router]);

  const handleVipClick = () => {
    if (vipGroupUrl) {
      window.open(vipGroupUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="min-h-[70vh] bg-gradient-to-br from-slate-50 via-white to-rose-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 text-center sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <FaCheckCircle className="h-9 w-9" />
          </div>
          <h1 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">
            Assinatura confirmada! 🚀
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Plano ativo e benefícios liberados. Entre no grupo VIP para receber avisos e mentoria,
            ou siga direto para o chat com IA.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={handleVipClick}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
            >
              <FaWhatsapp className="h-4 w-4" />
              Acessar grupo VIP
            </button>
            <button
              type="button"
              onClick={() => router.replace('/dashboard/chat')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
            >
              <FaComments className="h-4 w-4" />
              Abrir chat com IA
            </button>
            <button
              type="button"
              onClick={() => router.replace('/dashboard')}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus-visible:ring-offset-2"
            >
              <FaArrowRight className="h-3.5 w-3.5" />
              Ir para o dashboard
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Ative o grupo VIP",
              body: "Receba alertas semanais, mentoria e networking com criadores.",
            },
            {
              title: "Use a IA no chat",
              body: "Peça diagnósticos, roteiros e negocie publis em minutos.",
            },
            {
              title: "Atualize seu mídia kit",
              body: "Mostre métricas atualizadas e valores sugeridos para marcas.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/60 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Próximos passos</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
