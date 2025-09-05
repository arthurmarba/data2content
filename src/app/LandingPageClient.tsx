// Salve este arquivo em: src/app/LandingPageClient.tsx (ou o caminho correspondente no seu projeto)
"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from 'next-auth/react'; // <-- IMPORTAÇÃO ADICIONADA
import { track } from '@/lib/track'; // <-- IMPORTAÇÃO ADICIONADA (baseado no seu exemplo)

// Componentes externos
import LandingHeader from "./landing/components/LandingHeader"; // Verifique se este caminho está correto
import MediaKitView from '@/app/mediakit/[token]/MediaKitView'; // Verifique se este caminho está correto

// --- ÍCONES ---
const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);
const ConnectIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>);
const ReceiveIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>);
const SendIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>);
const AccelerateIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" /></svg>);
const UGCIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>);
const TimeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const StrategyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12A2.25 2.25 0 0020.25 14.25V3M3.75 21h16.5M16.5 3v11.25h2.25a2.25 2.25 0 002.25-2.25V3" /></svg>);


// --- COMPONENTES DE SEÇÃO ---

// Seção 1: Hero (Primeira Dobra)
const NewHeroSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  // Dados de demonstração
  const demoUser = { name: 'Criador Exemplo', profile_picture_url: '/images/Colorido-Simbolo.png', username: 'criador.exemplo', biography: 'Este é um Mídia Kit demonstrativo. Conecte seu Instagram para ver seu Mídia Kit real.', followers_count: 12300, _id: undefined };
  const demoKpis = { comparisonPeriod: 'last_30d_vs_previous_30d', followerGrowth: { currentValue: 320, previousValue: 250, percentageChange: 28.0 }, engagementRate: { currentValue: 4.2, previousValue: 3.7, percentageChange: 13.5 }, totalEngagement: { currentValue: 15200, previousValue: 13400, percentageChange: 13.4 }, postingFrequency: { currentValue: 4.5, previousValue: 3.8, percentageChange: 18.4 }, avgViewsPerPost: { currentValue: 8200, previousValue: 7600, percentageChange: 7.9 }, avgLikesPerPost: { currentValue: 1200, previousValue: 1080, percentageChange: 11.1 }, avgCommentsPerPost: { currentValue: 85, previousValue: 74, percentageChange: 14.9 }, avgSharesPerPost: { currentValue: 50, previousValue: 44, percentageChange: 13.6 }, avgSavesPerPost: { currentValue: 110, previousValue: 96, percentageChange: 14.6 }, avgReachPerPost: { currentValue: 9100, previousValue: 8300, percentageChange: 9.6 }, insightSummary: { followerGrowth: 'Crescimento consistente puxado por Reels educativos à noite.', engagementRate: 'Taxa acima da média em carrosséis com checklist e CTA de salvar.' } };
  const demoVideos = [ { _id: 'demo1', caption: 'Reel • Dica de app de produtividade (18s) — Para criadores; gancho em 2s; CTA de salvar', permalink: null, thumbnailUrl: 'https://placehold.co/300x400/1E293B/FFFFFF?text=Post', format: ['reel'], proposal: ['tips'], context: ['technology_digital'], tone: ['educational'], references: ['professions'], stats: { views: 12500, likes: 1380, comments: 95, shares: 71, saves: 150 }, }, { _id: 'demo2', caption: 'Carrossel (7 páginas) • Checklist para iniciantes — passo a passo prático', permalink: null, thumbnailUrl: 'https://placehold.co/300x400/1E293B/FFFFFF?text=Post', format: ['carousel'], proposal: ['tips'], context: ['education'], tone: ['educational'], references: [], stats: { views: 9800, likes: 910, comments: 60, shares: 40, saves: 210 }, }, { _id: 'demo3', caption: 'Reel • Review crítica de gadget (22s) — referência musical; opinião direta', permalink: null, thumbnailUrl: 'https://placehold.co/300x400/1E293B/FFFFFF?text=Post', format: ['reel'], proposal: ['review'], context: ['technology_digital'], tone: ['critical'], references: ['pop_culture_music'], stats: { views: 8600, likes: 740, comments: 48, shares: 33, saves: 95 }, } ];
  const demoDemographics = { follower_demographics: { gender: { male: 48, female: 52 }, age: { '18-24': 30, '25-34': 45, '35-44': 15, '45-54': 7, '55-64': 3 }, city: { 'São Paulo': 40, 'Rio de Janeiro': 25, 'Belo Horizonte': 10, 'Porto Alegre': 5, Lisboa: 5 } } };
  const demoSummary = { topPerformingFormat: { name: 'Reel 18–22s', metricName: 'Retenção', valueFormatted: '68%' }, topPerformingContext: { name: 'Tecnologia/Digital • Checklist', metricName: 'Salvamentos', valueFormatted: '+18%' } };

  return (
    <section id="hero" className="bg-brand-purple text-white">
      <div className="container mx-auto px-6 pt-16 md:pt-20 pb-24 md:pb-32 flex flex-col items-center text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
            Seu portfólio feito por IA para fechar mais jobs UGC
          </h1>
          <p className="text-lg md:text-xl text-purple-200 mb-4">
            Nossa IA classifica seu conteúdo do Instagram em proposta, contexto, tom e referência, e mantém seu portfólio atualizado em tempo real.
          </p>
          <p className="text-sm text-purple-300 mb-8">
            Também analisamos formato, dia/hora, retenção média e métricas-chave.
          </p>
          <div className="flex flex-col items-center space-y-4">
            {/* BOTÃO ATUALIZADO */}
            <button
              onClick={onCtaClick}
              className="bg-brand-magenta hover:opacity-90 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105"
            >
              👉 Criar meu portfólio grátis
            </button>
            <div>
              <p className="text-sm text-purple-300">
                Leva 1 minuto para conectar sua conta. 100% gratuito.
              </p>
              <p className="mt-4 text-xs text-purple-300 flex items-center justify-center">
                <LockIcon /> Segurança: usamos a API oficial do Instagram.
              </p>
            </div>
          </div>
        </div>
        
        <div className="w-full max-w-4xl lg:max-w-6xl rounded-xl border border-gray-600 bg-white shadow-2xl overflow-hidden mt-16">
          <div className="h-8 bg-gray-800 flex items-center px-4 border-b border-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 block rounded-full bg-red-500"></span>
              <span className="h-3 w-3 block rounded-full bg-yellow-500"></span>
              <span className="h-3 w-3 block rounded-full bg-green-500"></span>
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
            <MediaKitView user={demoUser as any} summary={demoSummary as any} videos={demoVideos as any} kpis={demoKpis as any} demographics={demoDemographics as any}/>
          </div>
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
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Você cria, a IA organiza</h2>
                 <div className="max-w-3xl mx-auto text-center mb-12 space-y-2">
                    <p className="text-lg text-gray-600">✓ Pare de atualizar PDF manualmente.</p>
                    <p className="text-lg text-gray-600">✓ Não perca mais jobs por falta de portfólio.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 text-left text-white">
                    <div className="bg-brand-purple p-6 rounded-2xl">
                        <h3 className="font-bold text-lg mb-2">Portfólio gratuito e automático</h3>
                        <p className="text-purple-200 text-sm">Sempre atualizado para você enviar para marcas e agências.</p>
                    </div>
                    <div className="bg-brand-magenta p-6 rounded-2xl relative">
                       <span className="absolute top-3 right-3 text-xs font-bold bg-white text-brand-magenta py-1 px-2 rounded-full">PRO</span>
                        <h3 className="font-bold text-lg mb-2">Mobi AI no WhatsApp</h3>
                        <p className="text-pink-100 text-sm">Um gestor proativo enviando alertas e sugestões de conteúdo diariamente.</p>
                    </div>
                    <div className="bg-brand-teal p-6 rounded-2xl">
                        <h3 className="font-bold text-lg mb-2">Planejamento estratégico</h3>
                        <p className="text-teal-100 text-sm">A IA classifica seu conteúdo (proposta, contexto, tom, referência) para destacar seu estilo único.</p>
                    </div>
                    <div className="bg-brand-orange p-6 rounded-2xl">
                        <h3 className="font-bold text-lg mb-2">Radar de oportunidades</h3>
                        <p className="text-orange-100 text-sm">Você entra no nosso radar para futuras campanhas que estamos prospectando.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

// Seção 3: "Como a IA funciona"
const HowAIWorksSection = () => {
    return (
        <section id="how-ai-works" className="py-20 bg-white text-gray-800">
            <div className="container mx-auto px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Como a IA funciona</h2>
                    <p className="text-lg text-gray-600 mb-12">
                      A IA lê seus posts e classifica automaticamente nas quatro dimensões, deixando seu portfólio claro para marcas.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-left">
                        <div className="border-t-2 border-brand-purple pt-4">
                            <h3 className="font-bold text-lg mb-2">Proposta</h3>
                            <p className="text-gray-600 text-sm">O objetivo do seu conteúdo (review, tutorial, storytelling...)</p>
                        </div>
                        <div className="border-t-2 border-brand-magenta pt-4">
                            <h3 className="font-bold text-lg mb-2">Contexto</h3>
                            <p className="text-gray-600 text-sm">O universo do seu nicho (beleza, fitness, viagem, tech...)</p>
                        </div>
                        <div className="border-t-2 border-brand-teal pt-4">
                            <h3 className="font-bold text-lg mb-2">Tom</h3>
                            <p className="text-gray-600 text-sm">Seu estilo de comunicação (educativo, humor, crítico...)</p>
                        </div>
                        <div className="border-t-2 border-brand-orange pt-4">
                            <h3 className="font-bold text-lg mb-2">Referência</h3>
                            <p className="text-gray-600 text-sm">A estética/formatos que inspiram a peça (trend, pop...)</p>
                        </div>
                    </div>
                     <p className="mt-12 text-sm text-gray-500">
                        A IA também considera formato, dia/hora, retenção e engajamento.
                    </p>
                </div>
            </div>
        </section>
    );
}

// Seção 4: Jornada do Usuário
const UserJourneySection = () => {
    return (
        <section id="user-journey" className="py-20 bg-white text-black">
            <div className="container mx-auto px-6">
                <div className="grid md:grid-cols-4 gap-8">
                    <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-purple-100 text-brand-purple mx-auto mb-4">
                            <ConnectIcon />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">1. Conecte</h3>
                        <p className="text-gray-600">Conecte seu Instagram de forma segura em 1 minuto.</p>
                    </div>
                    <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-pink-100 text-brand-magenta mx-auto mb-4">
                            <ReceiveIcon />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">2. Receba</h3>
                        <p className="text-gray-600">Receba seu portfólio automático e sempre atualizado.</p>
                    </div>
                    <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-teal-100 text-brand-teal mx-auto mb-4">
                            <SendIcon />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">3. Envie</h3>
                        <p className="text-gray-600">Envie seu link para marcas, agências e parceiros.</p>
                    </div>
                    <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
                        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 text-brand-orange mx-auto mb-4">
                            <AccelerateIcon />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">4. Acelere</h3>
                        <p className="text-gray-600">Se quiser acelerar, ative o Mobi AI no WhatsApp.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};


// Seção 5: "Para Quem é"
const ForWhomSection = () => {
    return (
        <section id="for-whom" className="py-20 bg-white text-black">
            <div className="container mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Criado para você</h2>
                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    <div className="bg-white border-t-4 border-brand-purple p-8 rounded-xl text-center shadow-lg transition-transform hover:-translate-y-1">
                        <UGCIcon />
                        <h3 className="font-bold text-xl mb-2">Criadores UGC</h3>
                        <p className="text-gray-600">Que querem se apresentar de forma profissional às marcas.</p>
                    </div>
                    <div className="bg-white border-t-4 border-brand-magenta p-8 rounded-xl text-center shadow-lg transition-transform hover:-translate-y-1">
                        <TimeIcon />
                        <h3 className="font-bold text-xl mb-2">Criadores sem tempo</h3>
                        <p className="text-gray-600">Que não querem perder horas atualizando portfólio manualmente.</p>
                    </div>
                    <div className="bg-white border-t-4 border-brand-teal p-8 rounded-xl text-center shadow-lg transition-transform hover:-translate-y-1">
                        <StrategyIcon />
                        <h3 className="font-bold text-xl mb-2">Criadores estratégicos</h3>
                        <p className="text-gray-600">Que buscam profissionalismo e eficiência sem complicação.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

// Seção 6: "CTA Final"
const FinalCTASection = ({ onCtaClick }: { onCtaClick: () => void }) => {
    return (
        <section id="final-cta" className="py-20 bg-brand-yellow text-black">
             <div className="container mx-auto px-6 text-center">
                <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
                  Pronto para ter seu portfólio em minutos?
                </h2>
                <p className="text-lg text-gray-800 mb-8">Junte-se a criadores que estão elevando o nível de suas carreiras.</p>
                <div className="flex flex-col items-center space-y-4">
                    {/* BOTÃO ATUALIZADO */}
                    <button
                      onClick={onCtaClick}
                      className="bg-black hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all transform hover:scale-105"
                    >
                      👉 Criar meu portfólio grátis
                    </button>
                    <div className="text-center">
                      <p className="text-sm text-gray-700">
                        Conecte seu Instagram e já saia com portfólio pronto + IA para planejar conteúdos.
                      </p>
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

  // FUNÇÃO DE LOGIN ADICIONADA
  const handleSignIn = () => {
    // A função 'track' é opcional, caso você a tenha configurada
    try {
      track('cta_create_portfolio_click', { location: 'landing_page' });
    } catch (error) {
      console.log("Função 'track' não definida. Pulando rastreamento.");
    }
    signIn('google', { callbackUrl: '/auth/complete-signup' });
  };

  // Lógica do Header dinâmico (mantida intacta)
  React.useEffect(() => {
    const root = document.documentElement;
    const findHeader = () => (headerWrapRef.current?.querySelector("header") ?? document.querySelector("header")) as HTMLElement | null;
    const apply = () => {
      const header = findHeader();
      if (!header) return;
      const h = header.getBoundingClientRect().height;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };
    apply();
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    const observeHeader = (header: HTMLElement) => { ro = new ResizeObserver(apply); ro.observe(header); };
    const hdr = findHeader();
    if (hdr) { observeHeader(hdr); } else {
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
    return () => { window.removeEventListener("load", apply); ro?.disconnect(); mo?.disconnect(); };
  }, []);

  return (
    <div className="bg-white font-sans">
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton />
      </div>

      <div aria-hidden className="h-[var(--landing-header-h,4.5rem)]" />

      <main style={{ scrollPaddingTop: "var(--landing-header-h, 4.5rem)" }}>
        {/* PASSANDO A FUNÇÃO DE LOGIN PARA OS COMPONENTES */}
        <NewHeroSection onCtaClick={handleSignIn} />
        <BenefitsSection />
        <HowAIWorksSection />
        <UserJourneySection />
        <ForWhomSection />
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