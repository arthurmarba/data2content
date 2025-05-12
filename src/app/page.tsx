"use client";

import React, { useEffect } from "react";
import Head from "next/head";
import Link from "next/link"; // Importar Link para navegação interna
import { useSession, signIn } from "next-auth/react";
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
// Importando React Icons (ajustei para os que parecem ser realmente usados no JSX fornecido)
import { FaArrowRight, FaGift, FaWhatsapp, FaBrain, FaGoogle, FaStar, FaFileUpload, FaQuestionCircle, FaHandshake, FaVideo } from 'react-icons/fa';

// --- Variantes de Animação (Framer Motion) ---
const fadeInUp = {
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: "easeOut"
    }
  }
};

// Componente auxiliar para aplicar animação de scroll
const AnimatedSection = ({ children, delay = 0, className = "", once = true, amount = 0.1 }: { children: React.ReactNode, delay?: number, className?: string, once?: boolean, amount?: number }) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: amount,
  });

  useEffect(() => {
    if (inView) {
      controls.start(i => ({
        ...fadeInUp.visible,
        transition: { ...fadeInUp.visible.transition, delay: i * 0.12 }
      }));
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
};


export default function HomePage() {
  const { data: session } = useSession();

  return (
    <>
      <Head>
        <title>Data2Content: Decole seu Instagram com Consultor IA no WhatsApp & Ganhe Indicando</title>
        <meta
          name="description"
          content="Tuca: seu consultor IA para Instagram, 100% no WhatsApp. Receba estratégias personalizadas, entenda seus dados e ganhe dinheiro indicando (10% comissão + 10% desc. para amigos). Treinado por Arthur Marbá."
        />
      </Head>

      <div className="bg-white text-brand-dark font-sans">

        <header className="fixed top-0 left-0 w-full py-3 px-4 md:px-6 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
             <div className="max-w-7xl mx-auto flex justify-between items-center h-12 md:h-14">
                <span className="font-bold text-xl md:text-2xl text-brand-dark">Data2Content</span>
                <nav className="hidden md:flex space-x-5 lg:space-x-8">
                    <a href="#tuca-ia" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Tuca IA</a>
                    <a href="#como-funciona" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Como Funciona</a>
                    <a href="#monetizacao" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Monetização</a>
                    <a href="#arthur-marba" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">Arthur Marbá</a>
                    <a href="#faq" className="text-sm lg:text-base text-gray-600 hover:text-brand-pink transition-colors">FAQ</a>
                </nav>
                {!session ? (
                     <button
                        onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                        className="px-5 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-medium text-brand-dark border border-gray-300 rounded-full hover:bg-gray-100 transition-colors duration-150"
                    >
                        Entrar com Google
                    </button>
                ) : (
                     <Link
                        href="/dashboard"
                        className="px-5 py-2 md:px-6 md:py-2.5 text-xs md:text-sm font-medium text-white bg-brand-pink rounded-full hover:opacity-90 transition-opacity duration-150"
                    >
                        Meu Painel
                    </Link>
                )}
            </div>
        </header>

        {/* Seção Hero */}
        <section id="hero" className="relative flex flex-col items-center justify-center text-center px-4 min-h-screen pt-20 md:pt-24 pb-16 md:pb-24 bg-brand-light overflow-hidden">
             <div className="absolute -top-20 -left-20 w-72 h-72 md:w-96 md:h-96 bg-brand-pink/5 rounded-full filter blur-3xl opacity-60 md:opacity-70 animate-pulse-slow"></div>
            <div className="absolute -bottom-20 -right-20 w-72 h-72 md:w-96 md:h-96 bg-brand-red/5 rounded-full filter blur-3xl opacity-60 md:opacity-70 animate-pulse-slow animation-delay-2000"></div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <AnimatedSection delay={0} className="mb-6">
                    <span className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 text-brand-pink text-sm font-semibold rounded-full shadow-sm">
                        <FaWhatsapp className="inline mr-1.5 mb-0.5 text-green-500 text-base"/>Consultor Inteligente <FaBrain className="inline mx-1.5 mb-0.5 text-base"/> + <FaGift className="inline ml-1.5 mr-1 mb-0.5 text-base"/> Ganhe Indicando
                    </span>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-brand-dark mb-8 leading-[1.1] tracking-tighter">
                         Decole seu Instagram com Tuca: <span className="text-brand-pink">Seu Mentor IA no WhatsApp.</span>
                    </h1>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                    <p className="text-lg md:text-xl lg:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto font-light leading-relaxed md:leading-loose">
                        Receba estratégias personalizadas e dicas diárias do Tuca, sua IA treinada por experts, <strong className="font-semibold text-brand-dark">direto no seu WhatsApp</strong>. Transforme seus resultados e <strong className="font-semibold text-brand-dark">ganhe dinheiro indicando amigos</strong> (eles também ganham desconto!).
                    </p>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                    {!session ? (
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })}
                            className="shimmer-button inline-flex items-center gap-3 px-8 py-4 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                            <FaGoogle className="w-5 h-5" />
                            Começar Grátis e Ganhar Indicando
                        </button>
                     ) : (
                         <Link
                            href="/dashboard"
                            className="shimmer-button inline-block px-8 py-4 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                         >
                            Acessar meu Painel
                         </Link>
                     )}
                    <p className="text-sm text-gray-500 mt-6 font-light">
                        Cadastro rápido e gratuito. Afiliação instantânea.
                    </p>
                </AnimatedSection>
            </div>
            <AnimatedSection delay={0.4} className="mt-20 md:mt-24 w-full max-w-4xl lg:max-w-5xl mx-auto">
                 <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden p-2 md:p-4">
                     <span className="text-gray-400 text-center text-base md:text-lg font-light p-4">[Vídeo de Demonstração do Tuca em Ação]</span>
                 </div>
            </AnimatedSection>
        </section>

        <section className="py-16 md:py-24 px-4 bg-white">
            <div className="max-w-3xl mx-auto text-center">
                <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Posta, posta e nada acontece? Confuso com o algoritmo?</h2>
                    <p className="text-lg text-gray-700 font-light leading-relaxed">
                        Entender o que engaja no Instagram, criar conteúdo que viraliza e transformar seguidores em dinheiro real exige mais que sorte. Precisa de <strong className="font-semibold text-brand-pink">estratégia, análise dos seus próprios resultados e conhecimento de mercado</strong>. O Data2Content te entrega tudo isso com o Tuca, seu consultor inteligente no WhatsApp.
                    </p>
                </AnimatedSection>
            </div>
        </section>

        <section id="depoimentos" className="py-16 md:py-24 px-4 bg-brand-light">
              <div className="max-w-5xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Veja Criadores Decolando com o Data2Content:</h2>
                    <p className="text-lg text-gray-700 mb-16 md:mb-20 max-w-xl mx-auto font-light leading-relaxed">O que eles dizem sobre ter o Tuca como aliado no WhatsApp:</p>
                 </AnimatedSection>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
                     <AnimatedSection delay={0.1} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-6">
                         <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-pink-200 rounded-full flex-shrink-0 border-4 border-white shadow-md flex items-center justify-center text-pink-600 font-semibold text-lg">C1</div>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed text-base">"Amei receber o planejamento de stories todo dia no WhatsApp! O Tuca pensa em tudo. E já ganhei uma grana indicando pros amigos, que ainda tiveram desconto! As dicas sobre o 'tipo e tema' dos meus posts foram demais!"</p>
                            <p className="font-semibold text-base text-brand-dark">- Nome do Criador 1</p>
                            <p className="text-sm text-brand-pink font-medium">Criador de Conteúdo Instagram - Nicho Viagem</p>
                         </div>
                     </AnimatedSection>
                     <AnimatedSection delay={0.2} className="bg-white p-6 md:p-8 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-6">
                          <div className="w-16 h-16 md:w-[72px] md:h-[72px] bg-green-200 rounded-full flex-shrink-0 border-4 border-white shadow-md flex items-center justify-center text-green-600 font-semibold text-lg">C2</div>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed text-base">"Ter um consultor inteligente no WhatsApp é revolucionário. Qualquer dúvida sobre meus resultados, o Tuca responde na hora com base no que está acontecendo no meu perfil. E o programa de afiliados que dá desconto pro indicado é genial!"</p>
                            <p className="font-semibold text-base text-brand-dark">- Nome do Criador 2</p>
                            <p className="text-sm text-brand-pink font-medium">Afiliado e Criador Instagram - Nicho Fitness</p>
                         </div>
                     </AnimatedSection>
                 </div>
            </div>
        </section>

        <section id="tuca-ia" className="py-16 md:py-24 px-4 bg-white overflow-hidden">
              <div className="max-w-6xl mx-auto space-y-20 md:space-y-24">
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                     <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-red-50 to-purple-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                        <span className="text-purple-700 text-center text-xl p-4">[Ilustração: Tuca Consultor IA no WhatsApp]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-4 flex items-center space-x-3">
                            <FaWhatsapp className="w-11 h-11 md:w-12 md:h-12 text-green-500" />
                            <FaBrain className="w-11 h-11 md:w-12 md:h-12 text-brand-red" />
                         </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">Desvende seu Instagram com Tuca: Seu Mentor IA no WhatsApp</h2>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                            Chega de complicação! Com Tuca, a estratégia para crescer no Instagram está <strong className="font-semibold text-brand-dark">na palma da sua mão, via WhatsApp</strong>. Ele analisa seus resultados e vai além:
                        </p>
                        <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                            <li><strong className="font-medium text-brand-dark">Receba Ideias Diárias:</strong> Planejamento de Stories e dicas personalizadas que chegam até você.</li>
                            <li><strong className="font-medium text-brand-dark">Descubra o que Funciona:</strong> Tuca analisa o Tipo e Tema do seu conteúdo para revelar seus posts de maior impacto.</li>
                            <li><strong className="font-medium text-brand-dark">Aprenda com um Expert:</strong> Conselhos baseados nos 40 anos de experiência de Arthur Marbá no mercado.</li>
                        </ul>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-8">
                           Tenha um especialista te guiando com a facilidade do WhatsApp.
                        </p>
                         <a href="#faq" className="inline-flex items-center font-semibold text-brand-red hover:underline text-base md:text-lg">
                            Por que o Tuca é diferente? <FaArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </AnimatedSection>
                </div>

                <div id="monetizacao" className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0}>
                         <div className="mb-4"><FaGift className="w-10 h-10 md:w-11 md:h-11 text-brand-pink" /></div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">Indique Amigos, Ganhe Dinheiro (Todos Saem Ganhando!)</h2>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-4">
                            No Data2Content, <strong className="font-semibold text-brand-dark">todo mundo pode lucrar, até no plano grátis!</strong> Ao se cadastrar, você já vira afiliado e recebe seu cupom exclusivo.
                        </p>
                        <ul className="list-disc list-inside text-lg text-gray-700 font-light leading-relaxed space-y-2 mb-6">
                             <li>Seu amigo usa seu cupom? <strong className="font-medium text-brand-dark">Ele ganha 10% de desconto</strong> na assinatura do Tuca.</li>
                             <li>E você? <strong className="font-medium text-brand-dark">Ganha 10% de comissão</strong> todo mês enquanto ele for assinante.</li>
                        </ul>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-8">Ajude outros criadores a crescer e seja recompensado por isso!</p>
                        <a href="#faq" className="inline-flex items-center font-semibold text-brand-pink hover:underline text-base md:text-lg">
                            Ver detalhes da afiliação <FaArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-pink-50 to-red-50 rounded-3xl shadow-lg flex items-center justify-center p-6">
                        <span className="text-pink-700 text-center text-xl p-4">[Ilustração: Programa de Afiliados Data2Content]</span>
                    </AnimatedSection>
                </div>

                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0.1} className="aspect-w-1 aspect-h-1 bg-gradient-to-br from-yellow-50 to-green-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                         <span className="text-yellow-700 text-center text-xl p-4">[Ilustração: Oportunidades com Marcas]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-4"><FaStar className="w-10 h-10 md:w-11 md:h-11 text-yellow-500" /></div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">Conecte-se a Marcas e Oportunidades Reais</h2>
                        <p className="text-lg text-gray-700 font-light leading-relaxed mb-8">Use o Tuca, melhore seus resultados e <strong className="font-semibold text-brand-dark">chame a atenção de marcas parceiras</strong> que buscam criadores para campanhas. Além disso, destaque-se e seja considerado para <strong className="font-semibold text-brand-dark">agenciamento exclusivo</strong> por Arthur Marbá.</p>
                         <a href="#arthur-marba" className="inline-flex items-center font-semibold text-yellow-600 hover:underline text-base md:text-lg">
                            Como funciona o agenciamento? <FaArrowRight className="w-4 h-4 ml-2" />
                        </a>
                    </AnimatedSection>
                </div>
            </div>
        </section>

        <section id="como-funciona" className="py-16 md:py-24 px-4 bg-brand-light">
            <div className="max-w-5xl mx-auto text-center">
                <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Comece a Usar o Tuca em 4 Passos:</h2>
                    <p className="text-lg text-gray-700 mb-16 md:mb-20 max-w-xl mx-auto font-light leading-relaxed">É rápido e fácil ter seu especialista inteligente no WhatsApp:</p>
                </AnimatedSection>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <AnimatedSection delay={0.1} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">1</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Crie sua Conta Grátis</h3>
                        <p className="text-base text-gray-600 font-light">Use sua conta Google. Rápido e seguro.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.2} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">2</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Conecte seu Instagram</h3>
                        <p className="text-base text-gray-600 font-light">Autorize com segurança para o Tuca ver seus resultados.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.3} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center">
                         <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">3</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Envie seu Histórico (Se Quiser)</h3>
                        <p className="text-base text-gray-600 font-light">Mande capturas de tela antigas para uma análise completa <FaFileUpload className="inline ml-1"/>.</p>
                    </AnimatedSection>
                    <AnimatedSection delay={0.4} className="bg-white p-6 md:p-8 rounded-xl shadow-md flex flex-col text-center items-center">
                        <div className="flex items-center justify-center w-14 h-14 bg-brand-pink text-white rounded-full mb-5 text-2xl font-semibold">4</div>
                        <h3 className="text-xl font-semibold text-brand-dark mb-3">Converse e Ganhe!</h3>
                        <p className="text-base text-gray-600 font-light">Fale com o Tuca no WhatsApp <FaWhatsapp className="inline ml-1 text-green-500"/> e indique amigos <FaGift className="inline ml-1"/>.</p>
                    </AnimatedSection>
                </div>
            </div>
        </section>

         <section id="arthur-marba" className="py-16 md:py-24 px-4 bg-white">
              <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-10 md:gap-16 items-center">
                <AnimatedSection delay={0} className="md:col-span-2">
                     <div className="aspect-w-4 aspect-h-5 bg-gray-300 rounded-3xl shadow-lg overflow-hidden flex items-center justify-center">
                         <span className="text-gray-500 text-center text-xl p-4">[Foto de Arthur Marbá]</span>
                     </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1} className="md:col-span-3">
                     <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-brand-dark mb-6 leading-tight">A Mente por Trás da Inteligência do Tuca</h2>
                     <p className="text-lg text-gray-700 mb-6 leading-relaxed font-light">
                         O grande diferencial do Data2Content é que o Tuca aprendeu com a <strong className="text-brand-pink">experiência de 40 anos de Arthur Marbá</strong>. Todo o conhecimento dele sobre algoritmos, estratégias de conteúdo, publicidade e imagem no Instagram foi <strong className="font-semibold text-brand-dark">ensinado ao Tuca</strong>.
                     </p>
                     <blockquote className="mt-8 pl-6 border-l-4 border-brand-pink italic text-gray-700 font-light text-lg md:text-xl leading-relaxed">
                         "Com o Tuca, meu objetivo foi escalar e democratizar o tipo de consultoria estratégica que ofereço há décadas, tornando-a acessível e personalizada para cada criador do Instagram através da tecnologia inteligente, com a praticidade do WhatsApp."
                         <cite className="mt-4 block text-base font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador e Mentor da IA Tuca</cite>
                     </blockquote>
                </AnimatedSection>
            </div>
         </section>

         <section id="cta-final" className="py-20 md:py-32 px-4 bg-brand-dark text-white">
              <div className="max-w-2xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tighter">Sua Vez de Decolar no Instagram (e Lucrar com Isso!)</h2>
                 </AnimatedSection>
                 <AnimatedSection delay={0.1}>
                    <p className="text-xl text-gray-300 mb-10 font-light leading-relaxed">Crie sua conta gratuita, chame o Tuca no WhatsApp e comece a ganhar comissões indicando amigos agora mesmo!</p>
                 </AnimatedSection>
                  {!session ? (
                    <AnimatedSection delay={0.2}>
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/auth/complete-signup" })} 
                            className="shimmer-button inline-flex items-center gap-3 px-10 py-4 md:px-12 md:py-5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-lg md:text-xl hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                           <FaGoogle className="w-6 h-6" />
                           Começar Grátis e Lucrar Indicando
                        </button>
                    </AnimatedSection>
                    ) : (
                         <AnimatedSection delay={0.2}>
                            <Link 
                                href="/dashboard"
                                className="shimmer-button inline-block px-10 py-4 md:px-12 md:py-5 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-lg md:text-xl hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                            >
                                Ir para Meu Painel <FaArrowRight className="inline ml-2.5 w-5 h-5"/>
                            </Link>
                        </AnimatedSection>
                    )}
             </div>
         </section>

        <section id="faq" className="py-16 md:py-24 px-4 bg-white">
            <div className="max-w-3xl mx-auto">
                <AnimatedSection delay={0} className="text-center mb-16 md:mb-20">
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6">Perguntas Frequentes</h2>
                </AnimatedSection>
                <div className="space-y-8">
                    {[
                        {
                            q: "Qual a diferença do Tuca para outros assistentes virtuais?",
                            a: "Ótima pergunta! O Tuca é muito mais que um chat genérico. As principais diferenças são:\n\n1. **Foco Total no Instagram e nos SEUS Resultados:** O Tuca é especialista em Instagram. Ele vê seus resultados (através de uma conexão direta e segura, e também por capturas de tela que você envia) e responde cada pergunta com base neles. Além disso, ele lê as descrições dos seus posts para entender o Tipo e Tema (ex: Dica/Fitness) do seu conteúdo e identificar o que funciona melhor PARA VOCÊ.\n\n2. **Conhecimento Especializado do Fundador:** A inteligência do Tuca foi ensinada com os 40 anos de experiência de Arthur Marbá em estratégias para Instagram. É como ter um mentor experiente olhando para os seus resultados.\n\n3. **100% no WhatsApp e Sempre Alerta:** Você conversa com o Tuca e recebe dicas e ideias (como para Stories diários) direto no seu WhatsApp, sem precisar de outros apps. Ele te ajuda por conta própria com sugestões!\n\nResumindo, o Tuca é seu consultor pessoal, especialista em Instagram, que conhece seu perfil a fundo e te ajuda de forma esperta no WhatsApp."
                        },
                        {
                            q: "Como funciona o programa de afiliados? Todos podem participar?",
                            a: "Sim, todos os usuários do Data2Content, mesmo os que utilizam o plano gratuito, se tornam afiliados automaticamente ao criar a conta! Funciona assim:\n\n1. **Você Recebe um Cupom:** Ao se cadastrar, você ganha um cupom de desconto exclusivo para compartilhar.\n2. **Seu Amigo Ganha Desconto:** Quando alguém utiliza o seu cupom para assinar um plano pago do Tuca, essa pessoa recebe 10% de desconto na assinatura.\n3. **Você Ganha Comissão:** Você recebe 10% de comissão recorrente sobre o valor da assinatura paga pelo seu amigo, enquanto ele mantiver a assinatura ativa.\n\nÉ uma forma de você lucrar ajudando seus amigos a também terem acesso à consultoria inteligente do Tuca!"
                        },
                        { q: "O Data2Content é realmente gratuito para começar?", a: "Sim! Você pode criar sua conta gratuitamente e já se torna um afiliado com acesso ao seu cupom. Funcionalidades básicas da plataforma também estão disponíveis. O Tuca e recursos avançados de análise são parte do nosso plano premium." },
                        { q: "Como o Tuca acessa meus resultados do Instagram? É seguro?", a: "A segurança e privacidade dos seus dados são nossa prioridade máxima. O Tuca acessa seus dados de duas formas, sempre com sua permissão:\n1. **Conexão Direta e Segura:** Após você conectar sua conta profissional do Instagram (de forma segura através do Facebook/Meta), o Tuca busca seus resultados de performance automaticamente.\n2. **Envio de Capturas de Tela:** Você pode, se quiser, enviar capturas de tela com seus resultados antigos. Nossa tecnologia inteligente lê essas imagens para entender seus dados.\nTodos os dados são tratados com confidencialidade, seguindo as diretrizes do Instagram e a LGPD. Você tem total controle, incluindo a opção de solicitar a exclusão." },
                        { q: "Preciso ter uma conta profissional do Instagram?", a: "Sim, para que o Tuca possa ver seus resultados automaticamente através da conexão direta, é necessário ter uma conta Profissional (Comercial ou Criador de Conteúdo) no Instagram vinculada a uma Página do Facebook." },
                    ].map((item, index) => (
                        <AnimatedSection delay={0.1 * (index + 1)} key={index}>
                            <details className="group bg-brand-light p-5 md:p-6 rounded-lg shadow hover:shadow-md transition-shadow duration-200">
                                <summary className="flex justify-between items-center font-semibold text-brand-dark text-base md:text-lg cursor-pointer hover:text-brand-pink list-none">
                                    {item.q}
                                    <FaQuestionCircle className="text-brand-pink group-open:rotate-180 transition-transform duration-200 ml-3 flex-shrink-0 w-5 h-5"/>
                                </summary>
                                <p className="text-gray-700 mt-4 font-light leading-relaxed text-sm md:text-base whitespace-pre-line">
                                    {item.a}
                                </p>
                            </details>
                        </AnimatedSection>
                    ))}
                </div>
            </div>
        </section>

         <footer className="text-center py-10 md:py-12 bg-brand-light text-sm text-gray-600 font-light">
             <div className="mb-4 text-brand-dark font-bold text-2xl">Data2Content</div>
             <p className="mb-2">© {new Date().getFullYear()} Data2Content. Todos os direitos reservados por Marbá.</p>
             <div className="mt-3 space-x-5">
                 {/* <<< ATUALIZAÇÃO APLICADA AQUI >>> */}
                 <Link href="/politica-de-privacidade" className="underline hover:text-brand-pink transition-colors">
                    Política de Privacidade
                 </Link>
                 <Link href="/termos-e-condicoes" className="underline hover:text-brand-pink transition-colors">
                    Termos e Condições {/* Ajustado para Termos e Condições e caminho correto */}
                 </Link>
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
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 0.4;
          }
        }
        .animate-pulse-slow {
          animation: pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>
    </>
  );
}
