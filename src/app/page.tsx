"use client";

import React, { useEffect, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image"; // Importar o componente Image do Next.js
import { useSession, signIn } from "next-auth/react";
import { motion, useAnimation, Variants } from "framer-motion";
import { useInView } from "react-intersection-observer";
// Importando React Icons
import { FaArrowRight, FaGift, FaWhatsapp, FaBrain, FaGoogle, FaStar, FaFileUpload, FaQuestionCircle, FaBell, FaLink, FaLightbulb, FaComments, FaBullseye, FaChartLine, FaUsers, FaFileSignature, FaScroll, FaTags, FaClock, FaInstagram } from 'react-icons/fa';

// --- Variantes de Animação (Framer Motion) ---
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  once?: boolean;
  amount?: number;
}

const AnimatedSection = React.memo(({ children, delay = 0, className = "", once = true, amount = 0.1 }: AnimatedSectionProps) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: amount,
  });

  useEffect(() => {
    if (inView) {
      const visibleVariant = fadeInUp.visible;

      if (visibleVariant && typeof visibleVariant === 'object') {
        const baseTransition = visibleVariant.transition || {};
        const initialDelay = typeof baseTransition.delay === 'number' ? baseTransition.delay : 0;

        controls.start(i => ({
          ...visibleVariant,
          transition: {
            ...baseTransition,
            delay: (i as number) * 0.1 + initialDelay,
          },
        }));
      } else {
        controls.start({ opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } });
      }
    } else if (!once) {
       controls.start("hidden");
    }
  }, [controls, inView, once]);


  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={fadeInUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
});
AnimatedSection.displayName = "AnimatedSection";

