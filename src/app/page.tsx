"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { TypeAnimation } from "react-type-animation";
import { FaGoogle, FaGem, FaChartPie, FaHeart, FaBriefcase, FaStar, FaPaintBrush, FaBullhorn, FaChalkboardTeacher, FaQuestionCircle, FaCheckCircle, FaTimesCircle, FaChevronLeft, FaChevronRight, FaPlay } from 'react-icons/fa';

// --- DADOS E CONSTANTES DA PÁGINA ---
const exampleScreenshots = [
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
      name: "Livia Linhares",
      handle: "@livialinharess",
      quote: "A IA da D2C é tipo o CEO do meu Instagram 😅. Ela olha pras minhas métricas, me mostra o que meu público curte (e o que não curte) e ainda me dá um toque quando tô postando pouco, pra eu não deixar o engajamento cair. E tudo isso é feito só pra mim, porque ele conhece as minhas métricas. Eu acho que, como criadora, esse tipo de ajuda faz muita diferença. Até porque, meu retorno financeiro vem de publis, e pra fechar boas parcerias, cada post precisa engajar bem. Uso direto e recomendo demais!",
      avatarUrl: "/images/Livia Foto D2C.png"
    },
    {
      name: "Rafael Belli",
      handle: "@belli_rafa",
      quote: "Antes eu ficava meio perdido com os números, mas agora, com o acompanhamento pelo WhatsApp, é outra história. É como ter um parceiro super gente boa que te dá uns toques na hora certa. Os alertas chegam direto no meu WhatsApp e são super úteis. É um suporte personalizado que faz toda a diferença, me ajudando a entender tudo sem complicação e a crescer de verdade.",
      avatarUrl: "/images/Rafa Belli Foto D2C.png"
    },
    {
      name: "Carla Souza",
      handle: "@carladesign",
      quote: "O programa de afiliados é genial! Já paguei minha assinatura só com as comissões, e meus amigos amaram o desconto e a ferramenta.",
      avatarUrl: "/images/default-profile.png"
    }
  ];

