"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

import { useMobileAutoSequence } from "./useMobileAutoSequence";

const MANIFESTO_BEATS = [
  { eyebrow: "Você não é um nicho", line: "Você é tudo que viveu até aqui." },
  { eyebrow: "Conexão não é alcance", line: "Ela começa quando algo faz sentido pros dois." },
  { eyebrow: "Você está em movimento", line: "Sua próxima ideia também pode estar." },
] as const;

export function CreatorManifesto() {
  const { ref: sectionRef, activeIndex, isMobile, reducedMotion, selectIndex } = useMobileAutoSequence(MANIFESTO_BEATS.length, 3500);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const imageScale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [1.08, 1]);
  const imageY = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [24, -24]);
  const firstOpacity = useTransform(scrollYProgress, [0, 0.2, 0.32], [1, 1, 0]);
  const secondOpacity = useTransform(scrollYProgress, [0.25, 0.4, 0.62, 0.72], [0, 1, 1, 0]);
  const thirdOpacity = useTransform(scrollYProgress, [0.66, 0.8, 1], [0, 1, 1]);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  if (reducedMotion) {
    return (
      <section ref={sectionRef} className="d2c-creator-manifesto is-static" data-landing-section="manifesto" aria-label="Manifesto D2C">
        <div className="d2c-creator-manifesto__static-image">
          <Image src="/images/landing/d2c-creators-editorial-v1.webp" alt="Creators reunidos em um encontro criativo" fill sizes="100vw" />
        </div>
        <div className="d2c-shell d2c-creator-manifesto__static-copy">
          {MANIFESTO_BEATS.map((beat) => <div key={beat.eyebrow}><span>{beat.eyebrow}</span><p>{beat.line}</p></div>)}
        </div>
      </section>
    );
  }

  return (
    <section ref={sectionRef} className="d2c-creator-manifesto" data-landing-section="manifesto" aria-label="Manifesto D2C">
      <div className="d2c-creator-manifesto__sticky">
        <motion.div className="d2c-creator-manifesto__image" style={isMobile ? undefined : { scale: imageScale, y: imageY }}>
          <Image src="/images/landing/d2c-creators-editorial-v1.webp" alt="Creators reunidos em um encontro criativo" fill sizes="100vw" />
        </motion.div>
        <div className="d2c-creator-manifesto__shade" />
        <div className="d2c-creator-manifesto__beats">
          <motion.div className={activeIndex === 0 ? "is-active" : undefined} style={isMobile ? undefined : { opacity: firstOpacity }} animate={isMobile ? { opacity: activeIndex === 0 ? 1 : 0, y: activeIndex === 0 ? 0 : 12 } : undefined}><span>{MANIFESTO_BEATS[0].eyebrow}</span><p>{MANIFESTO_BEATS[0].line}</p></motion.div>
          <motion.div className={activeIndex === 1 ? "is-active" : undefined} style={isMobile ? undefined : { opacity: secondOpacity }} animate={isMobile ? { opacity: activeIndex === 1 ? 1 : 0, y: activeIndex === 1 ? 0 : 12 } : undefined}><span>{MANIFESTO_BEATS[1].eyebrow}</span><p>{MANIFESTO_BEATS[1].line}</p></motion.div>
          <motion.div className={activeIndex === 2 ? "is-active" : undefined} style={isMobile ? undefined : { opacity: thirdOpacity }} animate={isMobile ? { opacity: activeIndex === 2 ? 1 : 0, y: activeIndex === 2 ? 0 : 12 } : undefined}><span>{MANIFESTO_BEATS[2].eyebrow}</span><p>{MANIFESTO_BEATS[2].line}</p></motion.div>
        </div>
        <div className="d2c-creator-manifesto__controls" role="group" aria-label="Ideias do manifesto D2C">
          {MANIFESTO_BEATS.map((beat, index) => (
            <button key={beat.eyebrow} type="button" aria-label={beat.eyebrow} aria-pressed={activeIndex === index} onClick={() => selectIndex(index)}>
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
        <div className="d2c-creator-manifesto__meta"><span>D2C / Manifesto</span><span>Role para descobrir</span></div>
        <motion.div className="d2c-creator-manifesto__progress" style={{ scaleX: progressScale }} />
      </div>
    </section>
  );
}
