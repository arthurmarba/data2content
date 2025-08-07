'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import SectionSubtitle from './SectionSubtitle';
import CreatorTypeCard from './CreatorTypeCard';
import creatorTypes from '@/data/creatorTypes';

export default function CreatorTypesSection() {
  return (
    <section className="py-10 sm:py-14 bg-white">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
        <AnimatedSection>
          <SectionTitle>Feito para todos os tipos de criadores.</SectionTitle>
          <SectionSubtitle>
            Se você cria conteúdo, a data2content trabalha para você. Nossa IA se adapta ao seu histórico de conteúdo, nicho e objetivos.
          </SectionSubtitle>
        </AnimatedSection>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {creatorTypes.map((creator, index) => (
            <AnimatedSection delay={0.1 * (index + 1)} key={creator.title}>
              <CreatorTypeCard {...creator} />
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
