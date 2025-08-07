'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollCue } from './ScrollCue';
import Container from '../../components/Container';

export function IntroSlide() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.3], [100, 0]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className="relative min-h-screen flex items-center justify-center bg-brand-light text-brand-dark py-20"
      id="intro"
    >
      <Container className="text-center">
        <h2 className="text-4xl md:text-5xl font-bold">Bem-vindo ao Data2Content</h2>
      </Container>
      <ScrollCue targetId="features" />
    </motion.section>
  );
}

