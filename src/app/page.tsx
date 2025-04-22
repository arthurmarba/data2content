"use client";

import React, { useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
// Importando Framer Motion
import { motion, useAnimation } from "framer-motion";
import { useInView } from "react-intersection-observer";
// Importando React Icons
import { FaArrowRight, FaDollarSign, FaComments, FaStar, FaUsers, FaGoogle } from 'react-icons/fa';

// --- Variantes de Animação (Framer Motion) ---
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      // --- CORREÇÃO: Usando easing padrão ---
      ease: "easeOut" // Substituído o array cubic-bezier por uma string padrão
      // --- FIM CORREÇÃO ---
    }
  }
};

// Componente auxiliar para aplicar animação de scroll
const AnimatedSection = ({ children, delay = 0, className = "", once = true, amount = 0.15 }: { children: React.ReactNode, delay?: number, className?: string, once?: boolean, amount?: number }) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: amount,
  });

  useEffect(() => {
    if (inView) {
      // Aplica o delay na transição quando a animação inicia
      controls.start(i => ({
        ...fadeInUp.visible, // Pega as propriedades de 'visible'
        transition: { ...fadeInUp.visible.transition, delay: i * 0.15 } // Adiciona o delay calculado
      }));
    } else if (!once) {
       controls.start("hidden");
    }
    // Adicionando 'once' ao array de dependências se ele for usado na lógica de reset
  }, [controls, inView, once]);


  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={fadeInUp}
      custom={delay} // Passa o delay para ser usado no 'start' do useEffect
      className={className}
    >
      {/* Não precisa mais do motion.div interno para delay */}
      {children}
    </motion.div>
  );
};