export default function HomePage() {
  const { data: session } = useSession();

  const faqItems = useMemo(() => [
       {
           q: "Qual a diferença do Tuca para outros assistentes ou ferramentas?",
           a: "O Tuca é único por integrar múltiplos superpoderes focados nos SEUS resultados:\n\n* <strong className='font-semibold text-brand-dark'>Análise Conectada:</strong> Acessa SEU Instagram para insights de métricas e conteúdos REAIS (atuais e históricos via print).\n* <strong className='font-semibold text-brand-dark'>Entende Seu Conteúdo:</strong> Categoriza posts por Formato, Propósito e Contexto, revelando padrões.\n* <strong className='font-semibold text-brand-dark'>Timing Inteligente:</strong> Otimiza horários para CADA tipo de conteúdo, maximizando impacto.\n* <strong className='font-semibold text-brand-dark'>Expert + IA Proativa:</strong> Treinado por Arthur Marbá, monitora 24/7 e envia alertas estratégicos.\n* <strong className='font-semibold text-brand-dark'>Prático no WhatsApp:</strong> Interação simples, insights diretos, sem dashboards.\n* <strong className='font-semibold text-brand-dark'>De Dados a Roteiros:</strong> Analisa e GERA ROTEIROS para replicar seus sucessos.\n* <strong className='font-semibold text-brand-dark'>Evolui com Você:</strong> Aprende com suas interações e preferências.\n* <strong className='font-semibold text-brand-dark'>Inspiração da Comunidade:</strong> Exemplos de posts de sucesso (privacidade garantida).\n* <strong className='font-semibold text-brand-dark'>Gestão de Publis:</strong> Ajuda a organizar e otimizar parcerias.\n\nResumindo: Tuca é seu consultor estratégico e criativo completo para Instagram, no WhatsApp."
       },
       {
           q: "Como o Tuca define o melhor horário e dia para postar?",
           a: "O Tuca realiza uma <strong className='font-semibold text-brand-dark'>análise combinatória profunda</strong>, cruzando dados de horário, duração, formato, propósito e contexto do seu conteúdo. Ele identifica os momentos em que seu público está mais receptivo a cada tipo de post, visando seus objetivos (ex: mais views em Reels de Dicas às terças, 19h). Converse com o Tuca para investigar esses padrões."
       },
       {
           q: "Como o Tuca me ajuda a criar conteúdo e roteiros?",
           a: "O Tuca impulsiona sua criatividade e produção:\n\n* <strong className='font-semibold text-brand-dark'>Identifica Seus Sucessos:</strong> Analisa métricas e categoriza seu conteúdo (formato, propósito, contexto, horário) para encontrar seus posts de melhor desempenho.\n* <strong className='font-semibold text-brand-dark'>Gera Roteiros e Estruturas:</strong> Com base nesses sucessos, peça ao Tuca roteiros ou variações de temas que já funcionaram para seu público.\n* <strong className='font-semibold text-brand-dark'>Supera Bloqueios Criativos:</strong> Use seus próprios acertos como ponto de partida, economizando tempo.\n* <strong className='font-semibold text-brand-dark'>Criatividade Direcionada por Dados:</strong> Receba ideias com maior probabilidade de sucesso, baseadas na análise do seu desempenho."
       },
       {
           q: "Como funcionam os alertas proativos do Tuca?",
           a: "O Tuca monitora seu Instagram 24/7 e envia alertas personalizados para seu WhatsApp sobre:\n\n* <strong className='font-semibold text-brand-dark'>Picos de Performance:</strong> Ex: 'Seu Reel de Dica sobre [tema], postado [dia/hora], teve X compartilhamentos! Que tal um roteiro?'\n* <strong className='font-semibold text-brand-dark'>Quedas de Desempenho:</strong> Ex: 'O tempo de visualização dos seus Reels de Humor caiu. Vamos analisar?'\n* <strong className='font-semibold text-brand-dark'>Melhores Combinações:</strong> Ex: 'Lembrete: Fotos LifeStyle sobre Viagem às sextas, 10h, costumam ter ótimo engajamento.'\n\nEsses alertas se tornam mais precisos conforme o Tuca aprende com você."
       },
       {
           q: "O que é a Comunidade de Inspiração Tuca?",
           a: "É um recurso para destravar sua criatividade! O Tuca te dá acesso a exemplos de posts de sucesso (com resumos estratégicos e destaques qualitativos) de outros criadores. Peça inspiração por <strong className='font-semibold text-brand-dark'>tema, formato, propósito e contexto</strong>. <strong className='font-semibold text-brand-pink'>Importante: Métricas numéricas de terceiros NUNCA são compartilhadas.</strong> O foco é no aprendizado e na inspiração, com links para o post original."
       },
       {
           q: "Como o Tuca me ajuda com minhas 'publis'?",
           a: "O Tuca é seu aliado estratégico para publicidade:\n\n* <strong className='font-semibold text-brand-dark'>Organize Parcerias:</strong> Registre detalhes dos seus acordos na plataforma.\n* <strong className='font-semibold text-brand-dark'>Brainstorm para 'Publis':</strong> Peça ideias e roteiros para posts patrocinados, e o Tuca usará os dados da parceria e do seu perfil para sugestões eficazes.\n* <strong className='font-semibold text-brand-dark'>Análise de Propostas (Em Breve):</strong> Futuramente, o Tuca ajudará a analisar propostas e entender o valor das suas entregas.\n* <strong className='font-semibold text-brand-dark'>Histórico para Negociações:</strong> Use seu histórico de 'publis' para embasar futuras negociações."
       },
       {
           q: "Como funciona o programa de afiliados?",
           a: "Todos os usuários, mesmo no plano gratuito, viram afiliados ao criar a conta! Você recebe um cupom exclusivo. Seu amigo usa o cupom e ganha <strong className='font-semibold text-brand-dark'>10% de desconto</strong> na assinatura do Tuca. E você ganha <strong className='font-semibold text-brand-dark'>10% de comissão recorrente</strong> enquanto ele for assinante. Simples assim!"
       },
       { q: "O Data2Content é realmente gratuito para começar?", a: "Sim! Crie sua conta grátis e já vire afiliado. Funcionalidades básicas estão disponíveis. O poder completo do Tuca (análise profunda, categorização, otimização de horários, alertas, aprendizado contínuo, comunidade, roteiros, gestão de publis) faz parte do nosso plano premium." },
       { q: "Como o Tuca acessa meus dados e aprende comigo? É seguro?", a: "Sim, total segurança e privacidade! O Tuca acessa dados do seu Instagram (com sua permissão via conexão segura com Meta/Facebook) para buscar métricas, posts e categorizar descrições. Você também pode <strong className='font-semibold text-brand-dark'>enviar prints de posts antigos</strong>. Ele <strong className='font-semibold text-brand-dark'>aprende com suas conversas no WhatsApp</strong>, registrando preferências e objetivos para refinar as análises. Tudo em conformidade com a LGPD e diretrizes do Instagram. Você tem total controle." },
       { q: "Preciso ter uma conta profissional do Instagram?", a: "Sim, para o Tuca analisar seus dados (via conexão ou prints), categorizar conteúdo, otimizar horários e aprender com você, é necessária uma conta Profissional (Comercial ou Criador de Conteúdo) vinculada a uma Página do Facebook." },
   ], []);


  return (
    <>
      <Head>
        <title>Data2Content: Tuca, sua IA completa para Instagram no WhatsApp</title>
        <meta
          name="description"
          content="Conecte seu Instagram ao Tuca! IA que analisa métricas, horários, conteúdo, cria roteiros, aprende com você, inspira com a comunidade e otimiza publis. Tudo no WhatsApp."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-white text-brand-dark font-sans">

        <header className="fixed top-0 left-0 w-full py-3 px-4 md:px-6 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
             <div className="max-w-7xl mx-auto flex justify-between items-center h-12 md:h-14">
                <Link href="/" className="font-bold text-xl md:text-2xl text-brand-dark">Data2Content</Link>
                <nav className="hidden md:flex space-x-4 lg:space-x-6"> {/* Espaçamento reduzido */}
                    <a href="#tuca-ia" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">O Poder do Tuca</a>
                    <a href="#tuca-proativo" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">Tuca Proativo</a>
                    <a href="#comunidade-inspiracao" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">Comunidade</a>
                    <a href="#tuca-parcerias" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">Tuca & Publis</a>
                    {/* <a href="#monetizacao" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Monetização</a> */}
                    <a href="#arthur-marba" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">Arthur Marbá</a>
                    <a href="#como-funciona" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">Como Funciona</a>
                    <a href="#faq" className="text-sm text-gray-600 hover:text-brand-pink transition-colors">FAQ</a>
                </nav>
                {!session ? (
                     <button
                        onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                        className="px-4 py-2 md:px-5 text-xs md:text-sm font-medium text-brand-dark border border-gray-300 rounded-full hover:bg-gray-100 transition-colors duration-150" // Padding ajustado
                    >
                        Entrar com Google
                    </button>
                ) : (
                     <Link
                        href="/dashboard"
                        className="px-4 py-2 md:px-5 text-xs md:text-sm font-medium text-white bg-brand-pink rounded-full hover:opacity-90 transition-opacity duration-150" // Padding ajustado
                    >
                        Meu Painel
                    </Link>
                )}
            </div>
        </header>

        {/* Seção Hero */}
        <section id="hero" className="relative flex flex-col items-center justify-center text-center px-4 min-h-[85vh] md:min-h-[90vh] pt-28 pb-16 md:pt-32 md:pb-24 bg-brand-light overflow-hidden"> {/* Altura e padding ajustados */}
            <div className="absolute -top-16 -left-16 w-56 h-56 md:w-72 md:h-72 bg-brand-pink/5 rounded-full filter blur-3xl opacity-40 md:opacity-50 animate-pulse-slow"></div> {/* Tamanho e opacidade ajustados */}
            <div className="absolute -bottom-16 -right-16 w-56 h-56 md:w-72 md:h-72 bg-brand-red/5 rounded-full filter blur-3xl opacity-40 md:opacity-50 animate-pulse-slow animation-delay-2000"></div>

            <div className="relative z-10 max-w-2xl lg:max-w-3xl mx-auto"> {/* Max-width ajustado */}
                <AnimatedSection delay={0} className="mb-4"> {/* Margin bottom ajustada */}
                    <div className="inline-flex flex-wrap items-center justify-center px-3 py-1.5 bg-white border border-gray-200 text-brand-pink text-xs font-semibold rounded-full shadow-sm gap-x-2 gap-y-1">
                        <span className="inline-flex items-center whitespace-nowrap"><FaLink aria-hidden="true" className="mr-1 text-blue-500"/>Análise Real do IG</span>
                        <span className="inline-flex items-center whitespace-nowrap"><FaTags aria-hidden="true" className="mr-1 text-indigo-500"/>Entende Conteúdo</span>
                        <span className="inline-flex items-center whitespace-nowrap"><FaClock aria-hidden="true" className="mr-1 text-cyan-500"/>Timing Inteligente</span>
                        <span className="inline-flex items-center whitespace-nowrap"><FaScroll aria-hidden="true" className="mr-1 text-teal-500"/>Gera Roteiros</span>
                    </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-brand-dark mb-5 leading-tight tracking-tight"> {/* Tamanho e espaçamento ajustados */}
                         Decole seu Instagram com Tuca: <span className="text-brand-pink">Sua IA Estrategista no WhatsApp.</span>
                    </h1>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                    <p className="text-md md:text-lg text-gray-700 mb-8 max-w-xl mx-auto font-light leading-relaxed"> {/* Tamanho e espaçamento ajustados */}
                        Pare de postar no escuro! Conecte seu Instagram e deixe o Tuca analisar suas métricas reais, categorizar seu conteúdo, otimizar horários, gerar roteiros e te inspirar. Cresça com estratégia e criatividade direcionada.
                    </p>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                    {!session ? (
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                            className="shimmer-button inline-flex items-center gap-2 px-6 py-3 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-sm md:text-base hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                            <FaLink aria-hidden="true" className="w-4 h-4 md:w-5 md:h-5" />
                            Conectar Instagram Grátis e Decolar
                        </button>
                     ) : (
                         <Link
                            href="/dashboard"
                            className="shimmer-button inline-block px-6 py-3 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-sm md:text-base hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                         >
                            Acessar meu Painel
                         </Link>
                     )}
                    <p className="text-xs text-gray-500 mt-3 font-light"> {/* Tamanho e espaçamento ajustados */}
                        Conexão segura e gratuita. Afiliação instantânea.
                    </p>
                </AnimatedSection>
            </div>
            {/* Comentário: Para o vídeo, considere usar next/image para um placeholder e carregar o player sob demanda (vídeo facade) para otimizar o LCP. */}
            <AnimatedSection delay={0.4} className="mt-12 md:mt-16 w-full max-w-2xl lg:max-w-3xl mx-auto"> {/* Espaçamento e max-width ajustados */}
                 <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-xl flex items-center justify-center overflow-hidden p-2">
                     {/* TODO: Substituir span por componente Image para thumbnail e lógica de carregamento do vídeo */}
                     <span className="text-gray-400 text-center text-sm p-3">[Vídeo de Demonstração do Tuca em Ação]</span>
                 </div>
            </AnimatedSection>
        </section>

        <section className="py-12 md:py-16 px-4 bg-white"> {/* Padding ajustado */}
            <div className="max-w-xl mx-auto text-center"> {/* Max-width ajustado */}
                <AnimatedSection delay={0}>
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-3">Cansado de postar no escuro?</h2>
                    <p className="text-md text-gray-700 font-light leading-relaxed">
                        O Tuca é sua IA estratégica <strong className="font-semibold text-brand-dark">conectada ao seu Instagram</strong>. Ele analisa seus dados, categoriza conteúdo, otimiza horários e te guia no WhatsApp para você criar com clareza e decolar.
                    </p>
                </AnimatedSection>
            </div>
        </section>

        <section id="depoimentos" className="py-12 md:py-16 px-4 bg-brand-light"> {/* Padding ajustado */}
              <div className="max-w-3xl mx-auto text-center"> {/* Max-width ajustado */}
                 <AnimatedSection delay={0}>
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-3">Criadores Impulsionando Resultados:</h2>
                    <p className="text-md text-gray-700 mb-10 md:mb-12 max-w-md mx-auto font-light leading-relaxed">O que dizem sobre ter o Tuca analisando seus dados e gerando insights no WhatsApp:</p>
                 </AnimatedSection>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6"> {/* Gap ajustado */}
                     <AnimatedSection delay={0.1} className="bg-white p-5 rounded-xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start gap-3"> {/* Padding e gap ajustados */}
                         <div className="w-12 h-12 md:w-14 md:h-14 bg-pink-200 rounded-full flex-shrink-0 border-2 border-white shadow-md flex items-center justify-center text-pink-600 font-semibold text-sm" aria-label="Avatar Criador 1">C1</div> {/* Tamanho e borda ajustados */}
                         <div>
                            <p className="text-brand-dark italic mb-2 font-light leading-relaxed text-sm">"Amei o planejamento de stories! O Tuca pensa em tudo. Já ganhei dinheiro indicando e as dicas de tipo e tema dos posts foram demais!"</p>
                            <p className="font-semibold text-xs text-brand-dark">- Nome do Criador 1</p>
                            <p className="text-xs text-brand-pink font-medium">Criador de Conteúdo - Viagem</p>
                         </div>
                     </AnimatedSection>
                     <AnimatedSection delay={0.2} className="bg-white p-5 rounded-xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start gap-3">
                          <div className="w-12 h-12 md:w-14 md:h-14 bg-green-200 rounded-full flex-shrink-0 border-2 border-white shadow-md flex items-center justify-center text-green-600 font-semibold text-sm" aria-label="Avatar Criador 2">C2</div>
                         <div>
                            <p className="text-brand-dark italic mb-2 font-light leading-relaxed text-sm">"Consultor inteligente no WhatsApp é revolucionário. O Tuca responde na hora com base no meu perfil. O programa de afiliados é genial!"</p>
                            <p className="font-semibold text-xs text-brand-dark">- Nome do Criador 2</p>
                            <p className="text-xs text-brand-pink font-medium">Afiliado e Criador - Fitness</p>
                         </div>
                     </AnimatedSection>
                 </div>
            </div>
        </section>

        {/* Container para as próximas seções de funcionalidades com espaçamento maior entre elas */}
        <div className="space-y-12 md:space-y-20"> {/* Espaçamento entre seções de funcionalidades ajustado */}

            {/* Seção 1: O Poder do Tuca (Imagem Esquerda, Texto Direita - Desktop) */}
            <section id="tuca-ia" className="pt-16 md:pt-20 px-4 bg-white overflow-hidden">
                  <div className="max-w-5xl mx-auto">
                    <AnimatedSection delay={0} className="text-center mb-10 md:mb-12">
                       <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-3 leading-tight">O Poder do Tuca: Sua IA Estratégica e Criativa</h2>
                       <p className="text-lg text-gray-700 font-light leading-relaxed max-w-xl mx-auto">
                           Seu consultor completo: analisa dados, categoriza conteúdo, otimiza horários, cria roteiros, aprende com você e mais. Tudo no WhatsApp.
                       </p>
                    </AnimatedSection>
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                         <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-red-50 to-purple-50 rounded-2xl shadow-lg flex items-center justify-center p-1 order-last md:order-first overflow-hidden">
                            <Image 
                               src="/images/tuca-analise-whatsapp.png" 
                               alt="Tuca no WhatsApp exibindo análise de conteúdo categorizado por tema/formato e otimização de horários com gráficos" 
                               fill // Substituído layout="fill"
                               className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                               sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                            />
                        </AnimatedSection>
                        <AnimatedSection delay={0} className="order-first md:order-last">
                             <div className="mb-3 flex items-center space-x-2 flex-wrap">
                                <FaLink aria-hidden="true" className="w-6 h-6 text-blue-500" />
                                <FaTags aria-hidden="true" className="w-6 h-6 text-indigo-500" />
                                <FaClock aria-hidden="true" className="w-6 h-6 text-cyan-500" />
                                <FaScroll aria-hidden="true" className="w-6 h-6 text-teal-500" />
                                <FaBrain aria-hidden="true" className="w-6 h-6 text-brand-red" />
                             </div>
                            <h3 className="text-xl md:text-2xl font-bold text-brand-dark mb-2 leading-tight">Análise Profunda, Categorização e Otimização de Timing</h3>
                            <p className="text-md text-gray-700 font-light leading-relaxed mb-3">
                                Conecte seu Instagram! O Tuca analisa suas métricas (atuais e de prints antigos), categoriza posts (Formato, Propósito, Contexto) e cruza com horários para revelar o que e quando postar.
                            </p>
                            <ul className="list-disc list-inside text-md text-gray-700 font-light leading-relaxed space-y-1">
                                <li>Entenda o que <strong className="font-medium">realmente funciona</strong>.</li>
                                <li>Descubra os <strong className="font-medium">melhores horários</strong> para cada conteúdo.</li>
                                <li>Transforme <strong className="font-medium">sucesso em mais sucesso</strong> com roteiros.</li>
                                <li>Receba <strong className="font-medium">recomendações alinhadas</strong> aos seus objetivos.</li>
                            </ul>
                        </AnimatedSection>
                    </div>
                   </div>
            </section>

            {/* Seção 2: Tuca Proativo (Texto Esquerda, Imagem Direita - Desktop) */}
            <section id="tuca-proativo" className="px-4 bg-brand-light overflow-hidden">
                <div className="max-w-5xl mx-auto py-12 md:py-16">
                    <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg flex items-center justify-center p-1 overflow-hidden order-last md:order-last">
                            <Image 
                               src="/images/tuca-nova-analise.png" 
                               alt="Ilustração do Tuca enviando alertas e insights inteligentes para o WhatsApp" 
                               fill // Substituído layout="fill"
                               className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                               sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                            />
                        </AnimatedSection>
                        <AnimatedSection delay={0} className="order-first md:order-first">
                            <div className="mb-3 flex items-center space-x-2">
                                <FaBell aria-hidden="true" className="w-7 h-7 text-brand-pink" />
                                <FaChartLine aria-hidden="true" className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold text-brand-dark mb-2 leading-tight">Tuca Proativo: Alertas e Insights Inteligentes</h3>
                            <p className="text-md text-gray-700 font-light leading-relaxed mb-3">
                                O Tuca monitora seu perfil 24/7 e te avisa no WhatsApp sobre o que importa. Quanto mais você interage, mais precisos os alertas.
                            </p>
                            <ul className="list-disc list-inside text-md text-gray-700 font-light leading-relaxed space-y-1">
                                <li><strong className="font-medium">Picos de Performance:</strong> "Seu Reel de Dica (Quinta, 18h) bombou! Que tal um roteiro?"</li>
                                <li><strong className="font-medium">Quedas de Desempenho:</strong> "Views dos Carrosséis de Review (Sábado) caíram. Vamos analisar?"</li>
                                <li><strong className="font-medium">Melhores Combinações:</strong> "Lembrete: Fotos LifeStyle sobre Viagem (Sextas, 10h) engajam bem."</li>
                            </ul>
                        </AnimatedSection>
                    </div>
                </div>
            </section>

            {/* Seção 3: Comunidade de Inspiração (Imagem Esquerda, Texto Direita - Desktop) */}
           <section id="comunidade-inspiracao" className="px-4 bg-white overflow-hidden">
               <div className="max-w-5xl mx-auto py-12 md:py-16">
                   <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                       <AnimatedSection delay={0} className="order-first md:order-last"> {/* Texto */}
                           <div className="mb-3 flex items-center space-x-2">
                               <FaUsers aria-hidden="true" className="w-7 h-7 text-purple-500" />
                               <FaLightbulb aria-hidden="true" className="w-6 h-6 text-yellow-400" />
                           </div>
                           <h3 className="text-xl md:text-2xl font-bold text-brand-dark mb-2 leading-tight">Comunidade de Inspiração: Aprenda com Outros Criadores</h3>
                           <p className="text-md text-gray-700 font-light leading-relaxed mb-3">
                               Sem ideias? Peça ao Tuca exemplos de posts de sucesso de outros criadores sobre temas, formatos e contextos específicos.
                           </p>
                           <ul className="list-disc list-inside text-md text-gray-700 font-light leading-relaxed space-y-1">
                               <li>Inspiração <strong className="font-medium">sob demanda</strong> e nas <strong className="font-medium">dicas diárias</strong>.</li>
                               <li>Foco em <strong className="font-medium">estratégia e insights qualitativos</strong>.</li>
                               <li><strong className="font-semibold text-brand-pink">Privacidade total:</strong> Métricas de terceiros NUNCA são compartilhadas.</li>
                           </ul>
                       </AnimatedSection>
                       <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl shadow-lg flex items-center justify-center p-1 order-last md:order-first overflow-hidden"> {/* Imagem */}
                           <Image 
                               src="/images/Tuca-comunidade.png" 
                               alt="Ilustração da comunidade de inspiração Tuca com exemplos de posts e interações" 
                               fill // Substituído layout="fill"
                               className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                               sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                           />
                       </AnimatedSection>
                   </div>
               </div>
           </section>

            {/* Seção 4: Tuca & Suas Publis (Texto Esquerda, Imagem Direita - Desktop) */}
           <section id="tuca-parcerias" className="px-4 bg-brand-light overflow-hidden">
               <div className="max-w-5xl mx-auto py-12 md:py-16">
                   <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                        <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl shadow-lg flex items-center justify-center p-1 order-last md:order-last overflow-hidden"> {/* Imagem */}
                           <Image 
                               src="/images/Tuca-publi.png" 
                               alt="Ilustração do Tuca ajudando a planejar e otimizar posts de publicidade (publis)" 
                               fill // Substituído layout="fill"
                               className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                               sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                           />
                       </AnimatedSection>
                       <AnimatedSection delay={0} className="order-first md:order-first"> {/* Texto */}
                           <div className="mb-3 flex items-center space-x-2">
                               <FaFileSignature aria-hidden="true" className="w-7 h-7 text-orange-500" />
                               <FaScroll aria-hidden="true" className="w-6 h-6 text-teal-500" />
                           </div>
                           <h3 className="text-xl md:text-2xl font-bold text-brand-dark mb-2 leading-tight">Tuca & Suas Publis: Estratégia e Criação para Parcerias</h3>
                           <p className="text-md text-gray-700 font-light leading-relaxed mb-3">
                               Transforme suas 'publis' em sucessos! Registre suas parcerias e deixe o Tuca te ajudar com:
                           </p>
                           <ul className="list-disc list-inside text-md text-gray-700 font-light leading-relaxed space-y-1">
                               <li><strong className="font-medium">Organização</strong> dos seus acordos.</li>
                               <li><strong className="font-medium">Ideias e roteiros</strong> para posts patrocinados eficazes.</li>
                               <li>Sugestões de <strong className="font-medium">melhor formato e horário</strong> para cada campanha.</li>
                               <li>Análise de propostas e otimização (em breve).</li>
                           </ul>
                       </AnimatedSection>
                   </div>
               </div>
           </section>

       </div> {/* Fim do container space-y para seções de funcionalidades */}


        <section id="monetizacao" className="py-16 md:py-20 px-4 bg-white overflow-hidden"> {/* Padding ajustado */}
              <div className="max-w-5xl mx-auto space-y-12 md:space-y-16">
                 {/* Seção 5: Monetização - Indique Amigos (Imagem Esquerda, Texto Direita - Desktop) */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                    <AnimatedSection delay={0} className="order-first md:order-last"> {/* Texto */}
                         <div className="mb-3"><FaGift className="w-10 h-10 text-brand-pink" /></div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-3 leading-tight">Indique Amigos, Ganhe Dinheiro!</h2>
                        <p className="text-md text-gray-700 font-light leading-relaxed mb-4">
                            No Data2Content, todos lucram, mesmo no plano grátis! Ao se cadastrar, você vira afiliado e recebe seu cupom exclusivo.
                        </p>
                        <ul className="list-disc list-inside text-md text-gray-700 font-light leading-relaxed space-y-1.5 mb-5">
                             <li>Seu amigo usa seu cupom? Ganha <strong className="font-medium">10% de desconto</strong>.</li>
                             <li>E você? Ganha <strong className="font-medium">10% de comissão</strong> recorrente.</li>
                        </ul>
                        <a href="#faq" className="inline-flex items-center font-semibold text-brand-pink hover:underline text-sm">
                            Detalhes da afiliação <FaArrowRight aria-hidden="true" className="w-3 h-3 ml-1.5" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-pink-50 to-red-50 rounded-2xl shadow-lg flex items-center justify-center p-1 order-last md:order-first overflow-hidden"> {/* Imagem */}
                        <Image 
                           src="/images/Tuca-comissao.png" 
                           alt="Ilustração do programa de afiliados do Tuca mostrando como ganhar comissões" 
                           fill // Substituído layout="fill"
                           className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                           sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                       />
                    </AnimatedSection>
                </div>

                {/* Seção 6: Monetização - Conecte-se a Marcas (Texto Esquerda, Imagem Direita - Desktop) */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                    <AnimatedSection delay={0.1} className="relative aspect-[3/2] bg-gradient-to-br from-yellow-50 to-green-50 rounded-2xl shadow-lg flex items-center justify-center p-1 order-last md:order-last overflow-hidden"> {/* Imagem */}
                         <Image 
                           src="/images/Tuca-agente.png" 
                           alt="Ilustração do Tuca conectando criadores a marcas e oportunidades de agenciamento" 
                           fill // Substituído layout="fill"
                           className="object-cover" // Substituído objectFit="contain" e removido rounded-lg
                           sizes="(max-width: 768px) 100vw, 50vw" // Adicionado para otimização
                       />
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-first"> {/* Texto */}
                         <div className="mb-3"><FaStar className="w-10 h-10 text-yellow-500" /></div>
                        <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-3 leading-tight">Conecte-se a Marcas e Oportunidades</h2>
                        <p className="text-md text-gray-700 font-light leading-relaxed mb-5">Use o Tuca, melhore seus resultados com dados reais e chame a atenção de marcas parceiras. Destaque-se para possível agenciamento por Arthur Marbá.</p>
                         <a href="#arthur-marba" className="inline-flex items-center font-semibold text-yellow-600 hover:underline text-sm">
                            Sobre o agenciamento <FaArrowRight aria-hidden="true" className="w-3 h-3 ml-1.5" />
                        </a>
                    </AnimatedSection>
                </div>
            </div>
        </section>


        <section id="como-funciona" className="py-12 md:py-20 px-4 bg-brand-light">
            <div className="max-w-4xl mx-auto text-center">
                <AnimatedSection delay={0}>
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4">Transforme seu Instagram em 4 Passos:</h2>
                    <p className="text-md text-gray-700 mb-12 md:mb-16 max-w-lg mx-auto font-light leading-relaxed">Tenha seu especialista IA conectado, aprendendo com você e trabalhando para seu sucesso no WhatsApp:</p>
                </AnimatedSection>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
                    <AnimatedSection delay={0.1} className="bg-white p-5 md:p-6 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-12 h-12 bg-brand-pink text-white rounded-full mb-4 text-xl font-semibold">1</div>
                        <h3 className="text-lg font-semibold text-brand-dark mb-2">Crie sua Conta</h3>
                        <p className="text-xs text-gray-600 font-light">Rápido e seguro com Google.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.2} className="bg-white p-5 md:p-6 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-12 h-12 bg-brand-pink text-white rounded-full mb-4 text-xl font-semibold">2</div>
                        <h3 className="text-lg font-semibold text-brand-dark mb-2">Conecte seu Instagram</h3>
                        <p className="text-xs text-gray-600 font-light">Para o Tuca analisar seus dados reais.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.3} className="bg-white p-5 md:p-6 rounded-xl shadow-md flex flex-col text-center items-center">
                         <div className="flex items-center justify-center w-12 h-12 bg-brand-pink text-white rounded-full mb-4 text-xl font-semibold">3</div>
                        <h3 className="text-lg font-semibold text-brand-dark mb-2">Interaja e Configure</h3>
                        <p className="text-xs text-gray-600 font-light">Informe objetivos, peça roteiros, envie prints antigos.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.4} className="bg-white p-5 md:p-6 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-12 h-12 bg-brand-pink text-white rounded-full mb-4 text-xl font-semibold">4</div>
                        <h3 className="text-lg font-semibold text-brand-dark mb-2">Receba Insights & Ganhe</h3>
                        <p className="text-xs text-gray-600 font-light">Dicas no WhatsApp e comissões por indicação.</p>
                    </AnimatedSection>
                </div>
            </div>
        </section>

         <section id="arthur-marba" className="py-16 md:py-24 px-4 bg-white">
              <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8 md:gap-12 items-center">
                <AnimatedSection delay={0} className="md:col-span-1">
                     <div className="relative aspect-w-1 aspect-h-1 bg-gray-300 rounded-2xl shadow-lg overflow-hidden flex items-center justify-center p-1">
                         {/* Imagem de Arthur Marbá - exemplo de como ficaria atualizada */}
                         {/* <Image 
                            src="/images/arthur-marba.jpg" // Substitua pelo caminho real da imagem
                            alt="Foto de Arthur Marbá" 
                            fill
                            className="object-cover" // object-cover é geralmente melhor para retratos
                            sizes="(max-width: 768px) 100vw, 33vw"
                         /> */}
                         <span className="text-gray-500 text-center text-lg p-3">[Foto de Arthur Marbá]</span>
                     </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1} className="md:col-span-2">
                     <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4 leading-tight">A Mente por Trás da Inteligência Completa do Tuca</h2>
                     <p className="text-md text-gray-700 mb-5 leading-relaxed font-light">
                         Arthur Marbá, Fundador da Data2Content, traz <strong className="font-semibold">10 anos de experiência dedicada ao marketing digital para criadores de conteúdo</strong>, somados a uma herança familiar de <strong className="font-semibold">40 anos no agenciamento de grandes talentos</strong>. Essa bagagem o levou a uma percepção crucial: as plataformas digitais, hoje, funcionam como a nova televisão, onde a compreensão profunda da audiência é a chave para o engajamento. Contudo, assim como um artista na TV se concentra na performance, o criador de conteúdo moderno precisa de um especialista para traduzir dados em direcionamento.
                         <br/><br/>
                         A Data2Content nasce dessa visão, com a paixão por <strong className="font-semibold text-brand-pink">buscar soluções inovadoras</strong> – muitas vezes inspiradas em nossos próprios usuários – para ser essa 'equipe de inteligência' essencial. Nosso objetivo é ser a <strong className="font-semibold text-brand-pink">parceira ideal no dia a dia da creator economy</strong>, atuando 'dos dados ao conteúdo'. Utilizamos inteligência artificial de ponta para mapear, interpretar e transformar métricas em estratégias claras e acionáveis. Essa conexão se manifesta ao fornecer dados precisos para parcerias com marcas, ao capacitar criadores com o entendimento de suas próprias métricas para conteúdo relevante, e ao facilitar colaborações sinérgicas. O Tuca, sua IA estratégica no WhatsApp, é a personificação dessa filosofia, analisando seu conteúdo, otimizando horários e aprendendo com você para entregar resultados de forma proativa e personalizada.
                     </p>
                     <blockquote className="mt-6 pl-4 border-l-4 border-brand-pink italic text-gray-700 font-light text-md md:text-lg leading-relaxed">
                         "Com o Tuca, democratizamos a consultoria estratégica, tornando-a acessível, personalizada, proativa e capaz de evoluir com cada criador, tudo via WhatsApp."
                         <cite className="mt-3 block text-sm font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador da Data2Content e Mentor da IA Tuca</cite>
                     </blockquote>
                </AnimatedSection>
            </div>
         </section>

         <section id="cta-final" className="py-16 md:py-24 px-4 bg-brand-dark text-white">
              <div className="max-w-xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5 leading-tight tracking-tight">Sua Vez de Ter uma Estratégia Completa e Inteligente (e Lucrar com Isso!)</h2>
                 </AnimatedSection>
                 <AnimatedSection delay={0.1}>
                    <p className="text-lg text-gray-300 mb-8 font-light leading-relaxed">Conecte sua conta, deixe o Tuca ser seu parceiro estratégico no Instagram e comece a ganhar comissões indicando amigos!</p>
                 </AnimatedSection>
                  {!session ? (
                    <AnimatedSection delay={0.2}>
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                            className="shimmer-button inline-flex items-center gap-2 px-8 py-3.5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                           <FaLink aria-hidden="true" className="w-5 h-5" />
                           Conectar Instagram e Decolar Agora
                        </button>
                    </AnimatedSection>
                    ) : (
                         <AnimatedSection delay={0.2}>
                            <Link
                                href="/dashboard"
                                className="shimmer-button inline-block px-8 py-3.5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                            >
                                Ir para Meu Painel <FaArrowRight aria-hidden="true" className="inline ml-2 w-4 h-4"/>
                            </Link>
                        </AnimatedSection>
                    )}
             </div>
         </section>

        <section id="faq" className="py-12 md:py-20 px-4 bg-white">
            <div className="max-w-2xl mx-auto">
                <AnimatedSection delay={0} className="text-center mb-12 md:mb-16">
                    <h2 className="text-2xl md:text-3xl font-bold text-brand-dark mb-4">Dúvidas sobre o Poder do Tuca?</h2>
                </AnimatedSection>
                <div className="space-y-6">
                    {faqItems.map((item, index) => (
                        <AnimatedSection delay={0.1 * (index + 1)} key={index}>
                            <details className="group bg-brand-light p-4 md:p-5 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
                                <summary className="flex justify-between items-center font-semibold text-brand-dark text-sm md:text-base cursor-pointer hover:text-brand-pink list-none">
                                    {item.q}
                                    <FaQuestionCircle aria-hidden="true" className="text-brand-pink group-open:rotate-180 transition-transform duration-200 ml-2 flex-shrink-0 w-4 h-4"/>
                                </summary>
                                <div className="text-gray-700 mt-3 text-sm font-light leading-relaxed whitespace-pre-line"
                                   dangerouslySetInnerHTML={{ __html: item.a.replace(/\n\n\*/g, '<br /><br />&#8226; ').replace(/\n\*/g, '<br />&#8226; ').replace(/\n/g, '<br />') }}
                                >
                                </div>
                            </details>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>

         <footer className="text-center py-8 md:py-10 bg-brand-light text-xs text-gray-600 font-light">
             <div className="mb-3 text-brand-dark font-bold text-xl">Data2Content</div>
             <p className="mb-1.5">© {new Date().getFullYear()} Data2Content. Todos os direitos reservados por Marbá.</p>
             <div className="mt-2 space-x-4 flex flex-wrap justify-center items-center">
                 <Link href="/politica-de-privacidade" className="underline hover:text-brand-pink transition-colors">
                    Política de Privacidade
                 </Link>
                 <Link href="/termos-e-condicoes" className="underline hover:text-brand-pink transition-colors">
                    Termos e Condições
                 </Link>
                 <a 
                    href="https://www.instagram.com/data2content/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="underline hover:text-brand-pink transition-colors inline-flex items-center"
                 >
                    <FaInstagram aria-hidden="true" className="w-3 h-3 mr-1" />
                    Instagram
                 </a>
             </div>
         </footer>

      </div>

      <style jsx global>{`
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-20deg);
          will-change: left;
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          70% {
            left: 150%;
          }
          100% {
            left: 150%;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.02);
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          will-change: opacity, transform;
        }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </>
  );
}
