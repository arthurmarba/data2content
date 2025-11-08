'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import SectionSubtitle from './SectionSubtitle';
import ScreenshotCarousel from './ScreenshotCarousel';
import exampleScreenshots from '@/data/exampleScreenshots';

export default function ExamplesSection() {
  return (
    <section className="landing-section landing-section--muted landing-section--compact-top">
      <div className="landing-section__inner landing-section__inner--wide">
        <AnimatedSection>
          <SectionTitle>Conheça nossa IA</SectionTitle>
          <SectionSubtitle>
            Receba alertas, análises e ideias diretamente no seu WhatsApp.
          </SectionSubtitle>
        </AnimatedSection>
      </div>
      <ScreenshotCarousel items={exampleScreenshots} />
    </section>
  );
}
