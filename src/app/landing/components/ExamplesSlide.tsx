'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollCue } from './ScrollCue';
import ScreenshotCarousel from './ScreenshotCarousel';

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
      className="relative h-screen flex flex-col items-center justify-center bg-purple-600 text-white"
      id="examples"
    >
      <h2 className="text-3xl font-bold mb-4">Exemplos</h2>
      <p>Veja como nosso produto pode ajudar você.</p>
      <div className="mt-8 w-full">
        <ScreenshotCarousel items={screenshots} />
      </div>
      <ScrollCue targetId="features" direction="up" />
    </motion.section>
  );
}

