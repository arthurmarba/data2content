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
  hidden: { opacity: 0, y: 25 }, // Ligeiramente mais sutil
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7, // Duração ligeiramente ajustada
      ease: "easeOut"
    }
  }
};

// Componente auxiliar para aplicar animação de scroll
const AnimatedSection = ({ children, delay = 0, className = "", once = true, amount = 0.1 }: { children: React.ReactNode, delay?: number, className?: string, once?: boolean, amount?: number }) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: amount, // Reduzido para iniciar um pouco antes
  });

  useEffect(() => {
    if (inView) {
      controls.start(i => ({
        ...fadeInUp.visible,
        transition: { ...fadeInUp.visible.transition, delay: i * 0.12 } // Delay ligeiramente ajustado
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

  // --- Início do Retorno JSX ---
  return (
    <>
      <Head>
        <title>Data2Content: Sua Carreira de Criador Decola Aqui</title>
        <meta
          name="description"
          content="Plataforma com IA e expertise em agenciamento para criadores gerenciarem carreira, ganharem como afiliados e acessarem oportunidades com marcas."
        />
        {/* Manter link Poppins se não estiver globalmente no layout */}
        {/* <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        /> */}
      </Head>

      {/* Estrutura principal */}
      {/* Adicionado font-sans aqui caso não esteja no body global */}
      <div className="bg-white text-brand-dark font-sans">

        {/* Header Fixo */}
        <header className="fixed top-0 left-0 w-full py-3 px-4 md:px-6 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
             <div className="max-w-7xl mx-auto flex justify-between items-center h-10 md:h-12"> {/* Altura definida */}
                <span className="font-bold text-xl text-brand-dark">Data2Content</span>
                {!session ? (
                     <button
                        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                        // Padding ajustado
                        className="px-4 py-1.5 md:px-5 md:py-2 text-xs md:text-sm font-medium text-brand-dark border border-gray-300 rounded-full hover:bg-gray-100 transition-default"
                    >
                        Entrar
                    </button>
                ) : (
                     <a
                        href="/dashboard"
                         // Padding ajustado
                        className="px-4 py-1.5 md:px-5 md:py-2 text-xs md:text-sm font-medium text-white bg-brand-pink rounded-full hover:opacity-90 transition-default"
                    >
                        Meu Painel
                    </a>
                )}
            </div>
        </header>

        {/* Seção 1: Hero */}
        {/* Padding top/bottom ajustados */}
        <section className="relative flex flex-col items-center justify-center text-center px-4 min-h-screen pt-28 pb-16 md:pt-36 md:pb-24 bg-brand-light overflow-hidden">
             {/* Elementos gráficos mantidos */}
             <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-pink/5 rounded-full filter blur-3xl opacity-70 animate-pulse-slow"></div>
            <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-brand-red/5 rounded-full filter blur-3xl opacity-70 animate-pulse-slow animation-delay-2000"></div>

            <div className="relative z-10 max-w-4xl mx-auto">
                {/* Espaçamentos entre elementos do Hero ajustados */}
                <AnimatedSection delay={0} className="mb-5"> {/* Reduzido mb */}
                    <span className="inline-block px-4 py-1.5 bg-white border border-gray-200 text-brand-pink text-sm font-semibold rounded-full shadow-sm">
                        IA + Expertise em Agenciamento
                    </span>
                </AnimatedSection>
                <AnimatedSection delay={0.1}>
                    {/* Line height e margin bottom ajustados */}
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold text-brand-dark mb-6 leading-[1.1] tracking-tighter">
                         Sua Carreira de Criador Decola Aqui.
                    </h1>
                </AnimatedSection>
                <AnimatedSection delay={0.2}>
                     {/* Line height e margin bottom ajustados */}
                    <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto font-light leading-relaxed md:leading-loose">
                        A plataforma Data2Content une consultoria estratégica com IA via WhatsApp, gestão de carreira com 40 anos de expertise e <strong className="font-semibold text-brand-pink">oportunidades reais</strong> com marcas e nosso programa de afiliados.
                    </p>
                </AnimatedSection>
                <AnimatedSection delay={0.3}>
                    {!session ? (
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                             // Padding e tamanho de texto ajustados
                            className="shimmer-button inline-flex items-center gap-2.5 px-8 py-3.5 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                            <FaGoogle className="w-5 h-5" />
                            Entrar com Google e Virar Afiliado
                        </button>
                     ) : (
                         <a
                            href="/dashboard"
                            // Padding e tamanho de texto ajustados
                            className="shimmer-button inline-block px-8 py-3.5 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                         >
                            Acessar meu Painel
                         </a>
                     )}
                    {/* Margin top ajustada */}
                    <p className="text-sm text-gray-500 mt-5 font-light">
                        Login gratuito para acesso imediato ao programa de afiliados.
                    </p>
                </AnimatedSection>
            </div>
             {/* Margin top e padding do container do vídeo ajustados */}
            <AnimatedSection delay={0.4} className="mt-16 md:mt-20 w-full max-w-5xl mx-auto">
                 <div className="aspect-video bg-gradient-to-br from-brand-dark to-gray-800 border border-gray-700 rounded-2xl shadow-2xl flex items-center justify-center overflow-hidden p-6">
                     <span className="text-gray-400 text-lg font-light">[Visual Impactante: Demonstração do Tuca em Ação]</span>
                 </div>
            </AnimatedSection>
        </section>

        {/* Seção 2: Prova Social (Depoimentos com Fotos) */}
         {/* Padding vertical ajustado */}
        <section className="py-16 md:py-24 px-4 bg-white">
              <div className="max-w-5xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                     {/* Margins ajustadas */}
                    <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4">Aprovado por Criadores como Você</h2>
                    <p className="text-gray-600 mb-12 md:mb-16 max-w-xl mx-auto font-light leading-relaxed">Veja o que dizem sobre a transformação Data2Content:</p>
                 </AnimatedSection>
                  {/* Gap do grid ajustado */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                     {/* Depoimento 1 */}
                      {/* Padding e gap internos ajustados */}
                     <AnimatedSection delay={0.1} className="bg-brand-light p-6 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-5">
                         <Image src="/placeholder-avatar.jpg" alt="Nome do Criador 1" width={72} height={72} className="rounded-full flex-shrink-0 border-4 border-white shadow-md"/> {/* Tamanho ajustado */}
                         <div>
                            {/* Margin e line height ajustados */}
                            <p className="text-brand-dark italic mb-3 font-light leading-relaxed">"[Depoimento focado em resultado: Ex: O Tuca me deu o plano que me fez fechar minha primeira publi grande!]"</p>
                            <p className="font-semibold text-sm text-brand-dark">- Nome do Criador 1</p>
                            <p className="text-xs text-brand-pink font-medium">Criador de Conteúdo - Nicho</p>
                         </div>
                     </AnimatedSection>
                      {/* Depoimento 2 */}
                     <AnimatedSection delay={0.2} className="bg-brand-light p-6 rounded-2xl shadow-lg text-left flex flex-col items-center sm:flex-row sm:items-start sm:text-left gap-5">
                          <Image src="/placeholder-avatar-2.jpg" alt="Nome do Criador 2" width={72} height={72} className="rounded-full flex-shrink-0 border-4 border-white shadow-md"/>
                         <div>
                            <p className="text-brand-dark italic mb-3 font-light leading-relaxed">"[Depoimento focado em afiliação/oportunidade: Ex: Virei afiliado e já paguei minha assinatura só com as comissões!]"</p>
                            <p className="font-semibold text-sm text-brand-dark">- Nome do Criador 2</p>
                            <p className="text-xs text-brand-pink font-medium">Afiliado e Criador - Nicho</p>
                         </div>
                     </AnimatedSection>
                 </div>
            </div>
        </section>

        {/* Seção 3: Benefícios Chave (Layout Alternado) */}
         {/* Padding vertical e espaçamento entre itens ajustados */}
        <section className="py-16 md:py-24 px-4 bg-white overflow-hidden">
              <div className="max-w-6xl mx-auto space-y-16 md:space-y-20"> {/* Reduzido space-y */}
                {/* Item 1: Afiliação */}
                 {/* Gap ajustado */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                    <AnimatedSection delay={0}>
                         {/* Margins ajustadas */}
                        <div className="mb-2"><FaDollarSign className="w-9 h-9 text-brand-pink" /></div> {/* Ícone menor */}
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4 leading-tight">Ganhe Como Afiliado Desde o Dia 1</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-5">Faça login gratuito e receba seu link exclusivo. Indique o Tuca e ganhe 10% de comissão recorrente. Simples assim.</p>
                        <a href="#" className="inline-flex items-center font-semibold text-brand-pink hover:underline text-sm"> {/* Tamanho texto link */}
                            Saiba mais sobre a afiliação <FaArrowRight className="w-3 h-3 ml-1.5" /> {/* Ajustado ml */}
                        </a>
                    </AnimatedSection>
                     {/* Padding e arredondamento ajustados */}
                    <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-pink-50 to-red-50 rounded-3xl shadow-lg flex items-center justify-center p-6">
                        <span className="text-5xl text-brand-pink opacity-70">[Ilustração Afiliação]</span>
                    </AnimatedSection>
                </div>

                {/* Item 2: Consultor Tuca */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                     <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-red-50 to-purple-50 rounded-3xl shadow-lg flex items-center justify-center p-6 order-last md:order-first">
                         <span className="text-5xl text-brand-red opacity-70">[Ilustração Tuca IA]</span>
                    </AnimatedSection>
                    <AnimatedSection delay={0} className="order-first md:order-last">
                         <div className="mb-2"><FaComments className="w-9 h-9 text-brand-red" /></div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4 leading-tight">Seu Consultor IA Pessoal no WhatsApp</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-5">Assine e tenha o Tuca 24/7 para analisar métricas, criar planos de conteúdo, dar dicas de precificação e muito mais. Tudo na palma da sua mão.</p>
                         <a href="#" className="inline-flex items-center font-semibold text-brand-red hover:underline text-sm">
                            Descubra o poder do Tuca <FaArrowRight className="w-3 h-3 ml-1.5" />
                        </a>
                    </AnimatedSection>
                </div>

                 {/* Item 3: Oportunidades */}
                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
                    <AnimatedSection delay={0}>
                         <div className="mb-2"><FaStar className="w-9 h-9 text-yellow-500" /></div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4 leading-tight">Abra Portas para o Mercado</h2>
                        <p className="text-gray-600 font-light leading-relaxed mb-5">Sua performance na plataforma te coloca no radar de marcas parceiras buscando criadores para campanhas e sob avaliação de Arthur Marbá para agenciamento exclusivo.</p>
                         <a href="#" className="inline-flex items-center font-semibold text-yellow-600 hover:underline text-sm">
                            Como ser notado <FaArrowRight className="w-3 h-3 ml-1.5" />
                        </a>
                    </AnimatedSection>
                    <AnimatedSection delay={0.1} className="aspect-square bg-gradient-to-br from-yellow-50 to-green-50 rounded-3xl shadow-lg flex items-center justify-center p-6">
                        <span className="text-5xl text-yellow-600 opacity-70">[Ilustração Oportunidades]</span>
                    </AnimatedSection>
                </div>
            </div>
        </section>

        {/* Seção 4: Criado por Quem Entende */}
          {/* Padding vertical ajustado */}
         <section className="py-16 md:py-24 px-4 bg-brand-light">
               {/* Gap ajustado */}
              <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-8 md:gap-10 items-center">
                <AnimatedSection delay={0} className="md:col-span-2">
                     {/* Arredondamento ajustado */}
                     <div className="aspect-w-1 aspect-h-1 bg-gray-200 rounded-3xl shadow-lg overflow-hidden">
                         <div className="flex items-center justify-center h-full"><span className="text-gray-400">[Foto Arthur Marbá]</span></div>
                     </div>
                </AnimatedSection>
                <AnimatedSection delay={0.1} className="md:col-span-3">
                     {/* Margins e tamanho de texto ajustados */}
                     <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-5 leading-tight">Criado por Quem Vive o Universo dos Criadores</h2>
                     <p className="text-gray-700 mb-5 leading-relaxed font-light text-lg">
                         O Data2Content nasceu da visão de **Arthur Marbá**, unindo **40 anos de legado em agenciamento** com **expertise profunda em dados e IA** para empoderar criadores como você.
                     </p>
                     {/* Margin top e line height ajustados */}
                     <blockquote className="mt-6 pl-5 border-l-4 border-brand-pink italic text-gray-600 font-light text-lg leading-relaxed">
                         "Nossa missão é dar as ferramentas e a estratégia para que criadores independentes alcancem todo seu potencial."
                          {/* Margin top e tamanho de texto ajustados */}
                         <cite className="mt-2.5 block text-sm font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador</cite>
                     </blockquote>
                </AnimatedSection>
            </div>
         </section>

        {/* Seção 5: CTA Final */}
          {/* Padding vertical e espaçamentos internos ajustados */}
         <section className="py-16 md:py-24 px-4 bg-brand-dark text-white">
              <div className="max-w-2xl mx-auto text-center">
                 <AnimatedSection delay={0}>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-tight tracking-tighter">Pronto para Decolar?</h2>
                 </AnimatedSection>
                 <AnimatedSection delay={0.1}>
                    <p className="text-gray-300 mb-8 font-light leading-relaxed text-lg">Faça login gratuito, vire afiliado e comece a transformar sua carreira hoje.</p>
                 </AnimatedSection>
                  {!session ? (
                    <AnimatedSection delay={0.2}>
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            // Padding e texto ajustados
                            className="shimmer-button inline-flex items-center gap-2.5 px-8 py-3.5 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                        >
                           <FaGoogle className="w-5 h-5" />
                           Entrar com Google e Virar Afiliado
                        </button>
                    </AnimatedSection>
                    ) : (
                         <AnimatedSection delay={0.2}>
                            <a
                                href="/dashboard"
                                // Padding e texto ajustados
                                className="shimmer-button inline-block px-8 py-3.5 md:px-10 md:py-4 bg-brand-pink text-white rounded-full shadow-lg font-semibold text-base md:text-lg hover:opacity-90 transition-default transform hover:scale-105 relative overflow-hidden"
                            >
                                Acessar meu Painel
                            </a>
                        </AnimatedSection>
                    )}
             </div>
         </section>

         {/* Footer */}
          {/* Padding vertical e espaçamentos internos ajustados */}
         <footer className="text-center py-8 bg-brand-light text-xs text-gray-500 font-light">
             <div className="mb-3 text-brand-pink text-3xl">[2]</div> {/* Logo e mb ajustados */}
             © {new Date().getFullYear()} Data2Content. Todos os direitos reservados.
             <div className="mt-2.5 space-x-4"> {/* mt e space-x ajustados */}
                 <a href="/politica-privacidade" className="underline hover:text-brand-pink transition-colors">Política de Privacidade</a>
                 <a href="/termos-uso" className="underline hover:text-brand-pink transition-colors">Termos de Uso</a>
             </div>
         </footer>

      </div> {/* Fim div principal */}

      {/* CSS Global (Mantido) */}
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
