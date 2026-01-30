'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import FounderVideo from './FounderVideo';

export default function FounderSection() {
  return (
    <section id="arthur-marba" className="py-10 sm:py-14 bg-white">
      <div className="max-w-screen-md mx-auto px-6 text-left">
        <AnimatedSection>
          <SectionTitle className="text-3xl">Conheça o Fundador da data2content</SectionTitle>
          <p className="mt-5 text-lg text-gray-600 leading-relaxed">
            Arthur Marbá, Fundador da data2content, une 10 anos de marketing digital para criadores a uma herança familiar de 40 anos na gestão de talentos. Ele percebeu que criadores precisam de um especialista para traduzir dados em direcionamento estratégico. O Mobi é a personificação dessa filosofia.
          </p>
          <blockquote className="mt-5 pl-5 border-l-4 border-brand-pink italic text-gray-700 text-lg">
            &quot;Democratizamos a consultoria estratégica, tornando-a acessível, proativa e capaz de evoluir com cada criador, tudo via WhatsApp.&quot;
            <cite className="mt-4 block text-base font-semibold text-brand-dark not-italic">- Arthur Marbá, Fundador</cite>
          </blockquote>
        </AnimatedSection>
        <AnimatedSection delay={0.1}>
          <FounderVideo videoId="dQw4w9WgXcQ" />
        </AnimatedSection>
      </div>
    </section>
  );
}
