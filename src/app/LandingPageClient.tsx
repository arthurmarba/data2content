"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";

const HeroSection = dynamic(() => import("./landing/components/HeroSection"));
const LandingHeader = dynamic<{ showLoginButton?: boolean }>(() =>
  import("./landing/components/LandingHeader")
);

export default function LandingPageClient() {
  const headerWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;

    const findHeader = () =>
      (headerWrapRef.current?.querySelector("header") ??
        document.querySelector("header")) as HTMLElement | null;

    const apply = () => {
      const header = findHeader();
      const h = header?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };

    // aplica na carga e observa mudanças de tamanho do header
    apply();
    const hdr = findHeader();
    let ro: ResizeObserver | null = null;
    if (hdr) {
      ro = new ResizeObserver(apply);
      ro.observe(hdr);
    }

    // re-aplica ao finalizar o carregamento (fonts/imagens podem alterar a altura)
    window.addEventListener("load", apply);

    return () => {
      window.removeEventListener("load", apply);
      ro?.disconnect();
    };
  }, []);

  return (
    <div className="bg-white text-gray-800 font-sans">
      {/* Header fixo/fora do fluxo */}
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton />
      </div>

      {/* Spacer que ocupa exatamente a altura do header */}
      <div aria-hidden className="h-[var(--landing-header-h,4.5rem)]" />

      {/* Conteúdo com scroll-padding para navegação por âncora sem ficar sob o header */}
      <main
        className="bg-white"
        style={{
          scrollPaddingTop: "var(--landing-header-h, 4.5rem)",
        }}
      >
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
        </div>
        <p className="text-sm text-gray-500 mb-4">
          © {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <Link
            href="/politica-de-privacidade"
            className="text-gray-600 hover:text-brand-pink transition-colors"
          >
            Política de Privacidade
          </Link>
          <Link
            href="/termos-e-condicoes"
            className="text-gray-600 hover:text-brand-pink transition-colors"
          >
            Termos e Condições
          </Link>
        </div>
      </footer>
    </div>
  );
}
