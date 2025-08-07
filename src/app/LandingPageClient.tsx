"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import withViewport from "./landing/components/withViewport";
import ButtonPrimary from "./landing/components/ButtonPrimary";

const HeroSection = dynamic(() => import("./landing/components/HeroSection"));
const ExamplesSection = withViewport(dynamic(() => import("./landing/components/ExamplesSection")));
const CreatorTypesSection = withViewport(dynamic(() => import("./landing/components/CreatorTypesSection")));
const TestimonialsSection = withViewport(dynamic(() => import("./landing/components/TestimonialsSection")));
const FounderSection = withViewport(dynamic(() => import("./landing/components/FounderSection")));
const FaqSection = withViewport(dynamic(() => import("./landing/components/FaqSection")));
const CallToAction = withViewport(dynamic(() => import("./landing/components/CallToAction").then((mod) => mod.default)));
const LandingHeader = dynamic<{ showLoginButton?: boolean }>(() => import("./landing/components/LandingHeader"));

export default function LandingPageClient() {
  const [showStickyLogin, setShowStickyLogin] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const handleScroll = () => {
      setShowStickyLogin(el.scrollTop >= window.innerHeight);
    };
    el.addEventListener("scroll", handleScroll);
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [mainRef]);

  return (
    <div className="bg-white text-gray-800 font-sans">
      <LandingHeader showLoginButton />
      <main ref={mainRef} className="snap-y snap-mandatory overflow-y-scroll h-screen scroll-pt-20">
        <HeroSection />
        <ExamplesSection />
        <CreatorTypesSection />
        <TestimonialsSection />
        <FounderSection />
        <FaqSection />
        <CallToAction />
        {showStickyLogin && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/80 backdrop-blur-md shadow-md">
            <ButtonPrimary href="/login" rel="nofollow">
              Ative sua IA do Instagram no WhatsApp
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
    </div>
  );
}
