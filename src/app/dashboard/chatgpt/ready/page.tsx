import Link from "next/link";
import { ArrowLeft, Check, Instagram, Sparkles } from "lucide-react";

function getChatGptReturnUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CHATGPT_PLUGIN_URL?.trim();
  if (!configured) return "https://chatgpt.com/";
  try {
    const url = new URL(configured);
    return url.protocol === "https:" ? url.toString() : "https://chatgpt.com/";
  } catch {
    return "https://chatgpt.com/";
  }
}

export default async function ChatGptReadyPage({
  searchParams,
}: {
  searchParams: Promise<{ instagramLinked?: string }>;
}) {
  const params = await searchParams;
  const instagramLinked = params.instagramLinked === "true";

  return (
    <main className="min-h-[100dvh] bg-[#f6f7f9] px-5 py-12 text-[#17191d]">
      <section className="mx-auto w-full max-w-xl rounded-[32px] border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#17191d] text-white">
          {instagramLinked ? <Check aria-hidden size={22} /> : <Sparkles aria-hidden size={22} />}
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#6f51d8]">
          Data2Content + ChatGPT
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          {instagramLinked ? "Sua inteligência está pronta" : "Continue no ChatGPT"}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-black/60">
          {instagramLinked
            ? "O Instagram foi conectado. Agora a Data2Content pode contextualizar seus planejamentos, pautas e roteiros com o que aprende nos seus próprios conteúdos."
            : "Você pode continuar usando a Data2Content no ChatGPT com o contexto disponível na sua conta."}
        </p>

        {instagramLinked ? (
          <div className="mt-6 flex gap-3 rounded-2xl bg-[#f6f7f9] p-4 text-sm leading-6 text-black/65">
            <Instagram aria-hidden className="mt-0.5 shrink-0 text-[#6f51d8]" size={19} />
            <span>A conexão é somente para leitura. A Data2Content não publica nem altera conteúdos.</span>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
          <a
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#17191d] px-6 text-sm font-bold text-white transition hover:bg-black"
            href={getChatGptReturnUrl()}
          >
            Voltar ao ChatGPT
          </a>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/10 px-5 text-sm font-semibold text-black/65 transition hover:border-black/20 hover:text-black"
            href="/dashboard/profile?source=chatgpt"
          >
            <ArrowLeft aria-hidden size={16} />
            Ver perfil
          </Link>
        </div>
      </section>
    </main>
  );
}
