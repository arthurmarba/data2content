import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { FaChalkboardTeacher, FaBullhorn, FaStar, FaQuestionCircle } from "react-icons/fa";
import testimonials from "@/data/testimonials";
import faqItems from "@/data/faq";
import { landingMetadata, landingJsonLd } from "@/seo/landing";

const AnimatedSection = dynamic(() => import("./landing/components/AnimatedSection"), { ssr: false });
const LandingHeader = dynamic(() => import("./landing/components/LandingHeader"), { ssr: false });
const HeroSection = dynamic(() => import("./landing/components/HeroSection"), { ssr: false });
const ScreenshotCarousel = dynamic(() => import("./landing/components/ScreenshotCarousel"), { ssr: false });
const FounderVideo = dynamic(() => import("./landing/components/FounderVideo"), { ssr: false });
const CallToAction = dynamic(() => import("./landing/components/CallToAction"), { ssr: false });

const exampleScreenshots = [
  { title: "(1) Alerta Diário Recebido", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.20.png" },
  { title: "(2) Análise de Conteúdo", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.20 (1).png" },
  { title: "(3) Sugestão Estratégica", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21.png" },
  { title: "(4) Ideia de Conteúdo", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (1).png" },
  { title: "(5) Usuário Tira Dúvidas", imageUrl: "/images/WhatsApp Image 2025-07-07 at 14.00.21 (2).png" }
];

const creatorTypes = [
  {
    icon: FaChalkboardTeacher,
    title: "Especialistas e Coaches",
    description: "Transforme seu conhecimento em conteúdo de alto valor que educa e converte."
  },
  {
    icon: FaBullhorn,
    title: "Influenciadores e Atores",
    description: "Entenda sua audiência para aumentar o engajamento e fechar mais publicidades."
  },
  {
    icon: FaStar,
    title: "Marcas e Empreendedores",
    description: "Use seu Instagram como uma ferramenta de negócios poderosa, com estratégia baseada em dados."
  }
];

const SectionTitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-4xl md:text-5xl font-bold tracking-tight text-brand-dark ${className}`}>{children}</h2>
);

const SectionSubtitle = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <p className={`mt-4 text-lg md:text-xl text-gray-600 max-w-3xl leading-relaxed ${className}`}>{children}</p>
);

const PillarCard = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div className="group relative h-full rounded-2xl bg-gradient-to-br from-white to-gray-50 p-6 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
    <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-200/50 to-purple-200/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    <div className="relative">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-pink/10 text-2xl text-brand-pink shadow-inner shadow-pink-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-pink group-hover:text-white">
        <Icon />
      </div>
      <h3 className="text-lg font-semibold text-brand-dark">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{children}</p>
    </div>
  </div>
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

export const metadata = landingMetadata;

export default function FinalCompleteLandingPage() {
  const videoId = "dQw4w9WgXcQ";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd) }}
      />

      <div className="bg-white text-gray-800 font-sans">
        <LandingHeader />
        <main className="snap-y snap-mandatory overflow-y-scroll h-screen scroll-pt-20">
          <HeroSection />

          <section className="snap-start py-10 sm:py-14 bg-gray-50/70">
            <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
              <AnimatedSection>
                <SectionTitle>Veja Nossa IA em Ação.</SectionTitle>
                <SectionSubtitle>Receba alertas, análises e ideias diretamente no seu WhatsApp, de forma clara e objetiva.</SectionSubtitle>
              </AnimatedSection>
            </div>
            <ScreenshotCarousel items={exampleScreenshots} />
          </section>

          <section id="features" className="snap-start py-10 sm:py-14 bg-white">
            <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
              <AnimatedSection>
                <SectionTitle>Feito para todos os tipos de criadores.</SectionTitle>
                <SectionSubtitle>Se você cria conteúdo, a data2content trabalha para você. Nossa IA se adapta ao seu histórico de conteúdo, nicho e objetivos.</SectionSubtitle>
              </AnimatedSection>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {creatorTypes.map((creator, index) => (
                  <AnimatedSection delay={0.1 * (index + 1)} key={creator.title}>
                    <PillarCard icon={creator.icon} title={creator.title}>
                      {creator.description}
                    </PillarCard>
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </section>

          <section className="snap-start py-10 sm:py-14 bg-gray-50/70">
            <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
              <AnimatedSection>
                <SectionTitle>Resultados que falam por si.</SectionTitle>
                <SectionSubtitle>Criadores como você já estão economizando tempo e crescendo com mais estratégia.</SectionSubtitle>
              </AnimatedSection>
              <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                  <AnimatedSection delay={0.1 * (index + 1)} key={testimonial.name}>
                    <TestimonialCard {...testimonial} />
                  </AnimatedSection>
                ))}
              </div>
            </div>
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
        :root {
          --brand-pink: #FF85C0;
          --brand-red: #FF6B6B;
          --brand-dark: #111827;
        }
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