const faqItems = [
     {
         q: "Qual a diferença da Nossa Inteligência Artificial para outros assistentes ou ferramentas?",
         a: "Nossa Inteligência Artificial é única por integrar múltiplos superpoderes focados nos SEUS resultados:\n\n* <strong class='font-semibold text-brand-dark'>Análise Conectada:</strong> Acessa SEU Instagram para insights de métricas e conteúdos REAIS (atuais e históricos via print).\n* <strong class='font-semibold text-brand-dark'>Entende Seu Conteúdo:</strong> Categoriza posts por Formato, Propósito e Contexto, revelando padrões.\n* <strong class='font-semibold text-brand-dark'>Timing Inteligente:</strong> Otimiza horários para CADA tipo de conteúdo, maximizando impacto.\n* <strong class='font-semibold text-brand-dark'>Expert + IA Proativa:</strong> Treinado por Arthur Marbá, monitora 24/7 e envia alertas estratégicos.\n* <strong class='font-semibold text-brand-dark'>Prático no WhatsApp:</strong> Interação simples, insights diretos, sem dashboards.\n* <strong class='font-semibold text-brand-dark'>De Dados a Roteiros:</strong> Analisa e GERA ROTEIROS para replicar seus sucessos.\n* <strong class='font-semibold text-brand-dark'>Evolui com Você:</strong> Aprende com suas interações e preferências.\n* <strong class='font-semibold text-brand-dark'>Inspiração da Comunidade:</strong> Exemplos de posts de sucesso (privacidade garantida).\n* <strong class='font-semibold text-brand-dark'>Gestão de Publis:</strong> Ajuda a organizar e otimizar parcerias.\n\nResumindo: Nossa Inteligência Artificial é seu consultor estratégico e criativo completo para Instagram, no WhatsApp."
     },
     { q: "Como a Nossa Inteligência Artificial define o melhor horário e dia para postar?", a: "A Nossa Inteligência Artificial realiza uma <strong class='font-semibold text-brand-dark'>análise combinatória profunda</strong>, cruzando dados de horário, duração, formato, propósito e contexto do seu conteúdo. Ela identifica os momentos em que seu público está mais receptivo a cada tipo de post, visando seus objetivos (ex: mais views em Reels de Dicas às terças, 19h). Converse com a Nossa Inteligência Artificial para investigar esses padrões." },
     { q: "Como a Nossa Inteligência Artificial me ajuda a criar conteúdo e roteiros?", a: "A Nossa Inteligência Artificial impulsiona sua criatividade e produção:\n\n* <strong class='font-semibold text-brand-dark'>Identifica Seus Sucessos:</strong> Analisa métricas e categoriza seu conteúdo (formato, propósito, contexto, horário) para encontrar seus posts de melhor desempenho.\n* <strong class='font-semibold text-brand-dark'>Gera Roteiros e Estruturas:</strong> Com base nesses sucessos, peça à Nossa Inteligência Artificial roteiros ou variações de temas que já funcionaram para seu público.\n* <strong class='font-semibold text-brand-dark'>Supera Bloqueios Criativos:</strong> Use seus próprios acertos como ponto de partida, economizando tempo.\n* <strong class='font-semibold text-brand-dark'>Criatividade Direcionada por Dados:</strong> Receba ideias com maior probabilidade de sucesso, baseadas na análise do seu desempenho." },
     { q: "Como funcionam os alertas proativos da Nossa Inteligência Artificial?", a: "A Nossa Inteligência Artificial monitora seu Instagram 24/7 e envia alertas personalizados para seu WhatsApp sobre:\n\n* <strong class='font-semibold text-brand-dark'>Picos de Performance:</strong> Ex: 'Seu Reel de Dica sobre [tema], postado [dia/hora], teve X compartilhamentos! Que tal um roteiro?'\n* <strong class='font-semibold text-brand-dark'>Quedas de Desempenho:</strong> Ex: 'O tempo de visualização dos seus Reels de Humor caiu. Vamos analisar?'\n* <strong class='font-semibold text-brand-dark'>Melhores Combinações:</strong> Ex: 'Lembrete: Fotos LifeStyle sobre Viagem às sextas, 10h, costumam ter ótimo engajamento.'\n\nEsses alertas se tornam mais precisos conforme a Nossa Inteligência Artificial aprende com você." },
     { q: "O que é a Comunidade de Inspiração da Nossa Inteligência Artificial?", a: "É um recurso para destravar sua criatividade! A Nossa Inteligência Artificial te dá acesso a exemplos de posts de sucesso (com resumos estratégicos e destaques qualitativos) de outros criadores. Peça inspiração por <strong class='font-semibold text-brand-dark'>tema, formato, propósito e contexto</strong>. <strong class='font-semibold text-brand-pink'>Importante: Métricas numéricas de terceiros NUNCA são compartilhadas.</strong> O foco é no aprendizado e na inspiração, com links para o post original." },
     { q: "Como a Nossa Inteligência Artificial me ajuda com minhas 'publis'?", a: "A Nossa Inteligência Artificial é seu aliado estratégico para publicidade:\n\n* <strong class='font-semibold text-brand-dark'>Organize Parcerias:</strong> Registre detalhes dos seus acordos na plataforma.\n* <strong class='font-semibold text-brand-dark'>Brainstorm para 'Publis':</strong> Peça ideias e roteiros para posts patrocinados, e a Nossa Inteligência Artificial usará os dados da parceria e do seu perfil para sugestões eficazes.\n* <strong class='font-semibold text-brand-dark'>Análise de Propostas (Em Breve):</strong> Futuramente, a Nossa Inteligência Artificial ajudará a analisar propostas e entender o valor das suas entregas.\n* <strong class='font-semibold text-brand-dark'>Histórico para Negociações:</strong> Use seu histórico de 'publis' para embasar futuras negociações." },
     { q: "Como funciona o programa de afiliados?", a: "Todos os usuários, mesmo no plano gratuito, viram afiliados ao criar a conta! Você recebe um cupom exclusivo. Seu amigo usa o cupom e ganha <strong class='font-semibold text-brand-dark'>10% de desconto</strong> na assinatura da Nossa Inteligência Artificial. E você ganha <strong class='font-semibold text-brand-dark'>10% de comissão recorrente</strong> enquanto ele for assinante. Simples assim!" },
     { q: "A data2content é realmente gratuito para começar?", a: "Sim! Crie sua conta grátis e já vire afiliado. Funcionalidades básicas estão disponíveis. O poder completo da Nossa Inteligência Artificial (análise profunda, categorização, otimização de horários, alertas, aprendizado contínuo, comunidade, roteiros, gestão de publis) faz parte do nosso plano premium." },
     { q: "Como a Nossa Inteligência Artificial acessa meus dados e aprende comigo? É seguro?", a: "Sim, total segurança e privacidade! A Nossa Inteligência Artificial acessa dados do seu Instagram (com sua permissão via conexão segura com Meta/Facebook) para buscar métricas, posts e categorizar descrições. Você também pode <strong class='font-semibold text-brand-dark'>enviar prints de posts antigos</strong>. Ela <strong class='font-semibold text-brand-dark'>aprende com suas conversas no WhatsApp</strong>, registrando preferências e objetivos para refinar as análises. Tudo em conformidade com a LGPD e diretrizes do Instagram. Você tem total controle." },
     { q: "Preciso ter uma conta profissional do Instagram?", a: "Sim, para a Nossa Inteligência Artificial analisar seus dados (via conexão ou prints), categorizar conteúdo, otimização de horários e aprender com você, é necessária uma conta Profissional (Comercial ou Criador de Conteúdo) vinculada a uma Página do Facebook." },
];

