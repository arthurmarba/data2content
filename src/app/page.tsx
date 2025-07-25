"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { TypeAnimation } from "react-type-animation";
import { FaGoogle, FaGem, FaChartPie, FaHeart, FaBriefcase, FaStar, FaPaintBrush, FaBullhorn, FaChalkboardTeacher, FaQuestionCircle, FaCheckCircle, FaTimesCircle, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// --- DADOS E CONSTANTES DA PÁGINA (CORRIGIDO) ---
const exampleScreenshots = [
  // Caminhos atualizados para apontar para a pasta /public/images/
  { title: "(1) Alerta Diário Recebido", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.20.png" },
  { title: "(2) Análise de Conteúdo", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.20 (1).png" },
  { title: "(3) Sugestão Estratégica", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21.png" },
  { title: "(4) Ideia de Conteúdo", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (1).png" },
  { title: "(5) Usuário Tira Dúvidas", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (2).png" }
];

const creatorTypes = [
    {
        icon: FaChalkboardTeacher,
        title: "Especialistas e Coaches",
        description: "Transforme seu conhecimento em conteúdo de alto valor que educa e converte."
    },
    {
        icon: FaBullhorn,
        title: "Influenciadores e Atores",
        description: "Entenda sua audiência para aumentar o engajamento e fechar mais publicidades."
    },
    {
        icon: FaStar,
        title: "Marcas e Empreendedores",
        description: "Use seu Instagram como uma ferramenta de negócios poderosa, com estratégia baseada em dados."
    }
];

const testimonials = [
  {
    name: "Juliana Alves",
    handle: "@jualvesfit",
    quote: "O Tuca é revolucionário. Em uma semana, ele identificou um formato de vídeo que eu tinha abandonado e que era um sucesso. Retomei e meu alcance dobrou.",
    avatarUrl: "/images/default-profile.png" // Adicionado avatar padrão
  },
  {
    name: "Marcos Lins",
    handle: "@marcoslins.dev",
    quote: "Finalmente entendi meus números sem precisar de planilhas. Os alertas proativos são como ter um estrategista na equipe, mas no meu WhatsApp.",
    avatarUrl: "/images/default-profile.png" // Adicionado avatar padrão
  },
  {
    name: "Carla Souza",
    handle: "@carladesign",
    quote: "O programa de afiliados é genial! Já paguei minha assinatura só com as comissões, e meus amigos amaram o desconto e a ferramenta.",
    avatarUrl: "/images/default-profile.png" // Adicionado avatar padrão
  }
];

const faqItems = [
     {
         q: "Qual a diferença da Nossa Inteligência Artificial para outros assistentes ou ferramentas?",
         a: "Nossa Inteligência Artificial é única por integrar múltiplos superpoderes focados nos SEUS resultados:\n\n* <strong class='font-semibold text-brand-dark'>Análise Conectada:</strong> Acessa SEU Instagram para insights de métricas e conteúdos REAIS (atuais e históricos via print).\n* <strong class='font-semibold text-brand-dark'>Entende Seu Conteúdo:</strong> Categoriza posts por Formato, Propósito e Contexto, revelando padrões.\n* <strong class='font-semibold text-brand-dark'>Timing Inteligente:</strong> Otimiza horários para CADA tipo de conteúdo, maximizando impacto.\n* <strong class='font-semibold text-brand-dark'>Expert + IA Proativa:</strong> Treinado por Arthur Marbá, monitora 24/7 e envia alertas estratégicos.\n* <strong class='font-semibold text-brand-dark'>Prático no WhatsApp:</strong> Interação simples, insights diretos, sem dashboards.\n* <strong class='font-semibold text-brand-dark'>De Dados a Roteiros:</strong> Analisa e GERA ROTEIROS para replicar seus sucessos.\n* <strong class='font-semibold text-brand-dark'>Evolui com Você:</strong> Aprende com suas interações e preferências.\n* <strong class='font-semibold text-brand-dark'>Inspiração da Comunidade:</strong> Exemplos de posts de sucesso (privacidade garantida).\n* <strong class='font-semibold text-brand-dark'>Gestão de Publis:</strong> Ajuda a organizar e otimizar parcerias.\n\nResumindo: Nossa Inteligência Artificial é seu consultor estratégico e criativo completo para Instagram, no WhatsApp."
     },
     { q: "Como a Inteligência Artificial da D2C define o melhor horário e dia para postar?", a: "A Nossa Inteligência Artificial realiza uma <strong class='font-semibold text-brand-dark'>análise combinatória profunda</strong>, cruzando dados de horário, duração, formato, propósito e contexto do seu conteúdo. Ela identifica os momentos em que seu público está mais receptivo a cada tipo de post, visando seus objetivos (ex: mais views em Reels de Dicas às terças, 19h). Converse com a Nossa Inteligência Artificial para investigar esses padrões." },
     { q: "Como a Inteligência Artificial da D2C me ajuda a criar conteúdo e roteiros?", a: "A Nossa Inteligência Artificial impulsiona sua criatividade e produção:\n\n* <strong class='font-semibold text-brand-dark'>Identifica Seus Sucessos:</strong> Analisa métricas e categoriza seu conteúdo (formato, propósito, contexto, horário) para encontrar seus posts de melhor desempenho.\n* <strong class='font-semibold text-brand-dark'>Gera Roteiros e Estruturas:</strong> Com base nesses sucessos, peça à Nossa Inteligência Artificial roteiros ou variações de temas que já funcionaram para seu público.\n* <strong class='font-semibold text-brand-dark'>Supera Bloqueios Criativos:</strong> Use seus próprios acertos como ponto de partida, economizando tempo.\n* <strong class='font-semibold text-brand-dark'>Criatividade Direcionada por Dados:</strong> Receba ideias com maior probabilidade de sucesso, baseadas na análise do seu desempenho." },
     { q: "Como funcionam os alertas proativos da a Inteligência Artificial da D2C?", a: "A Nossa Inteligência Artificial monitora seu Instagram 24/7 e envia alertas personalizados para seu WhatsApp sobre:\n\n* <strong class='font-semibold text-brand-dark'>Picos de Performance:</strong> Ex: 'Seu Reel de Dica sobre [tema], postado [dia/hora], teve X compartilhamentos! Que tal um roteiro?'\n* <strong class='font-semibold text-brand-dark'>Quedas de Desempenho:</strong> Ex: 'O tempo de visualização dos seus Reels de Humor caiu. Vamos analisar?'\n* <strong class='font-semibold text-brand-dark'>Melhores Combinações:</strong> Ex: 'Lembrete: Fotos LifeStyle sobre Viagem às sextas, 10h, costumam ter ótimo engajamento.'\n\nEsses alertas se tornam mais precisos conforme a Nossa Inteligência Artificial aprende com você." },
     { q: "O que é a Comunidade de Inspiração da a Inteligência Artificial da D2C?", a: "É um recurso para destravar sua criatividade! A Nossa Inteligência Artificial te dá acesso a exemplos de posts de sucesso (com resumos estratégicos e destaques qualitativos) de outros criadores. Peça inspiração por <strong class='font-semibold text-brand-dark'>tema, formato, propósito e contexto</strong>. <strong class='font-semibold text-brand-pink'>Importante: Métricas numéricas de terceiros NUNCA são compartilhadas.</strong> O foco é no aprendizado e na inspiração, com links para o post original." },
     { q: "Como a Inteligência Artificial da D2C me ajuda com minhas 'publis'?", a: "A Nossa Inteligência Artificial é seu aliado estratégico para publicidade:\n\n* <strong class='font-semibold text-brand-dark'>Organize Parcerias:</strong> Registre detalhes dos seus acordos na plataforma.\n* <strong class='font-semibold text-brand-dark'>Brainstorm para 'Publis':</strong> Peça ideias e roteiros para posts patrocinados, e a Nossa Inteligência Artificial usará os dados da parceria e do seu perfil para sugestões eficazes.\n* <strong class='font-semibold text-brand-dark'>Análise de Propostas (Em Breve):</strong> Futuramente, a Nossa Inteligência Artificial ajudará a analisar propostas e entender o valor das suas entregas.\n* <strong class='font-semibold text-brand-dark'>Histórico para Negociações:</strong> Use seu histórico de 'publis' para embasar futuras negociações." },
     { q: "Como funciona o programa de afiliados?", a: "Todos os usuários, mesmo no plano gratuito, viram afiliados ao criar a conta! Você recebe um cupom exclusivo. Seu amigo usa o cupom e ganha <strong class='font-semibold text-brand-dark'>10% de desconto</strong> na assinatura da Nossa Inteligência Artificial. E você ganha <strong class='font-semibold text-brand-dark'>10% de comissão recorrente</strong> enquanto ele for assinante. Simples assim!" },
     { q: "A Data2Content é gratuita para começar?", a: "Sim! Crie sua conta grátis e já vire afiliado. Para ter acesso a Nossa Inteligência Artificial (análise profunda, categorização, otimização de horários, alertas, aprendizado contínuo, comunidade, roteiros, gestão de publis) é preciso fazer assinatura." },
     { q: "Como a Inteligência Artificial da D2C acessa meus dados e aprende comigo? É seguro?", a: "Sim, total segurança e privacidade! A Nossa Inteligência Artificial acessa dados do seu Instagram (com sua permissão via conexão segura com Meta/Facebook) para buscar métricas, posts e categorizar descrições. Você também pode <strong class='font-semibold text-brand-dark'>enviar prints de posts antigos</strong>. Ela <strong class='font-semibold text-brand-dark'>aprende com suas conversas no WhatsApp</strong>, registrando preferências e objetivos para refinar as análises. Tudo em conformidade com a LGPD e diretrizes do Instagram. Você tem total controle." },
     { q: "Preciso ter uma conta profissional do Instagram?", a: "Sim, para a Nossa Inteligência Artificial analisar seus dados (via conexão ou prints), categorizar conteúdo, otimizar horários e aprender com você, é necessária uma conta Profissional (Comercial ou Criador de Conteúdo) vinculada a uma Página do Facebook." },
];

const heroQuestions = [
    "Qual o melhor dia para postar?",
    "Qual o melhor horário pra postar?",
    "Me dê uma ideia de conteúdo viral",
    "Analise meus post do mês",
    "Que formato está em alta?",
    "Como aumentar meu engajamento?",
    "Crie um roteiro para um Reel",
    "Preciso de inspiração para Reels",
    "Qual tema devo abordar hoje?",
    "Crie um plano de postagens pra ganhar seguidores",
    "Quais dias eu não devo postar?",
    "Quantos segundos meus reels devem ter?",
    "Meus reels estão com poucas visualizações, o que fazer?",
    "Como escrever uma legenda que gera mais comentários?",
    "Qual o melhor formato para vender meu produto?",
    "Postar humor na terça-feira dá mais resultado?",
    "Qual o pior dia para postar uma publicidade?",
    "Crie um calendário de conteúdo para a próxima semana.",
    "Devo postar nos fins de semana?",
    "Quantas postagens devo fazer por semana?",
    "Posts sobre dicas funcionam melhor de manhã ou à noite?",
];

// --- COMPONENTES DE UI REUTILIZÁVEIS ---
const AnimatedSection = React.memo(({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string; }) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });
  useEffect(() => { if (inView) controls.start("visible"); }, [controls, inView]);
  return (
    <motion.div ref={ref} initial="hidden" animate={controls} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: delay }}}} className={className}>
      {children}
    </motion.div>
  );
});
AnimatedSection.displayName = "AnimatedSection";

const SectionTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <h2 className={`text-4xl md:text-5xl font-bold tracking-tight text-brand-dark ${className}`}>{children}</h2>
);

const SectionSubtitle = ({ children, className = "" }: { children: React.ReactNode, className?:string }) => (
    <p className={`mt-4 text-lg md:text-xl text-gray-600 max-w-3xl leading-relaxed ${className}`}>{children}</p>
);

const ButtonPrimary = ({ href, onClick, children, className }: { href?: string; onClick?: () => void; children: React.ReactNode; className?: string }) => {
    const commonClasses = `group inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-brand-pink to-brand-red px-8 py-4 text-lg font-bold text-white shadow-lg shadow-pink-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-pink-500/40 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 ${className}`;
    
    if (href) {
        return <Link href={href} className={commonClasses}>{children}</Link>;
    }
    return <button onClick={onClick} className={commonClasses}>{children}</button>;
};

const PillarCard = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode; }) => (
    <div className="group relative h-full rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-200/50 to-purple-200/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative">
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-pink/10 text-3xl text-brand-pink shadow-inner shadow-pink-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-pink group-hover:text-white">
                <Icon />
            </div>
            <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
            <p className="mt-3 text-base text-gray-600">{children}</p>
        </div>
    </div>
);

// --- COMPONENTE ScreenshotCard (CORRIGIDO) ---
const ScreenshotCard = ({ imageUrl, title }: { imageUrl: string; title: string; }) => (
    <motion.div 
        className="flex-shrink-0 w-[65vw] sm:w-[45vw] md:w-[30vw] lg:w-[22vw] aspect-[9/16] rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 p-1 shadow-2xl cursor-grab active:cursor-grabbing"
        whileTap={{ scale: 0.98, transition: { duration: 0.2 } }}
    >
        <div className="relative w-full h-full bg-white rounded-[22px] shadow-inner overflow-hidden">
            <Image 
                src={imageUrl} 
                alt={title} 
                layout="fill" 
                className="object-cover" 
                loading="lazy"
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/360x640/f0f0f0/333?text=Imagem+Indisponível'; }}
            />
        </div>
    </motion.div>
);

