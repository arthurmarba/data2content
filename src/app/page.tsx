"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import withViewport from "./landing/components/withViewport";
import { FaStar } from "react-icons/fa";
import { FaQuestionCircle } from "react-icons/fa";
import testimonials from "@/data/testimonials";
import faqItems from "@/data/faq";
import {
  landingJsonLd,
  landingProductJsonLd,
  landingMetadata,
  landingFaqJsonLd,
  landingOrganizationJsonLd,
} from "@/seo/landing";
import Container from "./components/Container";
import ButtonPrimary from "./landing/components/ButtonPrimary";
const LegacyHero = dynamic(() => import("./landing/components/LegacyHero"));
const IntroSlide = withViewport(
  dynamic(() => import("./landing/components/IntroSlide"))
);
const FeaturesSlide = withViewport(
  dynamic(() => import("./landing/components/FeaturesSlide"))
);
const ExamplesSlide = withViewport(
  dynamic(() => import("./landing/components/ExamplesSlide"))
);

const AnimatedSection = withViewport(
  dynamic(() => import("./landing/components/AnimatedSection"))
);
const LandingHeader = dynamic(
  () => import("./landing/components/LandingHeader")
) as React.ComponentType<{ showLoginButton?: boolean }>;
const CallToAction = withViewport(
  dynamic(() => import("./landing/components/CallToAction"))
);

const SectionTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-4xl md:text-5xl font-bold tracking-tight text-brand-dark ${className}`}>{children}</h2>
);

const SectionSubtitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`mt-4 text-lg md:text-xl text-gray-600 max-w-3xl leading-relaxed ${className}`}>{children}</p>
);

const TestimonialCard = ({ name, handle, quote, avatarUrl }: { name: string; handle: string; quote: string; avatarUrl: string }) => (
  <div className="bg-white p-6 rounded-xl h-full shadow-lg flex flex-col">
    <div className="flex text-yellow-400 gap-1 mb-4">{[...Array(5)].map((_, i) => <FaStar key={i} />)}</div>
    <p className="text-gray-700 italic text-sm flex-grow">"{quote}"</p>
    <div className="flex items-center mt-4">
      <div className="relative w-10 h-10 rounded-full overflow-hidden">
        <Image src={avatarUrl} alt={`Avatar de ${name}`} fill className="object-cover" />
      </div>
      <div className="ml-4">
        <p className="font-semibold text-brand-dark text-sm">{name}</p>
        <p className="text-xs text-gray-500">{handle}</p>
      </div>
    </div>
  </div>
);

const exampleScreenshots = [
  {
    title: "Análises no WhatsApp",
    imageUrl: "/images/tuca-analise-whatsapp.png",
    description: "Receba insights do Mobi diretamente pelo WhatsApp para agir rapidamente.",
  },
  {
    title: "Nova análise",
    imageUrl: "/images/tuca-nova-analise.png",
    description: "Descubra oportunidades de conteúdo com base nos dados mais recentes.",
  },
  {
    title: "Comunidade Tuca",
    imageUrl: "/images/Tuca-comunidade.png",
    description: "Aprenda com outros criadores e compartilhe experiências na comunidade.",
  },
];

export const metadata = landingMetadata;

export default function FinalCompleteLandingPage() {
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            landingJsonLd,
            landingProductJsonLd,
            landingFaqJsonLd,
            landingOrganizationJsonLd,
          ]),
        }}
      />

      <div className="bg-white text-gray-800 font-sans">
        <LandingHeader showLoginButton />
        <main ref={mainRef} className="snap-y snap-mandatory overflow-y-scroll h-screen scroll-pt-20">
          <LegacyHero />
          <IntroSlide />
          <FeaturesSlide />
          <ExamplesSlide screenshots={exampleScreenshots} />

          <section className="snap-start bg-gray-50/70">
            <Container padding="py-10 sm:py-14" className="lg:px-8 text-left">
              <AnimatedSection>
                <SectionTitle>Resultados que falam por si.</SectionTitle>
                <SectionSubtitle>
                  Criadores como você já estão economizando tempo e crescendo com mais estratégia.
                </SectionSubtitle>
              </AnimatedSection>
              <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                  <AnimatedSection delay={0.1 * (index + 1)} key={testimonial.name}>
                    <TestimonialCard {...testimonial} />
                  </AnimatedSection>
                ))}
              </div>
            </Container>
          </section>

          <section id="faq" className="snap-start py-10 sm:py-14 bg-white">
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
                      <div
                        className="text-gray-700 mt-4 text-base font-light leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: item.a.replace(/\n\n\*/g, '<br /><br />&#8226; ').replace(/\n\*/g, '<br />&#8226; ').replace(/\n/g, '<br />') }}
                      />
                    </details>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </section>

          <CallToAction />
          {showStickyLogin && (
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white/80 backdrop-blur-md shadow-md">
              <ButtonPrimary href="/login" rel="nofollow">Ative sua IA do Instagram no WhatsApp</ButtonPrimary>
            </div>
          )}
        </main>

        <footer className="text-center py-8 bg-gradient-to-b from-white via-brand-pink/5 to-gray-50 border-t">
          <div className="mb-4 text-brand-dark font-bold text-2xl flex justify-center items-center gap-2"><span className="text-brand-pink">[2]</span>data2content</div>
          <p className="text-sm text-gray-500 mb-4">© {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.</p>
          <div className="flex justify-center gap-6 text-sm">
            <Link href="/politica-de-privacidade" className="text-gray-600 hover:text-brand-pink transition-colors">Política de Privacidade</Link>
            <Link href="/termos-e-condicoes" className="text-gray-600 hover:text-brand-pink transition-colors">Termos e Condições</Link>
          </div>
        </footer>
      </div>

    </>
  );
}