const heroQuestions = [
    "Qual o melhor dia para postar?", "Qual o melhor horário pra postar?", "Me dê uma ideia de conteúdo viral",
    "Analise meus post do mês", "Que formato está em alta?", "Como aumentar meu engajamento?",
    "Crie um roteiro para um Reel", "Preciso de inspiração para Reels", "Qual tema devo abordar hoje?",
    "Crie um plano de postagens pra ganhar seguidores", "Quais dias eu não devo postar?", "Quantos segundos meus reels devem ter?",
    "Meus reels estão com poucas visualizações, o que fazer?", "Como escrever uma legenda que gera mais comentários?",
    "Qual o melhor formato para vender meu produto?", "Postar humor na terça-feira dá mais resultado?",
    "Qual o pior dia para postar uma publicidade?", "Crie um calendário de conteúdo para a próxima semana.",
    "Devo postar nos fins de semana?", "Quantas postagens devo fazer por semana?", "Posts sobre dicas funcionam melhor de manhã ou à noite?",
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
  const [isScrolled, setIsScrolled] = useState(false);
  
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

  const videoId = "dQw4w9WgXcQ";
  const videoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = videoRef.current;
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
        iframe.title = "YouTube video player";
        iframe.frameBorder = "0";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.className = "absolute top-0 left-0 h-full w-full";
        container.innerHTML = "";
        container.appendChild(iframe);
        obs.disconnect();
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [videoId]);

  const heroVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: [0, 1],
      scale: [0.95, 1],
      transition: {
        ease: [0.33, 1, 0.68, 1],
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: [0, 1],
      y: 0,
      scale: [0.95, 1],
      transition: { duration: 0.7, ease: [0.33, 1, 0.68, 1] },
    },
  };

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  
  return (
    <>
      <Head>
        <title>data2content - Menos análise, mais criação.</title>
        <meta name="description" content="Seu estrategista de conteúdo pessoal que analisa seu Instagram e te diz exatamente o que fazer para crescer." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </Head>

      <div className="bg-white text-gray-800 font-sans">
        
        <header className={`fixed top-0 w-full z-50 backdrop-blur-md transition-all ${isScrolled ? 'bg-white shadow' : 'bg-white/60'}`}>
            <div className="max-w-screen-xl mx-auto flex justify-between items-center h-20 px-6">
                <Link href="/" className="font-bold text-2xl text-brand-dark flex items-center gap-2">
                    <span className="text-brand-pink">[2]</span>
                    <span>data2content</span>
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

        <>
          {/* [CORREÇÃO] A altura mínima foi ajustada para 90vh para diminuir o espaço vertical. */}
          <section className="relative flex flex-col h-screen pt-20 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 text-center overflow-x-hidden">
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.35),transparent)]" />
              <div className="absolute bottom-20 right-0 w-72 h-72 bg-brand-pink/20 blur-3xl rounded-full" />
            </div>
            {/* O container interno usa flex-grow e justify-start para alinhar o conteúdo ao topo. */}
            <div className="flex-grow flex flex-col justify-start pt-32">
                <div className="w-full">
                    <motion.div
                      variants={heroVariants}
                      initial="hidden"
                      animate="visible"
                      className="w-full"
                    >
                      <div className="max-w-3xl mx-auto px-6 lg:px-8">
                        <motion.h1 
                          variants={heroItemVariants}
                          className="text-5xl md:text-7xl font-semibold tracking-tighter bg-gradient-to-r from-brand-pink to-brand-red bg-clip-text text-transparent"
                        >
                          O fim da dúvida: o que postar hoje?
                        </motion.h1>
                        
                        <motion.div variants={heroItemVariants} className="mt-6 h-14 md:h-auto">
                          <TypeAnimation
                            sequence={[
                              'Uma Inteligência Artificial.', 1000,
                              'Uma Inteligência Artificial conectada ao seu Instagram.', 1000,
                              'Uma Inteligência Artificial para conversar no WhatsApp.', 3000,
                            ]}
                            wrapper="p" speed={50}
                            className="text-lg md:text-xl text-gray-600 max-w-2xl leading-relaxed mx-auto"
                            cursor={true} repeat={Infinity}
                          />
                        </motion.div>

                        <motion.div variants={heroItemVariants}>
                          <ButtonPrimary onClick={handleSignIn} className="mt-8">
                            <FaGoogle /> Ative sua IA do Instagram no WhatsApp ▸
                          </ButtonPrimary>
                        </motion.div>
                      </div>

                      <motion.div
                        variants={heroItemVariants}
                        className="relative mt-12 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50"
                      >
                        <video
                          autoPlay
                          muted
                          loop
                          playsInline
                          poster="/images/tuca-analise-whatsapp.png"
                          src="/videos/hero-demo.mp4"
                          className="w-full max-w-4xl mx-auto rounded-2xl shadow-xl aspect-video"
                          loading="lazy"
                          decoding="async"
                        />
                      </motion.div>

                      <motion.div
                        variants={heroItemVariants}
                        className="mt-10 md:mt-12 w-full space-y-4"
                      >
                        <Marquee items={heroQuestions} />
                        <Marquee items={[...heroQuestions].reverse()} direction="right" />
                      </motion.div>
                    </motion.div>
                </div>
            </div>
          </section>

          <div className="relative bg-white">
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

            <section className="py-10 sm:py-14 bg-white">
                <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
                    <AnimatedSection>
                        <SectionTitle>Feito para todos os tipos de criadores.</SectionTitle>
                        <SectionSubtitle>Se você cria conteúdo, a data2content trabalha para você. Nossa IA se adapta ao seu histórico de conteúdo, nicho e objetivos.</SectionSubtitle>
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

            <section id="arthur-marba" className="py-10 sm:py-14 bg-white">
                <div className="max-w-screen-md mx-auto px-6 text-left">
                    <AnimatedSection>
                        <SectionTitle className="text-3xl">Conheça o Fundador da data2content</SectionTitle>
                        <p className="mt-5 text-lg text-gray-600 leading-relaxed">Arthur Marbá, Fundador da data2content, une 10 anos de marketing digital para criadores a uma herança familiar de 40 anos no agenciamento de talentos. Ele percebeu que criadores precisam de um especialista para traduzir dados em direcionamento estratégico. O Mobi é a personificação dessa filosofia.</p>
                        <blockquote className="mt-5 pl-5 border-l-4 border-brand-pink italic text-gray-700 text-lg">
                            "Democratizamos a consultoria estratégica, tornando-a acessível, proativa e capaz de evoluir com cada criador, tudo via WhatsApp."
                            <cite className="mt-4 block text-base font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador</cite>
                        </blockquote>
                    </AnimatedSection>
                    
                    <AnimatedSection delay={0.1}>
                        <div
                            ref={videoRef}
                            className="relative mt-10 overflow-hidden rounded-2xl shadow-lg w-full aspect-video"
                        >
                            <img
                                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                alt="Thumbnail do vídeo"
                                className="absolute top-0 left-0 h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/60 rounded-full p-4">
                                    <FaPlay className="text-white text-3xl" />
                                </div>
                            </div>
                        </div>
                    </AnimatedSection>
                </div>
            </section>

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
                                    <div className="text-gray-700 mt-4 text-base font-light leading-relaxed whitespace-pre-line"
                                       dangerouslySetInnerHTML={{ __html: item.a.replace(/\n\n\*/g, '<br /><br />&#8226; ').replace(/\n\*/g, '<br />&#8226; ').replace(/\n/g, '<br />') }}
                                    ></div>
                                </details>
                            </AnimatedSection>
                        ))}
                    </div>
                </div>
            </section>
            
            <section className="py-12 sm:py-20 bg-brand-dark text-white">
                <div className="max-w-screen-xl mx-auto px-6 text-left">
                    <AnimatedSection className="max-w-3xl">
                        <SectionTitle className="text-white">Pronto para transformar sua criação de conteúdo?</SectionTitle>
                        <SectionSubtitle className="text-gray-300">Pare de adivinhar e comece a crescer com estratégia. O Mobi está esperando por você.</SectionSubtitle>
                        <div className="mt-10">
                           <ButtonPrimary onClick={handleSignIn}>
                               <FaGoogle /> Ativar meu estrategista agora ▸
                           </ButtonPrimary>
                        </div>
                    </AnimatedSection>
                </div>
            </section>
          </div>
        </>
        
        <footer className="text-center py-8 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 border-t">
            <div className="mb-4 text-brand-dark font-bold text-2xl flex justify-center items-center gap-2"><span className="text-brand-pink">[2]</span>data2content</div>
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
    )
}