// --- COMPONENTE TestimonialCard (CORRIGIDO) ---
const TestimonialCard = ({ name, handle, quote, avatarUrl }: { name: string; handle: string; quote: string; avatarUrl: string; }) => (
    <div className="bg-white p-8 rounded-xl h-full shadow-lg flex flex-col">
        <div className="flex text-yellow-400 gap-1 mb-4">{[...Array(5)].map((_, i) => <FaStar key={i} />)}</div>
        <p className="text-gray-700 italic flex-grow">"{quote}"</p>
        <div className="flex items-center mt-6">
            <div className="relative w-12 h-12 rounded-full overflow-hidden">
                <Image 
                    src={avatarUrl} 
                    alt={`Avatar de ${name}`} 
                    layout="fill" 
                    className="object-cover"
                />
            </div>
            <div className="ml-4">
                <p className="font-bold text-brand-dark">{name}</p>
                <p className="text-sm text-gray-500">{handle}</p>
            </div>
        </div>
    </div>
);


// --- COMPONENTES DE LAYOUT E EFEITOS ---
const ImagePlaceholder = ({ className = "" }: { className?: string }) => (
    <div className={`relative w-full overflow-hidden h-full ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-100 opacity-80" />
    </div>
);

const Marquee = ({ items, direction = 'left' }: { items: string[], direction?: 'left' | 'right' }) => {
    const marqueeContent = useMemo(() => [...items, ...items], [items]);
    return (
        <div className="relative w-full overflow-hidden">
            <motion.div
                className="flex gap-4"
                initial={{ x: direction === 'left' ? 0 : '-50%' }}
                animate={{ x: direction === 'left' ? '-50%' : 0 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            >
                {marqueeContent.map((item, index) => (
                    <div key={index} className="flex-shrink-0 whitespace-nowrap px-6 py-3 rounded-full bg-gray-200/80 text-gray-600 font-medium">
                        {item}
                    </div>
                ))}
            </motion.div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL DA PÁGINA ---
export default function FinalCompleteLandingPage() {
  const { data: session } = useSession();
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const handleSignIn = () => {
    signIn("google", { callbackUrl: "/auth/complete-signup" });
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
        const card = carouselRef.current.children[0] as HTMLElement;
        const cardWidth = card?.offsetWidth || 0;
        const gap = 32; // Corresponde a 'gap-8' no Tailwind
        const scrollAmount = cardWidth + gap;
        carouselRef.current.scrollBy({ left: direction === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
    }
  };

  const heroVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.2, delayChildren: 0.1 } },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
  };
  
  const thirdMarqueeQuestions = useMemo(() => 
    [...heroQuestions].sort(() => Math.random() - 0.5)
  , []);

  return (
    <>
      <Head>
        <title>Data2Content - Menos análise, mais criação.</title>
        <meta name="description" content="Seu estrategista de conteúdo pessoal que analisa seu Instagram e te diz exatamente o que fazer para crescer." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="bg-white text-gray-800 font-sans">
        
        <header className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-lg border-b border-gray-900/5">
            <div className="max-w-screen-xl mx-auto flex justify-between items-center h-20 px-6">
                <Link href="/" className="font-bold text-2xl text-brand-dark flex items-center gap-2">
                    <span className="text-brand-pink">[2]</span>
                    <span>Data2Content</span>
                </Link>
                <nav className="flex items-center gap-5">
                  {session ? (
                     <Link href="/dashboard" className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors">Meu Painel</Link>
                  ) : (
                     <button onClick={handleSignIn} className="text-sm font-semibold text-gray-600 hover:text-brand-pink transition-colors">Fazer Login</button>
                  )}
                    <div className="hidden sm:block">
                        <ButtonPrimary href="/register">Começar Agora</ButtonPrimary>
                    </div>
                </nav>
            </div>
        </header>

        <main>
          {/* Seção Hero com espaçamento vertical corrigido para melhor centralização */}
          <section className="relative flex flex-col justify-center items-center min-h-screen bg-gray-100 text-center overflow-x-hidden pt-20 pb-12">
            <div className="w-full">
              <motion.div
                variants={heroVariants}
                initial="hidden"
                animate="visible"
                className="max-w-3xl mx-auto px-6 lg:px-8"
              >
                <motion.h1 
                  variants={heroItemVariants}
                  className="text-5xl md:text-7xl font-extrabold tracking-tighter text-brand-dark"
                >
                  O fim da dúvida: o que postar hoje?
                </motion.h1>
                
                <motion.div variants={heroItemVariants} className="mt-6 h-14 md:h-auto">
                  <TypeAnimation
                    sequence={[
                      'Uma Inteligência Artificial.',
                      1000,
                      'Uma Inteligência Artificial conectada ao seu Instagram.',
                      1000,
                      'Uma Inteligência Artificial para conversar no WhatsApp.',
                      3000,
                    ]}
                    wrapper="p"
                    speed={50}
                    className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed mx-auto"
                    cursor={true}
                    repeat={Infinity}
                  />
                </motion.div>

                <motion.div variants={heroItemVariants}>
                  <ButtonPrimary onClick={handleSignIn} className="mt-8">
                    <FaGoogle /> Ative sua IA do Instagram no WhatsApp ▸
                  </ButtonPrimary>
                </motion.div>
              </motion.div>
              
              <motion.div 
                className="mt-10 md:mt-12 w-full space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              >
                <Marquee items={heroQuestions} />
                <Marquee items={[...heroQuestions].reverse()} direction="right" />
                <Marquee items={thirdMarqueeQuestions} />
              </motion.div>
            </div>
          </section>

          <div className="relative bg-white">
            {/* Seção com espaçamento vertical ajustado */}
            <section className="py-10 sm:py-14 bg-gray-50/70">
              <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
                <AnimatedSection>
                  <SectionTitle>Veja Nossa IA em Ação.</SectionTitle>
                  <SectionSubtitle>Receba alertas, análises e ideias diretamente no seu WhatsApp, de forma clara e objetiva.</SectionSubtitle>
                </AnimatedSection>
              </div>
              <div className="relative mt-6">
                <div 
                  ref={carouselRef}
                  className="overflow-x-auto snap-x snap-mandatory hide-scrollbar"
                >
                    <div 
                      className="flex gap-8"
                      style={{
                        paddingTop: '1.5rem',
                        paddingBottom: '1.5rem',
                        paddingLeft: 'calc(max(0px, (100vw - 1280px) / 2) + 1.5rem)', 
                        paddingRight: 'calc(max(0px, (100vw - 1280px) / 2) + 1.5rem)'
                      }}
                    >
                        {exampleScreenshots.map((item, index) => (
                          <div key={index} className="flex flex-col items-start gap-2 flex-shrink-0 snap-center">
                            <h3 className="font-bold text-lg text-gray-600 pl-1">{item.title}</h3>
                            <ScreenshotCard imageUrl={item.imageUrl} title={item.title} />
                          </div>
                        ))}
                    </div>
                </div>
                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 pointer-events-none">
                    <button 
                        onClick={() => scrollCarousel('left')} 
                        className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
                        aria-label="Anterior"
                    >
                        <FaChevronLeft />
                    </button>
                    <button 
                        onClick={() => scrollCarousel('right')} 
                        className="pointer-events-auto w-12 h-12 rounded-full bg-white/50 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink"
                        aria-label="Próximo"
                    >
                        <FaChevronRight />
                    </button>
                </div>
              </div>
            </section>

            {/* Seção com espaçamento vertical ajustado */}
            <section className="py-10 sm:py-14 bg-white">
                <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
                    <AnimatedSection>
                        <SectionTitle>Feito para todos os tipos de criadores.</SectionTitle>
                        <SectionSubtitle>Se você cria conteúdo, o Data2Content trabalha para você. Nossa IA se adapta ao seu histórico de conteúdo, nicho e objetivos.</SectionSubtitle>
                    </AnimatedSection>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {creatorTypes.map((creator, index) => (
                            <AnimatedSection delay={0.1 * (index + 1)} key={creator.title}>
                                <PillarCard icon={creator.icon} title={creator.title}>
                                    {creator.description}
                                </PillarCard>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>
            
            {/* Seção com espaçamento vertical ajustado */}
            <section className="py-10 sm:py-14 bg-gray-50/70">
                <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
                    <AnimatedSection>
                        <SectionTitle>Resultados que falam por si.</SectionTitle>
                        <SectionSubtitle>Criadores como você já estão economizando tempo e crescendo com mais estratégia.</SectionSubtitle>
                    </AnimatedSection>
                    <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {testimonials.map((testimonial, index) => (
                            <AnimatedSection delay={0.1 * (index + 1)} key={testimonial.name}>
                                <TestimonialCard {...testimonial} />
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* Seção com espaçamento vertical ajustado */}
            <section id="arthur-marba" className="py-10 sm:py-14 bg-white">
                <div className="max-w-screen-md mx-auto px-6 text-left">
                    <AnimatedSection>
                        <SectionTitle className="text-3xl">Conheça o Fundador da Data2Content</SectionTitle>
                        <p className="mt-5 text-lg text-gray-600 leading-relaxed">Arthur Marbá, Fundador da Data2Content, une 10 anos de marketing digital para criadores a uma herança familiar de 40 anos no agenciamento de talentos. Ele percebeu que criadores precisam de um especialista para traduzir dados em direcionamento estratégico. O Tuca é a personificação dessa filosofia.</p>
                        <blockquote className="mt-5 pl-5 border-l-4 border-brand-pink italic text-gray-700 text-lg">
                            "Democratizamos a consultoria estratégica, tornando-a acessível, proativa e capaz de evoluir com cada criador, tudo via WhatsApp."
                            <cite className="mt-4 block text-base font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador</cite>
                        </blockquote>
                    </AnimatedSection>
                    
                    <AnimatedSection delay={0.1}>
                        <div 
                            className="relative mt-10 overflow-hidden rounded-2xl shadow-lg"
                            style={{ paddingTop: '56.25%' }} // Proporção 16:9 para vídeo
                        >
                           <iframe
                                className="absolute top-0 left-0 h-full w-full"
                                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ&controls=0"
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                        </div>
                    </AnimatedSection>
                </div>
            </section>

            {/* Seção com espaçamento vertical ajustado e BUG CORRIGIDO */}
            <section id="faq" className="py-10 sm:py-14 bg-white">
                <div className="max-w-3xl mx-auto px-6">
                    <AnimatedSection className="text-left mb-10">
                        <SectionTitle>Dúvidas Frequentes</SectionTitle>
                    </AnimatedSection>
                    <div className="space-y-4">
                        {faqItems.map((item, index) => (
                            <AnimatedSection delay={0.05 * (index + 1)} key={index}>
                                <details className="group bg-gray-50/80 p-6 rounded-lg transition-shadow duration-200 hover:shadow-lg">
                                    <summary className="flex justify-between items-center text-lg font-semibold text-brand-dark cursor-pointer list-none">
                                        {item.q}
                                        <span className="text-brand-pink transition-transform duration-300 group-open:rotate-180">
                                            <FaQuestionCircle />
                                        </span>
                                    </summary>
                                    {/* CORREÇÃO APLICADA AQUI */}
                                    <div className="text-gray-700 mt-4 text-base font-light leading-relaxed whitespace-pre-line"
                                       dangerouslySetInnerHTML={{ __html: item.a.replace(/\n\n\*/g, '<br /><br />&#8226; ').replace(/\n\*/g, '<br />&#8226; ').replace(/\n/g, '<br />') }}
                                    ></div>
                                </details>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>
            
            {/* Seção com espaçamento vertical ajustado */}
            <section className="py-12 sm:py-20 bg-brand-dark text-white">
                <div className="max-w-screen-xl mx-auto px-6 text-left">
                    <AnimatedSection className="max-w-3xl">
                        <SectionTitle className="text-white">Pronto para transformar sua criação de conteúdo?</SectionTitle>
                        <SectionSubtitle className="text-gray-300">Pare de adivinhar e comece a crescer com estratégia. O Tuca está esperando por você.</SectionSubtitle>
                        <div className="mt-10">
                           <ButtonPrimary onClick={handleSignIn}>
                               <FaGoogle /> Ativar meu estrategista agora ▸
                           </ButtonPrimary>
                        </div>
                    </AnimatedSection>
                </div>
            </section>
          </div>
        </main>
        
        {/* Seção com espaçamento vertical ajustado */}
        <footer className="text-center py-8 bg-gray-100 border-t">
            <div className="mb-4 text-brand-dark font-bold text-2xl flex justify-center items-center gap-2"><span className="text-brand-pink">[2]</span>Data2Content</div>
            <p className="text-sm text-gray-500 mb-4">© {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.</p>
            <div className="flex justify-center gap-6 text-sm">
                 <Link href="/politica-de-privacidade" className="text-gray-600 hover:text-brand-pink transition-colors">Política de Privacidade</Link>
                 <Link href="/termos-e-condicoes" className="text-gray-600 hover:text-brand-pink transition-colors">Termos e Condições</Link>
            </div>
        </footer>
      </div>

      <style jsx global>{`
        :root {
            --brand-pink: #EC4899;
            --brand-red: #EF4444;
            --brand-dark: #111827;
        }
        html {
            font-family: 'Inter', sans-serif;
            scroll-padding-top: 5rem; /* Ajusta a rolagem de links de âncora por causa do header fixo */
        }
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </>
    );
}
