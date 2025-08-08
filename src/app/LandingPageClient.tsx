"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import withViewport from "./landing/components/withViewport";
import ButtonPrimary from "./landing/components/ButtonPrimary";

// Componentes dinâmicos
const HeroSection = dynamic(() => import("./landing/components/HeroSection"));
const ExamplesSection = withViewport(dynamic(() => import("./landing/components/ExamplesSection")));
const CreatorTypesSection = withViewport(dynamic(() => import("./landing/components/CreatorTypesSection")));
const TestimonialsSection = withViewport(dynamic(() => import("./landing/components/TestimonialsSection")));
// const FounderSection = withViewport(dynamic(() => import("./landing/components/FounderSection"))); // Seção removida
const FaqSection = withViewport(dynamic(() => import("./landing/components/FaqSection")));
const CallToAction = withViewport(dynamic(() => import("./landing/components/CallToAction").then((mod) => mod.default)));
const LandingHeader = dynamic<{ showLoginButton?: boolean }>(() => import("./landing/components/LandingHeader"));

export default function LandingPageClient() {
  const [showStickyLogin, setShowStickyLogin] = useState(false);
  
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyLogin(window.scrollY >= window.innerHeight);
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="bg-white text-gray-800 font-sans">
      <LandingHeader showLoginButton />
      <main ref={mainRef} className="scroll-pt-20">
        <HeroSection />
        <ExamplesSection />
        <CreatorTypesSection />
        <TestimonialsSection />
        {/* <FounderSection /> - Seção removida */}
        <FaqSection />
        <CallToAction />
        {showStickyLogin && (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 bg-gray-100/80 backdrop-blur-md shadow-md animate-fade-in-up md:hidden">
            <ButtonPrimary href="/login" rel="nofollow">
              Ative IA do Instagram no WhatsApp
            </ButtonPrimary>
          </div>
        )}
      </main>
      <footer className="text-center py-8 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 border-t">
        <div className="mb-4 text-brand-dark font-bold text-2xl flex justify-center items-center gap-2">
          <span className="text-brand-pink">[2]</span>data2content
        </div>
        <p className="text-sm text-gray-500 mb-4">
          © {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <Link href="/politica-de-privacidade" className="text-gray-600 hover:text-brand-pink transition-colors">
            Política de Privacidade
          </Link>
          <Link href="/termos-e-condicoes" className="text-gray-600 hover:text-brand-pink transition-colors">
            Termos e Condições
          </Link>
        </div>
      </footer>
       <style jsx global>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
