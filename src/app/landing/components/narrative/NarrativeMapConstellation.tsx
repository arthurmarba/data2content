"use client";

import Image from "next/image";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useRef, useState } from "react";

const SIGNALS = [
  { label: "Histórias vividas", className: "is-story" },
  { label: "Assuntos que você defende", className: "is-subject" },
  { label: "Situações que se repetem", className: "is-situation" },
  { label: "Seu jeito de falar", className: "is-voice" },
] as const;

const MAP_FRAMES = [
  { x: -1.2, y: 0.8, scale: 1.08 },
  { x: -0.4, y: 0.2, scale: 1.065 },
  { x: 0.5, y: -0.5, scale: 1.075 },
  { x: -0.2, y: -0.9, scale: 1.055 },
  { x: 0.7, y: -0.2, scale: 1.045 },
  { x: 0, y: 0, scale: 1.03 },
] as const;

export function NarrativeMapConstellation() {
  const figureRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [frameIndex, setFrameIndex] = useState(reducedMotion ? MAP_FRAMES.length - 1 : 0);
  const { scrollYProgress } = useScroll({ target: figureRef, offset: ["start 88%", "end 18%"] });

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (reducedMotion) return;
    setFrameIndex(Math.min(MAP_FRAMES.length - 1, Math.floor(latest * MAP_FRAMES.length)));
  });

  const frame = MAP_FRAMES[reducedMotion ? MAP_FRAMES.length - 1 : frameIndex] ?? MAP_FRAMES[0]!;

  return (
    <motion.figure
      ref={figureRef}
      className="d2c-map-constellation"
    >
      <motion.div
        className="d2c-map-constellation__portrait"
        animate={{ x: `${frame.x}%`, y: `${frame.y}%`, scale: frame.scale }}
        transition={{ duration: reducedMotion ? 0 : 0.08, ease: "linear" }}
      >
        <Image
          src="/images/landing/stop-motion/map-creator-editorial-v1.webp"
          alt="Creator desenvolvendo uma pauta em seu estúdio de conteúdo"
          fill
          sizes="(max-width: 820px) 100vw, 55vw"
        />
      </motion.div>
      <div className="d2c-map-constellation__shade" />
      {SIGNALS.map((signal, index) => (
        <motion.span
          key={signal.label}
          className={signal.className}
          initial={false}
          animate={{ opacity: reducedMotion || frameIndex >= index + 1 ? 1 : 0, y: reducedMotion || frameIndex >= index + 1 ? 0 : 12 }}
          transition={{ duration: reducedMotion ? 0 : 0.16 }}
        >
          {signal.label}
        </motion.span>
      ))}
      <motion.figcaption
        initial={false}
        animate={{ opacity: reducedMotion || frameIndex >= 5 ? 1 : 0, y: reducedMotion || frameIndex >= 5 ? 0 : 18 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
      >
        <small>Uma pauta que nasce do seu Mapa</small>
        <strong>O que aprendi quando parei de criar como todo mundo?</strong>
      </motion.figcaption>
    </motion.figure>
  );
}
