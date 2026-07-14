"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LandingAuthCta } from "./LandingAuthCta";

const HERO_STOP_MOTION = [
  { src: "/images/landing/stop-motion/hero-creator-frame-01-v1.webp", x: -0.8, y: 0.4, scale: 1.018 },
  { src: "/images/landing/stop-motion/hero-creator-frame-02-v1.webp", x: 0.4, y: -0.2, scale: 1.012 },
  { src: "/images/landing/d2c-creator-hero-editorial-v1.webp", x: 0, y: 0, scale: 1 },
  { src: "/images/landing/stop-motion/hero-creator-frame-02-v1.webp", x: -0.3, y: 0.25, scale: 1.008 },
  { src: "/images/landing/d2c-creator-hero-editorial-v1.webp", x: 0, y: 0, scale: 1 },
] as const;

const HERO_SIGNALS = [
  { label: "Histórias vividas", className: "is-story" },
  { label: "Assuntos que você defende", className: "is-subject" },
  { label: "Situações que se repetem", className: "is-situation" },
  { label: "Seu jeito de falar", className: "is-voice" },
] as const;

export function NarrativeHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [mobileFrame, setMobileFrame] = useState(2);
  const loginError = searchParams.get("error");
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const questionX = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [0, 24]);

  useEffect(() => {
    HERO_STOP_MOTION.forEach((frame) => {
      const image = new window.Image();
      image.src = frame.src;
    });

    if (reducedMotion) {
      setMobileFrame(2);
      return;
    }

    let nextFrame = 0;
    const timer = window.setInterval(() => {
      setMobileFrame(nextFrame);
      nextFrame = (nextFrame + 1) % HERO_STOP_MOTION.length;
    }, 680);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="d2c-hero d2c-human-hero">
      <div className="d2c-shell d2c-human-hero__layout">
        <motion.div
        className="d2c-human-hero__content"
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
      >
        <motion.h1 variants={{ hidden: { opacity: 0, y: 26 }, visible: { opacity: 1, y: 0, transition: { duration: 0.85 } } }}>
          <span>30 ideias da IA.</span> <motion.em style={{ x: questionX }}>Alguma tinha a sua cara?</motion.em>
        </motion.h1>
        <motion.p className="d2c-human-hero__lead" variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}>
          A D2C entende sua narrativa, transforma isso em pautas e encontra creators que também querem criar essas ideias.
        </motion.p>
        <motion.div className="d2c-human-hero__actions" variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}>
          <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Quero criar com a minha cara" childrenAfter={<ArrowRight size={18} aria-hidden="true" />} trackingLocation="hero" />
        </motion.div>
        {loginError && (
          <motion.p
            role="alert"
            className="d2c-human-hero__auth-notice"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
          >
            {loginError === "TermsConsentRequired"
              ? "Continue com Google para atualizar seu aceite dos Termos e da Política de Privacidade."
              : "Não foi possível concluir sua entrada. Tente novamente com Google."}
          </motion.p>
        )}
        <motion.small className="d2c-human-hero__note" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}>
          Entre com Google. Sem cobrança automática.
        </motion.small>
        </motion.div>
        <motion.figure
          className="d2c-human-hero__portrait"
          initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 1.025 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 0.8, 0.28, 1] }}
        >
          <Image
            className="d2c-human-hero__mobile-image"
            src={HERO_STOP_MOTION[mobileFrame]?.src ?? HERO_STOP_MOTION[2].src}
            alt="Creator desenvolvendo uma ideia em seu espaço de trabalho"
            width={1024}
            height={1536}
            priority
            sizes="100vw"
          />
          <Image
            className="d2c-human-hero__base"
            src="/images/landing/d2c-creator-hero-editorial-v1.webp"
            alt="Creator desenvolvendo uma ideia em seu espaço de trabalho"
            fill
            priority
            sizes="(max-width: 820px) 100vw, 76rem"
          />
          <div className="d2c-human-hero__stop-motion">
            {HERO_STOP_MOTION.map((frame, index) => {
              const opacity = HERO_STOP_MOTION.map((_, point) => (point === index ? 1 : 0));
              if (index === HERO_STOP_MOTION.length - 1) opacity.push(1);
              else opacity.push(0);

              return (
                <motion.div
                  key={`${frame.src}-${index}`}
                  className="d2c-human-hero__frame"
                  initial={false}
                  animate={reducedMotion ? { opacity: index === 2 ? 1 : 0 } : { opacity }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 3.4, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: "linear" }}
                  style={{ transform: `translate3d(${frame.x}%, ${frame.y}%, 0) scale(${frame.scale})` }}
                  aria-hidden="true"
                >
                  <Image
                    src={frame.src}
                    alt=""
                    fill
                    loading="eager"
                    sizes="(max-width: 820px) 100vw, 45vw"
                  />
                </motion.div>
              );
            })}
          </div>
          <motion.div
            className="d2c-human-hero__signals"
            aria-label="Sinais que formam o seu Mapa"
            initial={reducedMotion ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { delayChildren: 0.85, staggerChildren: 0.16 } },
            }}
          >
            {HERO_SIGNALS.map((signal) => (
              <motion.span
                key={signal.label}
                className={signal.className}
                variants={{
                  hidden: { opacity: 0, y: 14, scale: 0.94 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.48, ease: [0.22, 0.8, 0.28, 1] },
                  },
                }}
              >
                {signal.label}
              </motion.span>
            ))}
          </motion.div>
          <figcaption><span>Sua história já está aí.</span><b>D2C</b></figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
