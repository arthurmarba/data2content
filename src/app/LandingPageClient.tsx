// Salve este arquivo em: src/app/LandingPageClient.tsx
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { track } from "@/lib/track";

// Componentes externos
import LandingHeader from "./landing/components/LandingHeader";
import WhatsAppCarousel from "./landing/components/WhatsAppCarousel";
import { proposalCategories, contextCategories, toneCategories, referenceCategories } from "@/app/lib/classification";
import PlannerPreviewSection from "./landing/components/PlannerPreviewSection";
// import FeatureRowsSection from "./landing/components/FeatureRowsSection"; // removido da landing

// --- ÍCONES ---
const LockIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4 inline-block mr-1 flex-shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);
// (Removidos ícones exclusivos da seção Jornada: Connect, Receive, Send, Accelerate)

// --- COMPONENTES DE SEÇÃO ---

// Seção 1: Hero (Primeira Dobra) — agora com link real e iframe de exemplo
const NewHeroSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  // URL real enviada por você
  const DEMO_URL = "https://data2content.ai/mediakit/arthur-marba";
  // ID do vídeo do YouTube (defina em NEXT_PUBLIC_LANDING_YT_VIDEO_ID para customizar)
  const YT_VIDEO_ID = process.env.NEXT_PUBLIC_LANDING_YT_VIDEO_ID || "K6oxq0oQAvU";

  const [copied, setCopied] = React.useState(false);

  async function handleCopyDemoLink() {
    try {
      await navigator.clipboard.writeText(DEMO_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      try {
        track?.("demo_mediakit_copy", { location: "landing_hero" });
      } catch {}
    } catch {
      // Fallback simples
      alert(`Link: ${DEMO_URL}`);
    }
  }

  return (
    <section id="hero" className="bg-brand-purple text-white">
      <div className="container mx-auto px-6 pt-16 md:pt-20 pb-24 md:pb-32 flex flex-col items-center text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-4">
          A inteligência do ChatGPT, finalmente conectada ao seu Instagram.
          </h1>
          <p className="text-lg md:text-xl text-white/90 mb-4">
          A única IA que analisa seus posts, identifica suas melhores narrativas e entrega um plano de conteúdo perfeito no seu WhatsApp.
          </p>
          <p className="text-xs md:text-sm text-white/80 mb-6 inline-block px-2 py-1 rounded-full bg-white/10 ring-1 ring-white/10">
            Afiliados ganham 50% de comissão
          </p>

          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={onCtaClick}
              className="bg-brand-magenta hover:opacity-90 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta/40"
            >
              👉 Conectar ChatGPT ao meu Instagram
            </button>

            {/* Link para o relatório real + botão de copiar */}
            <div className="flex items-center gap-3">
              <Link
                href={DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  try {
                    track?.("demo_mediakit_click", { location: "landing_hero" });
                  } catch {}
                }}
                className="text-sm underline underline-offset-4 text-white/80 hover:text-white"
              >
                Ver relatório de exemplo (abre em nova aba)
              </Link>
              <button
                type="button"
                onClick={handleCopyDemoLink}
                className="text-xs px-3 py-1 rounded-md border border-purple-300/40 text-purple-100 hover:bg-white/10"
                aria-label="Copiar link do relatório de exemplo"
              >
                {copied ? "Copiado!" : "Copiar link"}
              </button>
            </div>

            <div>
              <p className="text-sm text-white/80 mt-2">Leva 1 minuto para conectar sua conta. 100% gratuito.</p>
              <p className="mt-3 text-xs text-white/70 flex items-center justify-center">
                <LockIcon /> Segurança: usamos a API oficial do Instagram.
              </p>
            </div>
          </div>
        </div>

        {/* Player de vídeo do YouTube (acima do carrossel) */}
        <div className="w-full max-w-4xl lg:max-w-6xl mt-10">
          <div className="relative w-full aspect-[16/9] min-h-[220px] rounded-xl overflow-hidden ring-1 ring-white/15 shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${YT_VIDEO_ID}?rel=0`}
              title="Vídeo de apresentação"
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>

        {/* Título da seção do carrossel de WhatsApp */}
        <div className="w-full max-w-4xl lg:max-w-6xl mt-12 flex items-center justify-between text-white/90">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Mensagens no WhatsApp</h2>
          <span aria-hidden className="inline-block" />
        </div>

        {/* Carrossel de mensagens WhatsApp acima da pré-visualização */}
        <div className="w-full max-w-4xl lg:max-w-6xl mt-4">
          <WhatsAppCarousel />
        </div>

        {/* Título e ação da pré-visualização */}
        <div className="w-full max-w-4xl lg:max-w-6xl mt-10 flex items-center justify-between text-white/90">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Prévia do Relatório Gratuito</h2>
          <Link href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-white/80 hover:text-white underline underline-offset-4">
            Abrir em nova aba
          </Link>
        </div>
        {/* Janela de pré-visualização com o mídia kit REAL via iframe */}
        <div className="w-full max-w-4xl lg:max-w-6xl rounded-xl border border-gray-600 bg-white shadow-2xl overflow-hidden mt-4">
          <div className="h-8 bg-gray-800 flex items-center px-4 border-b border-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 block rounded-full bg-red-500"></span>
              <span className="h-3 w-3 block rounded-full bg-yellow-500"></span>
              <span className="h-3 w-3 block rounded-full bg-green-500"></span>
            </div>
          </div>
          <iframe
            src={DEMO_URL}
            className="w-full block h-[85vh] md:h-[92vh] lg:h-[96vh]"
            loading="lazy"
            referrerPolicy="no-referrer"
            aria-label="Prévia do Relatório"
          />
        </div>
      </div>
    </section>
  );
};

