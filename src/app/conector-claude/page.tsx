import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Mail } from "lucide-react";

const MCP_URL = "https://data2content.ai/api/mcp";

export const metadata: Metadata = {
  title: "Data2Content no Claude",
  description:
    "Como conectar a Data2Content ao Claude e o que perguntar: o que postar, se vale postar, sua semana, collabs e roteiros.",
};

const EXAMPLES: Array<{ prompt: string; what: string }> = [
  {
    prompt: "O que eu posto essa semana?",
    what: "Lê o seu mapa (narrativa e territórios) e as suas pautas, e devolve até três com gancho e motivo.",
  },
  {
    prompt: "Vale postar isso: um vídeo mostrando minha rotina de domingo com as crianças?",
    what: "Veredito sim ou não em três eixos: narrativa, audiência e marca.",
  },
  {
    prompt: "Como foi minha última semana no Instagram?",
    what: "Compara os últimos 7 dias com a sua própria mediana de 90 dias — nunca com outro criador.",
  },
  {
    prompt: "Quantos seguidores eu ganhei ontem?",
    what: "Saldo diário de seguidores, com o aviso de quando o dado é parcial.",
  },
  {
    prompt: "Quais foram meus melhores posts nos últimos 90 dias?",
    what: "Ranking dos seus conteúdos, com a métrica e o período usados.",
  },
  {
    prompt: "Me acha uma collab.",
    what: "Criadores da comunidade que dividem território com você, com uma ideia de gravação.",
  },
  {
    prompt: "Escreve um roteiro de Reels sobre a primeira vez que cozinhei pra minha sogra.",
    what: "Rascunho na sua voz, a partir dos seus próprios vídeos que funcionaram. Só salva se você pedir.",
  },
];

export default function ClaudeConnectorPage() {
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
          Conector para o Claude
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.035em]">A Data2Content dentro do Claude</h1>
        <p className="mt-4 text-[15px] leading-7 text-black/60">
          Pergunte ao Claude o que postar, se uma ideia vale a pena ou como foi a sua semana. A resposta vem do
          seu mapa na Data2Content — narrativa, territórios, pautas e os números dos seus próprios posts.
        </p>

        <h2 className="mt-10 text-lg font-black tracking-[-0.02em]">Como conectar</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-7 text-black/70">
          <li>
            No Claude, abra <strong>Configurações → Conectores</strong> e procure <strong>Data2Content</strong>.
          </li>
          <li>
            Clique em <strong>Conectar</strong> e entre com a sua conta Data2Content. Revise as permissões e
            autorize.
          </li>
          <li>Pronto. Em qualquer conversa, é só perguntar.</li>
        </ol>
        <p className="mt-4 text-sm leading-6 text-black/55">
          Se a Data2Content ainda não aparecer na busca, adicione um conector personalizado com o endereço{" "}
          <code className="rounded-md bg-[#f6f7f9] px-1.5 py-0.5 text-[13px] text-black/80">{MCP_URL}</code>.
        </p>

        <h2 className="mt-10 text-lg font-black tracking-[-0.02em]">O que você precisa</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-black/70">
          <li>Uma conta na Data2Content.</li>
          <li>
            O Instagram conectado na Data2Content, para as análises dos seus próprios posts. Sem ele, o Claude
            trabalha com o seu Norte e com padrões agregados da comunidade.
          </li>
          <li>Algumas análises dependem do seu plano na Data2Content.</li>
        </ul>

        <h2 className="mt-10 text-lg font-black tracking-[-0.02em]">O que perguntar</h2>
        <ul className="mt-4 space-y-3">
          {EXAMPLES.map((example) => (
            <li key={example.prompt} className="rounded-2xl bg-[#f6f7f9] px-5 py-4">
              <p className="text-[15px] font-bold leading-6">“{example.prompt}”</p>
              <p className="mt-1 text-sm leading-6 text-black/55">{example.what}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-10 text-lg font-black tracking-[-0.02em]">O que o conector lê e o que ele altera</h2>
        <p className="mt-4 text-[15px] leading-7 text-black/70">
          Quase tudo é leitura: mapa, pautas, métricas e conteúdos da sua própria conta. Ele só altera três coisas, e
          sempre porque você pediu: o seu Norte, um roteiro na sua biblioteca e as suas preferências de voz. Para
          revisar um roteiro, guarda o rascunho e as referências usadas por até sete dias. Ele nunca publica no
          Instagram, nunca envia mensagem e nunca lê a conversa inteira — só os campos de cada pergunta.
        </p>

        <h2 className="mt-10 text-lg font-black tracking-[-0.02em]">Como desconectar</h2>
        <p className="mt-4 text-[15px] leading-7 text-black/70">
          Em <strong>Configurações → Conectores</strong> no Claude, abra a Data2Content e desconecte. Para
          apagar os seus dados da Data2Content, escreva para o suporte.
        </p>

        <a
          href="mailto:support@data2content.ai?subject=Data2Content%20no%20Claude"
          className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#17191d] px-6 text-sm font-bold text-white transition hover:bg-black"
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