export default function HomePage() {
  const { data: session } = useSession();

  // --- Início do Retorno JSX ---
  return (
    <>
      <Head>
        <title>Data2Content: Sua Carreira de Criador Decola Aqui</title>
        <meta
          name="description"
          content="Plataforma com IA e expertise em agenciamento para criadores gerenciarem carreira, ganharem como afiliados e acessarem oportunidades com marcas."
        />
        {/* ... (meta tags mantidas) ... */}
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Estrutura principal */}
      <div className="bg-white text-brand-dark">

        {/* Header Fixo */}
        <header className="fixed top-0 left-0 w-full py-3 px-4 md:px-6 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
             <div className="max-w-7xl mx-auto flex justify-between items-center">
                {/* ** SUBSTITUA PELO SEU LOGO REAL ** */}
                <span className="font-bold text-xl text-brand-dark">Data2Content</span>
                {!session ? (
                     <button
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                        className="px-5 py-2 text-xs md:text-sm font-medium text-brand-dark border border-gray-300 rounded-full hover:bg-gray-100 transition-default"
                    >
                        Entrar
                    </button>
                ) : (
                     <a
                        href="/dashboard"
                        className="px-5 py-2 text-xs md:text-sm font-medium text-white bg-brand-pink rounded-full hover:opacity-90 transition-default"
                    >
                        Meu Painel
                    </a>
                )}
            </div>
        </header>

        {/* Seção 1: Hero */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 min-h-screen pt-32 pb-20 md:pt-40 bg-brand-light overflow-hidden">
            {/* ... (elementos gráficos e conteúdo do Hero mantidos, usando AnimatedSection) ... */}
             <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-pink/5 rounded-full filter blur-3xl opacity-70 animate-pulse-slow"></div>
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-brand-red/5 rounded-full filter blur-3xl opacity-70 animate-pulse-slow animation-delay-2000"></div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <AnimatedSection delay={0} className="mb-6">
                    <span className="inline-block px-4 py-1.5 bg-white border border-gray-200 text-brand-pink text-sm font-semibold rounded-full shadow-sm">
                        IA + Expertise em Agenciamento
                    </span>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-brand-dark mb-8 leading-tight tracking-tighter">
                         Sua Carreira de Criador Decola Aqui.
                    </h1>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                    <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
                        A plataforma Data2Content une consultoria estratégica com IA via WhatsApp, gestão de carreira com 40 anos de expertise e <strong className="font-semibold text-brand-pink">oportunidades reais</strong> com marcas e nosso programa de afiliados.
                    </p>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                    {!session ? (
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            className="shimmer-button inline-flex items-center gap-2 px-10 py-4 bg-brand-pink text-white rounded-full shadow-lg font-bold text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                            <FaGoogle className="w-5 h-5" />
                            Entrar com Google e Virar Afiliado
                        </button>
                     ) : (
                         <a
                            href="/dashboard"
                            className="shimmer-button inline-block px-10 py-4 bg-brand-pink text-white rounded-full shadow-lg font-bold text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                         >
                            Acessar meu Painel
                         </a>
                     )}
                    <p className="text-sm text-gray-500 mt-4 font-light">
                        Login gratuito para acesso imediato ao programa de afiliados.
                    </p>
                </AnimatedSection>
            </div>
            <AnimatedSection delay={0.4} className="mt-20 md:mt-24 w-full max-w-5xl mx-auto">
                 <div className="aspect-video bg-gradient-to-br from-brand-dark to-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden p-8">
                     <span className="text-gray-400 text-lg font-light">[Visual Impactante: Demonstração do Tuca em Ação]</span>
                 </div>
            </AnimatedSection>
        </section>

        {/* Seção 2: Prova Social (Depoimentos com Fotos) */}
        <section className="py-20 md:py-28 px-4 bg-white">
             {/* ... (conteúdo da Prova Social mantido, usando AnimatedSection) ... */}
              <div className="max-w-5xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-5">Aprovado por Criadores como Você</h2>
                    <p className="text-gray-600 mb-16 max-w-xl mx-auto font-light leading-relaxed">Veja o que dizem sobre a transformação Data2Content:</p>
                 </AnimatedSection>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                     {/* Depoimento 1 */}
                     <AnimatedSection delay={0.1} className="bg-brand-light p-8 rounded-xl shadow-lg text-left flex flex-col items-center md:flex-row md:items-start md:text-left gap-6">
                         {/* ** SUBSTITUA PELA FOTO REAL ** */}
                         <Image src="/placeholder-avatar.jpg" alt="Nome do Criador 1" width={80} height={80} className="rounded-full flex-shrink-0 border-4 border-white shadow-md"/>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed">"[Depoimento focado em resultado: Ex: O Tuca me deu o plano que me fez fechar minha primeira publi grande!]"</p>
                            <p className="font-semibold text-sm text-brand-dark">- Nome do Criador 1</p>
                            <p className="text-xs text-brand-pink font-medium">Criador de Conteúdo - Nicho</p>
                         </div>
                     </AnimatedSection>
                      {/* Depoimento 2 */}
                     <AnimatedSection delay={0.2} className="bg-brand-light p-8 rounded-xl shadow-lg text-left flex flex-col items-center md:flex-row md:items-start md:text-left gap-6">
                          {/* ** SUBSTITUA PELA FOTO REAL ** */}
                          <Image src="/placeholder-avatar-2.jpg" alt="Nome do Criador 2" width={80} height={80} className="rounded-full flex-shrink-0 border-4 border-white shadow-md"/>
                         <div>
                            <p className="text-brand-dark italic mb-4 font-light leading-relaxed">"[Depoimento focado em afiliação/oportunidade: Ex: Virei afiliado e já paguei minha assinatura só com as comissões!]"</p>
                            <p className="font-semibold text-sm text-brand-dark">- Nome do Criador 2</p>
                            <p className="text-xs text-brand-pink font-medium">Afiliado e Criador - Nicho</p>
                         </div>
                     </AnimatedSection>
                 </div>
            </div>
        </section>

        {/* Seção 3: Benefícios Chave (Layout Alternado) */}
        <section className="py-20 md:py-28 px-4 bg-white overflow-hidden">
             {/* ... (conteúdo dos Benefícios mantido, usando AnimatedSection) ... */}
              <div className="max-w-6xl mx-auto space-y-24">
                {/* Item 1: Afiliação */}
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0}>
                        <div className="mb-3"><FaDollarSign className="w-10 h-10 text-brand-pink" /></div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-5 leading-tight">Ganhe Como Afiliado Desde o Dia 1</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-6">Faça login gratuito e receba seu link exclusivo. Indique o Tuca e ganhe 10% de comissão recorrente. Simples assim.</p>
                        <a href="#" className="inline-flex items-center font-semibold text-brand-pink hover:underline">
                            Saiba mais sobre a afiliação <FaArrowRight className="w-3 h-3 ml-1" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-pink-50 to-red-50 rounded-2xl shadow-lg flex items-center justify-center p-8">
                        <span className="text-6xl text-brand-pink opacity-70">[Ilustração Afiliação]</span>
                    </AnimatedSection>
                </div>

                {/* Item 2: Consultor Tuca */}
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                     <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-red-50 to-purple-50 rounded-2xl shadow-lg flex items-center justify-center p-8 order-last md:order-first">
                         <span className="text-6xl text-brand-red opacity-70">[Ilustração Tuca IA]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-3"><FaComments className="w-10 h-10 text-brand-red" /></div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-5 leading-tight">Seu Consultor IA Pessoal no WhatsApp</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-6">Assine e tenha o Tuca 24/7 para analisar métricas, criar planos de conteúdo, dar dicas de precificação e muito mais. Tudo na palma da sua mão.</p>
                         <a href="#" className="inline-flex items-center font-semibold text-brand-red hover:underline">
                            Descubra o poder do Tuca <FaArrowRight className="w-3 h-3 ml-1" />
                        </a>
                    </AnimatedSection>
                </div>

                 {/* Item 3: Oportunidades */}
                <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
                    <AnimatedSection delay={0}>
                         <div className="mb-3"><FaStar className="w-10 h-10 text-yellow-500" /></div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-5 leading-tight">Abra Portas para o Mercado</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-6">Sua performance na plataforma te coloca no radar de marcas parceiras buscando criadores para campanhas e sob avaliação de Arthur Marbá para agenciamento exclusivo.</p>
                         <a href="#" className="inline-flex items-center font-semibold text-yellow-600 hover:underline">
                            Como ser notado <FaArrowRight className="w-3 h-3 ml-1" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-yellow-50 to-green-50 rounded-2xl shadow-lg flex items-center justify-center p-8">
                        <span className="text-6xl text-yellow-600 opacity-70">[Ilustração Oportunidades]</span>
                    </AnimatedSection>
                </div>
            </div>
        </section>

        {/* Seção 4: Criado por Quem Entende */}
         <section className="py-20 md:py-28 px-4 bg-brand-light">
             {/* ... (conteúdo da seção Criado por Quem Entende mantido, usando AnimatedSection) ... */}
              <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-12 items-center">
                <AnimatedSection delay={0} className="md:col-span-2">
                     <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-2xl shadow-lg overflow-hidden">
                         {/* ** SUBSTITUA PELA SUA FOTO ** */}
                         <div className="flex items-center justify-center h-full"><span className="text-gray-400">[Foto Arthur Marbá]</span></div>
                     </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1} className="md:col-span-3">
                     <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-6 leading-tight">Criado por Quem Vive o Universo dos Criadores</h2>
                     <p className="text-gray-700 mb-6 leading-relaxed font-light text-lg">
                         O Data2Content nasceu da visão de **Arthur Marbá**, unindo **40 anos de legado em agenciamento** com **expertise profunda em dados e IA** para empoderar criadores como você.
                     </p>
                     <blockquote className="mt-8 pl-6 border-l-4 border-brand-pink italic text-gray-600 font-light text-lg leading-relaxed">
                         "Nossa missão é dar as ferramentas e a estratégia para que criadores independentes alcancem todo seu potencial."
                         <cite className="mt-3 block text-sm font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador</cite>
                     </blockquote>
                </AnimatedSection>
            </div>
         </section>

        {/* Seção 5: CTA Final */}
         <section className="py-20 md:py-28 px-4 bg-brand-dark text-white">
             {/* ... (conteúdo da seção CTA Final mantido, usando AnimatedSection) ... */}
              <div className="max-w-2xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight tracking-tighter">Pronto para Decolar?</h2>
                 </AnimatedSection>
                 <AnimatedSection delay={0.1}>
                    <p className="text-gray-300 mb-10 font-light leading-relaxed text-lg">Faça login gratuito, vire afiliado e comece a transformar sua carreira hoje.</p>
                 </AnimatedSection>
                  {!session ? (
                    <AnimatedSection delay={0.2}>
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            className="shimmer-button inline-flex items-center gap-2 px-10 py-4 bg-brand-pink text-white rounded-full shadow-lg font-bold text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                           <FaGoogle className="w-5 h-5" />
                           Entrar com Google e Virar Afiliado
                        </button>
                    </AnimatedSection>
                    ) : (
                         <AnimatedSection delay={0.2}>
                            <a
                                href="/dashboard"
                                className="shimmer-button inline-block px-10 py-4 bg-brand-pink text-white rounded-full shadow-lg font-bold text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                            >
                                Acessar meu Painel
                            </a>
                        </AnimatedSection>
                    )}
             </div>
         </section>

         {/* Footer */}
         <footer className="text-center py-10 bg-brand-light text-xs text-gray-500 font-light">
             {/* ... (conteúdo do Footer mantido) ... */}
              {/* ** SUBSTITUA PELO SÍMBOLO DO SEU LOGO ** */}
             <div className="mb-4 text-brand-pink text-4xl">[2]</div>
             © {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
             <div className="mt-3 space-x-4">
                 <a href="/politica-privacidade" className="underline hover:text-brand-pink transition-colors">Política de Privacidade</a>
                 <a href="/termos-uso" className="underline hover:text-brand-pink transition-colors">Termos de Uso</a>
             </div>
         </footer>

      </div> {/* Fim div principal */}

      {/* CSS Global */}
      <style jsx global>{`
        /* ... (CSS Shimmer e Pulse mantidos) ... */
        .shimmer-button::before { content: ""; position: absolute; top: 0; left: -150%; width: 50%; height: 100%; background: linear-gradient(120deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%); transform: skewX(-20deg); }
        .shimmer-button:hover::before { animation: shimmer 1.5s infinite; }
        @keyframes shimmer { 0% { left: -150%; } 50% { left: 100%; } 100% { left: 100%; } }
        .scroll-animate { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
        .scroll-animate.is-visible { opacity: 1; transform: translateY(0); }
        @keyframes pulse-slow { 50% { opacity: .7; } }
        .animate-pulse-slow { animation: pulse-slow 5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      `}</style>
    </>
  );
}