// Seção 2: Benefícios
const BenefitsSection = () => {
  return (
    <section id="benefits" className="py-20 bg-white text-black">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">Você cria, a IA organiza</h2>
        <div className="max-w-3xl mx-auto text-center mb-12 space-y-2">
          <p className="text-lg text-gray-600">✓ Pare de atualizar PDF manualmente.</p>
          <p className="text-lg text-gray-600">✓ Não perca mais jobs por falta de portfólio.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
          <div className="bg-white rounded-2xl ring-1 ring-black/10 shadow-md border-t-4 border-brand-purple p-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Relatório gratuito e automático</h3>
            <p className="text-gray-600 text-sm">Sempre atualizado para você enviar para marcas e agências.</p>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-black/10 shadow-md border-t-4 border-brand-magenta p-6 relative">
            <span className="absolute top-3 right-3 text-xs font-bold bg-brand-magenta text-white py-1 px-2 rounded-full">PRO</span>
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Mobi AI no WhatsApp</h3>
            <p className="text-gray-600 text-sm">Um gestor proativo enviando alertas e sugestões de conteúdo diariamente.</p>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-black/10 shadow-md border-t-4 border-brand-teal p-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Planejamento estratégico</h3>
            <p className="text-gray-600 text-sm">
              A IA classifica seu conteúdo (proposta, contexto, tom, referência) para destacar seu estilo único.
            </p>
          </div>
          <div className="bg-white rounded-2xl ring-1 ring-black/10 shadow-md border-t-4 border-brand-orange p-6">
            <h3 className="font-semibold text-lg text-gray-900 mb-2">Radar de oportunidades</h3>
            <p className="text-gray-600 text-sm">Você entra no nosso radar para futuras campanhas que estamos prospectando.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// Seção 3: "Como a IA funciona"
const HowAIWorksSection = () => {
  // Helper: achata categorias (inclui subcategorias) e retorna labels únicos
  const flattenLabels = (cats: any[]): string[] => {
    const out: string[] = [];
    const walk = (list: any[]) => {
      list.forEach((c) => {
        if (c?.label) out.push(String(c.label));
        if (Array.isArray(c?.subcategories) && c.subcategories.length) walk(c.subcategories);
      });
    };
    walk(cats);
    return Array.from(new Set(out));
  };

  const proposalLabels = flattenLabels(proposalCategories).slice(0, 10);
  const contextLabels = flattenLabels(contextCategories).slice(0, 10);
  const toneLabels = flattenLabels(toneCategories).slice(0, 10);
  const referenceLabels = flattenLabels(referenceCategories).slice(0, 10);

  const Chip = ({ children, color }: { children: React.ReactNode; color: 'purple' | 'magenta' | 'teal' | 'orange' }) => {
    const styles: Record<string, string> = {
      purple: 'bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple/30',
      magenta: 'bg-brand-magenta/10 text-brand-magenta ring-1 ring-brand-magenta/30',
      teal: 'bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal/30',
      orange: 'bg-brand-orange/10 text-brand-orange ring-1 ring-brand-orange/30',
    };
    return (
      <span className={`text-xs md:text-sm px-2.5 py-1 rounded-full whitespace-nowrap ${styles[color]}`}>{children}</span>
    );
  };

  return (
    <section id="how-ai-works" className="py-20 bg-white text-gray-800">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Como a IA funciona</h2>
          <p className="text-lg text-gray-600 mb-12">
            A IA lê seus posts e classifica automaticamente em quatro dimensões. Veja exemplos das categorias que mapeamos em cada uma.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
            <div className="border-t-2 border-brand-purple pt-4">
              <h3 className="font-bold text-xl md:text-2xl mb-2 text-brand-purple">Proposta</h3>
              <p className="text-gray-600 text-sm mb-3">O objetivo do seu conteúdo (review, tutorial, storytelling...)</p>
              <div className="flex flex-wrap gap-2">
                {proposalLabels.map((l) => (
                  <Chip key={`p-${l}`} color="purple">{l}</Chip>
                ))}
              </div>
            </div>
            <div className="border-t-2 border-brand-magenta pt-4">
              <h3 className="font-bold text-xl md:text-2xl mb-2 text-brand-magenta">Contexto</h3>
              <p className="text-gray-600 text-sm mb-3">O universo do seu nicho (beleza, fitness, viagem, tech...)</p>
              <div className="flex flex-wrap gap-2">
                {contextLabels.map((l) => (
                  <Chip key={`c-${l}`} color="magenta">{l}</Chip>
                ))}
              </div>
            </div>
            <div className="border-t-2 border-brand-teal pt-4">
              <h3 className="font-bold text-xl md:text-2xl mb-2 text-brand-teal">Tom</h3>
              <p className="text-gray-600 text-sm mb-3">Seu estilo de comunicação (educativo, humor, crítico...)</p>
              <div className="flex flex-wrap gap-2">
                {toneLabels.map((l) => (
                  <Chip key={`t-${l}`} color="teal">{l}</Chip>
                ))}
              </div>
            </div>
            <div className="border-t-2 border-brand-orange pt-4">
              <h3 className="font-bold text-xl md:text-2xl mb-2 text-brand-orange">Referência</h3>
              <p className="text-gray-600 text-sm mb-3">Estética/formatos que inspiram a peça (trend, pop...)</p>
              <div className="flex flex-wrap gap-2">
                {referenceLabels.map((l) => (
                  <Chip key={`r-${l}`} color="orange">{l}</Chip>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-12 text-sm text-gray-500">A IA também considera formato, dia/hora, retenção e engajamento.</p>
        </div>
      </div>
    </section>
  );
};

// (Seção Jornada do Usuário removida conforme solicitação)

// (Seção "Criado para você" removida conforme solicitação)

// Seção 6: "CTA Final"
const FinalCTASection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  return (
    <section id="final-cta" className="py-20 bg-brand-yellow text-black">
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Pronto para ter seu relatório em minutos?</h2>
        <p className="text-lg text-gray-800 mb-8">Junte-se a criadores que estão elevando o nível de suas carreiras.</p>
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={onCtaClick}
            className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105"
          >
            👉 Conectar ChatGPT ao meu Instagram
          </button>
          <div className="text-center">
            <p className="text-sm text-gray-700">Conecte seu Instagram e já saia com relatório pronto + IA para planejar conteúdos.</p>
            <p className="mt-4 text-xs text-gray-600 flex items-center justify-center">
              <LockIcon /> Segurança: usamos a API oficial do Instagram.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- COMPONENTE PRINCIPAL ---
export default function LandingPageClient() {
  const headerWrapRef = React.useRef<HTMLDivElement>(null);

  // CTA de login/conexão
  const handleSignIn = () => {
    try {
      track("cta_create_portfolio_click", { location: "landing_page" });
    } catch {}
    signIn("google", { callbackUrl: "/auth/complete-signup" });
  };

  // Lógica do Header dinâmico (mantida)
  React.useEffect(() => {
    const root = document.documentElement;

    const findHeader = () =>
      (headerWrapRef.current?.querySelector("header") ??
        document.querySelector("header")) as HTMLElement | null;

    const apply = () => {
      const header = findHeader();
      if (!header) return;
      const h = header.getBoundingClientRect().height;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };

    apply();

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const observeHeader = (header: HTMLElement) => {
      ro = new ResizeObserver(apply);
      ro.observe(header);
    };

    const hdr = findHeader();
    if (hdr) {
      observeHeader(hdr);
    } else {
      const target = headerWrapRef.current ?? document;
      mo = new MutationObserver(() => {
        const found = findHeader();
        if (!found) return;
        apply();
        observeHeader(found);
        mo?.disconnect();
        mo = null;
      });
      target && mo.observe(target, { childList: true, subtree: true });
    }

    window.addEventListener("load", apply);
    return () => {
      window.removeEventListener("load", apply);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return (
    <div className="bg-white font-sans">
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton />
      </div>

      <div aria-hidden className="h-[var(--landing-header-h,4.5rem)]" />

      <main style={{ scrollPaddingTop: "var(--landing-header-h, 4.5rem)" }}>
        <NewHeroSection onCtaClick={handleSignIn} />
        {/* <FeatureRowsSection /> removido conforme pedido */}
        <BenefitsSection />
        <HowAIWorksSection />
        <PlannerPreviewSection />
        <FinalCTASection onCtaClick={handleSignIn} />
      </main>

      <footer className="text-center py-8 bg-black text-white border-t border-gray-800">
        <div className="mb-4 flex justify-center items-center gap-2">
          <div className="relative h-6 w-6 overflow-hidden">
            <Image
              src="/images/Colorido-Simbolo.png"
              alt="Data2Content"
              fill
              className="object-contain object-center scale-[2.4]"
              priority
            />
          </div>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          © {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <Link href="/politica-de-privacidade" className="text-gray-400 hover:text-brand-magenta transition-colors">
            Política de Privacidade
          </Link>
          <Link href="/termos-e-condicoes" className="text-gray-400 hover:text-brand-magenta transition-colors">
            Termos e Condições
          </Link>
        </div>
      </footer>
    </div>
  );
}
