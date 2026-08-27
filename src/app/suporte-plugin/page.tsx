import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Suporte do plugin Data2Content",
  description: "Ajuda para conectar e usar a Data2Content no ChatGPT.",
};

export default function PluginSupportPage() {
  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9] px-5 py-10 text-[#17191d] sm:py-16">
      <section className="mx-auto w-full max-w-2xl rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-10">
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
          Suporte do plugin
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.035em]">Como podemos ajudar?</h1>
        <p className="mt-4 text-[15px] leading-7 text-black/60">
          Fale com a equipe se tiver dificuldade para entrar na conta, autorizar o plugin, conectar o
          Instagram ou usar o contexto da Data2Content no ChatGPT.
        </p>

        <a
          href="mailto:support@data2content.ai?subject=Suporte%20do%20plugin%20Data2Content"
          className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17191d] px-6 text-sm font-bold text-white transition hover:bg-black"
        >
          <Mail aria-hidden size={17} />
          support@data2content.ai
        </a>

        <div className="mt-9 grid gap-3 border-t border-black/10 pt-7 text-sm sm:grid-cols-2">
          <Link
            href="/politica-de-privacidade"
            className="inline-flex items-center justify-between rounded-2xl bg-[#f6f7f9] px-5 py-4 font-semibold"
          >
            Política de privacidade
            <ExternalLink aria-hidden size={16} />
          </Link>
          <Link
            href="/termos-e-condicoes"
            className="inline-flex items-center justify-between rounded-2xl bg-[#f6f7f9] px-5 py-4 font-semibold"
          >
            Termos de uso
            <ExternalLink aria-hidden size={16} />
          </Link>
        </div>

        <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-black/55">
          <ArrowLeft aria-hidden size={16} />
          Voltar para Data2Content
        </Link>
      </section>
    </main>
  );
}
