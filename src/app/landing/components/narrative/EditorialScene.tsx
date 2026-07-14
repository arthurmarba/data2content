"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function EditorialScene() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], reducedMotion ? [1, 1, 1] : [1.08, 1, 1.04]);
  const copyY = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [42, -42]);

  return (
    <section className="d2c-editorial-scene" ref={ref} aria-label="Creators trocando ideias em um encontro criativo">
      <motion.div className="d2c-editorial-scene__image" style={{ scale }}>
        <Image
          src="/images/landing/d2c-creators-editorial-v1.webp"
          alt="Grupo diverso de creators em um encontro criativo"
          fill
          sizes="100vw"
          priority
        />
      </motion.div>
      <div className="d2c-editorial-scene__shade" />
      <motion.div className="d2c-editorial-scene__copy d2c-shell" style={{ y: copyY }}>
        <span>Você não é um nicho · imagem conceitual</span>
        <p>Você é feito de histórias, referências e de um jeito próprio de enxergar o mundo.</p>
        <strong>Sua próxima pauta não deveria servir para qualquer creator.</strong>
      </motion.div>
    </section>
  );
}
