"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import withViewport from "./landing/components/withViewport";
import { FaStar } from "react-icons/fa";
import { FaQuestionCircle } from "react-icons/fa";
import testimonials from "@/data/testimonials";
import faqItems from "@/data/faq";
import { landingJsonLd } from "@/seo/landing";
import { IntroSlide } from "./landing/components/IntroSlide";
import { FeaturesSlide } from "./landing/components/FeaturesSlide";
import { ExamplesSlide } from "./landing/components/ExamplesSlide";
import Container from "./components/Container";
import LegacyHero from "./landing/components/LegacyHero";

const AnimatedSection = withViewport(
  dynamic(() => import("./landing/components/AnimatedSection"), { ssr: false })
);
const LandingHeader = dynamic(
  () => import("./landing/components/LandingHeader"),
  { ssr: false }
) as React.ComponentType<{ showLoginButton?: boolean }>;
const FounderVideo = withViewport(
  dynamic(() => import("./landing/components/FounderVideo"), { ssr: false })
);
const CallToAction = withViewport(
  dynamic(() => import("./landing/components/CallToAction"), { ssr: false })
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

export default function FinalCompleteLandingPage() {
  const videoId = "dQw4w9WgXcQ";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd) }}
      />

      <div className="bg-white text-gray-800 font-sans">
        <LandingHeader showLoginButton />
        <main className="snap-y snap-mandatory overflow-y-scroll h-screen scroll-pt-20">
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

          <section id="arthur-marba" className="snap-start py-10 sm:py-14 bg-white">
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
                <FounderVideo videoId={videoId} />
              </AnimatedSection>
            </div>
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

      <style jsx global>{`
        html {
          font-family: 'Inter', sans-serif;
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
  );
}

