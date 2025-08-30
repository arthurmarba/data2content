"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";

// Componentes dinâmicos usados
const HeroSection = dynamic(() => import("./landing/components/HeroSection"));
const LandingHeader = dynamic<{ showLoginButton?: boolean }>(() => import("./landing/components/LandingHeader"));

export default function LandingPageClient() {
  return (
    <div className="bg-white text-gray-800 font-sans">
      <LandingHeader showLoginButton />
      <main className="scroll-pt-20">
        <HeroSection />
      </main>
      <footer className="text-center py-8 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 border-t">
        <div className="mb-4 text-brand-dark font-bold text-2xl flex justify-center items-center gap-2">
          <div className="relative h-6 w-6 overflow-hidden">
            <Image
              src="/images/Colorido-Simbolo.png"
              alt="Data2Content"
              fill
              className="object-contain object-center scale-[2.4]"
              priority
            />
          </div>
          <span>data2content</span>
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
