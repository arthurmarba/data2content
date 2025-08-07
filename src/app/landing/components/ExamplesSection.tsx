'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import SectionSubtitle from './SectionSubtitle';
import ScreenshotCarousel from './ScreenshotCarousel';
import exampleScreenshots from '@/data/exampleScreenshots';

export default function ExamplesSection() {
  return (
    <section className="py-10 sm:py-14 bg-gray-50/70">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-8 text-left">
        <AnimatedSection>
          <SectionTitle>Veja Nossa IA em Ação.</SectionTitle>
          <SectionSubtitle>
            Receba alertas, análises e ideias diretamente no seu WhatsApp, de forma clara e objetiva.
          </SectionSubtitle>
        </AnimatedSection>
      </div>
      <ScreenshotCarousel items={exampleScreenshots} />
    </section>
  );
}
