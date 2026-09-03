import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Instagram, LockKeyhole, Sparkles } from "lucide-react";
import { ChatGptFunnelTracker } from "@/app/chatgpt/ChatGptFunnelTracker";

export const metadata: Metadata = {
  title: "Data2Content no ChatGPT",
  description: "Entenda quais contextos a Data2Content pode usar no ChatGPT e como gerenciar sua conta.",
};

const contextLevels = [
  {
    icon: Sparkles,
    title: "Norte e padrões agregados",
    description:
      "Contas cadastradas podem declarar seu Norte e criar pautas, estratégias e roteiros com padrões agregados da comunidade Data2Content.",
  },
  {
    icon: Instagram,
    title: "Contexto dos seus conteúdos",
    description:
      "Quando esse recurso está disponível na conta e o Instagram está conectado, a Data2Content também considera a voz, os formatos e os padrões observados nos seus próprios conteúdos.",
  },
  {
    icon: LockKeyhole,
    title: "Controle do usuário",
    description:
      "A conexão é somente para leitura. A Data2Content não publica no Instagram e o plugin acessa apenas os dados necessários para o pedido feito no ChatGPT.",
  },
];

export default function ChatGptResourcesPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9] px-5 py-10 text-[#17191d] sm:py-16">
      <ChatGptFunnelTracker step="resources_viewed" context="informational_bridge" />
      <section className="mx-auto w-full max-w-3xl overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <header className="border-b border-black/10 px-6 py-8 sm:px-10 sm:py-10">
          <Link href="/" className="inline-flex items-center gap-3 text-sm font-bold">
            <span className="relative h-9 w-9 overflow-hidden rounded-xl bg-white">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="scale-[2.35] object-contain"
                priority
              />
            </span>
            Data2Content
          </Link>
          <p className="mt-9 text-xs font-bold uppercase tracking-[0.18em] text-[#6f51d8]">
            Data2Content + ChatGPT
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">
            O contexto usado pelo plugin depende dos recursos disponíveis na sua conta
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-black/60">
            Esta página explica a diferença entre o contexto base e a inteligência dos seus próprios
            conteúdos. O plugin não realiza pagamentos nem inicia assinaturas dentro do ChatGPT.
          </p>
        </header>

        <div className="grid gap-4 px-6 py-8 sm:px-10 sm:py-10">
          {contextLevels.map(({ icon: Icon, title, description }) => (
            <article key={title} className="flex gap-4 rounded-2xl bg-[#f6f7f9] p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6f51d8] shadow-sm">
                <Icon aria-hidden size={19} />
              </span>
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-black/60">{description}</p>
              </div>
            </article>
          ))}

          <div className="mt-2 flex flex-col gap-3 border-t border-black/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-6 text-black/55">
              Acesse sua conta para conferir seu Norte, sua conexão com o Instagram e os recursos já
              disponíveis para você.
            </p>
            <Link
              href="/dashboard/profile?source=chatgpt"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#17191d] px-6 text-sm font-bold text-white transition hover:bg-black"
            >
              Abrir minha conta
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
