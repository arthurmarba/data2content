'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import SectionSubtitle from './SectionSubtitle';
import TestimonialCard from './TestimonialCard';
import testimonials from '@/data/testimonials';
import Container from '../../components/Container';

export default function TestimonialsSection() {
  return (
    <section className="py-10 sm:py-14 bg-gray-50/70">
      <Container className="text-left">
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
  );
}
