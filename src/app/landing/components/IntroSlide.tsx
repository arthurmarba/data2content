'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { ScrollCue } from './ScrollCue';

export function IntroSlide() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 1, 1]);
  const y = useTransform(scrollYProgress, [0, 0.3], [100, 0]);

  return (
    <motion.section
      ref={ref}
      style={{ opacity, y }}
      className="relative h-screen flex items-center justify-center bg-blue-600 text-white"
      id="intro"
    >
      <h1 className="text-4xl font-bold">Bem-vindo ao Data2Content</h1>
      <ScrollCue targetId="features" />
    </motion.section>
  );
}

