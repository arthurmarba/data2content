'use client';
import AnimatedSection from './AnimatedSection';
import SectionTitle from './SectionTitle';
import faqItems from '@/data/faq';
import { FaQuestionCircle } from 'react-icons/fa';

export default function FaqSection() {
  return (
    <section id="faq" className="py-10 sm:py-14 bg-white">
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
                  dangerouslySetInnerHTML={{
                    __html: item.a
                      .replace(/\n\n\*/g, '<br /><br />&#8226; ')
                      .replace(/\n\*/g, '<br />&#8226; ')
                      .replace(/\n/g, '<br />'),
                  }}
                />
              </details>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
