'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollCue } from './ScrollCue';
import Container from '../../components/Container';

export function FeaturesSlide() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.3], [100, 0]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-brand-pink to-brand-red text-brand-dark py-20"
      id="features"
    >
      <Container className="text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">Recursos</h2>
        <ul className="space-y-2">
          <li>Recurso 1</li>
          <li>Recurso 2</li>
          <li>Recurso 3</li>
        </ul>
      </Container>
      <ScrollCue targetId="examples" />
      <ScrollCue targetId="intro" direction="up" />
    </motion.section>
  );
}

