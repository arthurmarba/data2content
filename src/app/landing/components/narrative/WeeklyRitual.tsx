"use client";

import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { LandingAuthCta } from "./LandingAuthCta";
import { useMobileAutoSequence } from "./useMobileAutoSequence";

const WEEKLY_BEATS = [
  { number: "01", title: "Você pode assistir gratuitamente.", text: "Toda quinta, Arthur e Ronaldo analisam conteúdo e estratégia de imagem ao vivo, creator por creator." },
  { number: "02", title: "Assinou e confirmou? Você é analisado.", text: "Todo assinante que confirma presença no grupo exclusivo do WhatsApp entra nas análises daquela reunião." },
  { number: "03", title: "A direção continua depois do ao vivo.", text: "Mapa, pautas, collabs e ferramentas ajudam você a transformar a conversa em movimento durante a semana." },
] as const;

const WEEKLY_IMAGES = [
  { src: "/images/landing/stop-motion/weekly-publish-editorial-v1.webp", alt: "Creator publicando um vídeo em seu estúdio" },
  { src: "/images/landing/stop-motion/weekly-refine-editorial-v1.webp", alt: "Creator analisando e refinando um conteúdo" },
  { src: "/images/landing/stop-motion/weekly-collab-editorial-v1.webp", alt: "Creators produzindo uma colaboração juntos" },
] as const;

export function WeeklyRitual() {
  const { ref: sectionRef, activeIndex, isMobile, reducedMotion, selectIndex } = useMobileAutoSequence(WEEKLY_BEATS.length, 3400);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const imageScale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [1.06, 1]);
  const firstOpacity = useTransform(scrollYProgress, [0, 0.22, 0.28], [1, 1, 0]);
  const firstY = useTransform(scrollYProgress, [0.22, 0.28], [0, -28]);
  const secondOpacity = useTransform(scrollYProgress, [0.31, 0.38, 0.57, 0.63], [0, 1, 1, 0]);
  const secondY = useTransform(scrollYProgress, [0.31, 0.38, 0.57, 0.63], [28, 0, 0, -28]);
  const thirdOpacity = useTransform(scrollYProgress, [0.67, 0.74, 1], [0, 1, 1]);
  const thirdY = useTransform(scrollYProgress, [0.67, 0.74], [28, 0]);
  const progressScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="reuniao-semanal" ref={sectionRef} className={`d2c-weekly-story${reducedMotion ? " is-static" : ""}`} data-landing-section="weekly-community">
      <div className="d2c-weekly-story__sticky">
        <motion.div className="d2c-weekly-story__images" style={{ scale: imageScale }}>
          {WEEKLY_IMAGES.map((image, index) => {
            const imageOpacity = index === 0 ? firstOpacity : index === 1 ? secondOpacity : thirdOpacity;

            return (
              <motion.figure
                key={image.src}
                className={`d2c-weekly-story__image${activeIndex === index ? " is-active" : ""}`}
                style={isMobile ? undefined : reducedMotion ? { opacity: index === 0 ? 1 : 0 } : { opacity: imageOpacity }}
                animate={isMobile ? { opacity: activeIndex === index ? 1 : 0, scale: activeIndex === index ? 1 : 1.025 } : undefined}
                transition={isMobile ? { duration: 0.55, ease: [0.22, 0.8, 0.28, 1] } : undefined}
                aria-hidden={isMobile ? activeIndex !== index : Boolean(reducedMotion && index !== 0)}
              >
                <Image src={image.src} alt={reducedMotion && index !== 0 ? "" : image.alt} fill sizes="100vw" quality={82} />
              </motion.figure>
            );
          })}
        </motion.div>
        <p className="d2c-weekly-story__image-note">Cenas editoriais ilustrativas da rotina de creators.</p>
        <div className="d2c-weekly-story__shade" />
        <div className="d2c-shell d2c-weekly-story__header">
          <p>Toda quinta · 19h–21h · online</p>
          <span>Uma reunião de análise real. A plataforma acompanha você entre uma quinta e outra.</span>
        </div>
        <div className="d2c-shell d2c-weekly-story__beats">
          <motion.article className={activeIndex === 0 ? "is-active" : undefined} style={isMobile || reducedMotion ? undefined : { opacity: firstOpacity }} animate={isMobile ? { opacity: activeIndex === 0 ? 1 : 0 } : undefined}><motion.div style={isMobile || reducedMotion ? undefined : { y: firstY }}><span>{WEEKLY_BEATS[0].number}</span><h2>{WEEKLY_BEATS[0].title}</h2><p>{WEEKLY_BEATS[0].text}</p></motion.div></motion.article>
          <motion.article className={activeIndex === 1 ? "is-active" : undefined} style={isMobile || reducedMotion ? undefined : { opacity: secondOpacity }} animate={isMobile ? { opacity: activeIndex === 1 ? 1 : 0 } : undefined}><motion.div style={isMobile || reducedMotion ? undefined : { y: secondY }}><span>{WEEKLY_BEATS[1].number}</span><h2>{WEEKLY_BEATS[1].title}</h2><p>{WEEKLY_BEATS[1].text}</p></motion.div></motion.article>
          <motion.article className={activeIndex === 2 ? "is-active" : undefined} style={isMobile || reducedMotion ? undefined : { opacity: thirdOpacity }} animate={isMobile ? { opacity: activeIndex === 2 ? 1 : 0 } : undefined}><motion.div style={isMobile || reducedMotion ? undefined : { y: thirdY }}><span>{WEEKLY_BEATS[2].number}</span><h2>{WEEKLY_BEATS[2].title}</h2><p>{WEEKLY_BEATS[2].text}</p></motion.div></motion.article>
        </div>
        <div className="d2c-weekly-story__controls" role="group" aria-label="Momentos da reunião semanal">
          {WEEKLY_BEATS.map((beat, index) => (
            <button key={beat.number} type="button" aria-label={`Ver momento ${beat.number}`} aria-pressed={activeIndex === index} onClick={() => selectIndex(index)}>
              {beat.number}
            </button>
          ))}
        </div>
        <div className="d2c-shell d2c-weekly-story__footer">
          <p>Mesmo quando o conteúdo analisado não é o seu, os padrões da conversa mudam como você olha para o que está criando.</p>
          <LandingAuthCta className="d2c-human-link" guestLabel="Assistir à próxima reunião" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={16} aria-hidden="true" />} trackingLocation="weekly-community" />
        </div>
        {!reducedMotion && <motion.div className="d2c-weekly-story__progress" style={{ scaleX: progressScale }} />}
      </div>
    </section>
  );
}
