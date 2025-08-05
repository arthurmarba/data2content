'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollCue } from './ScrollCue';
import ScreenshotCarousel from './ScreenshotCarousel';
import Container from '../../components/Container';

interface ScreenshotItem {
  title: string;
  imageUrl: string;
  description: string;
}

interface ExamplesSlideProps {
  screenshots: ScreenshotItem[];
}

export function ExamplesSlide({ screenshots }: ExamplesSlideProps) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.3], [100, 0]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className="relative min-h-screen flex flex-col items-center justify-center bg-brand-light text-brand-dark py-20"
      id="examples"
    >
      <Container className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Exemplos</h2>
        <p className="text-lg">Veja como nosso produto pode ajudar você.</p>
        <div className="mt-8 w-full">
          <ScreenshotCarousel items={screenshots} />
        </div>
      </Container>
      <ScrollCue targetId="features" direction="up" />
    </motion.section>
  );
}

