"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LandingAuthCta } from "./LandingAuthCta";

const HERO_STOP_MOTION = [
  "/images/landing/stop-motion/hero-creator-frame-01-v1.webp",
  "/images/landing/stop-motion/hero-creator-frame-02-v1.webp",
  "/images/landing/d2c-creator-hero-editorial-v1.webp",
  "/images/landing/stop-motion/hero-creator-frame-02-v1.webp",
] as const;

const HERO_MAP_SIGNALS = [
  { category: "Cenário", value: "Espaço de trabalho" },
  { category: "Assunto", value: "IA · negócios criativos" },
  { category: "Fala", value: "Estou construindo do meu jeito" },
  { category: "Formato", value: "Bastidores em primeira pessoa" },
] as const;

const HERO_OUTCOMES = [
  "ganhar seguidores",
  "engajar",
  "vender",
  "atrair marcas",
  "criar comunidade",
] as const;

export function NarrativeHero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [activeFrame, setActiveFrame] = useState(0);
  const [activeOutcome, setActiveOutcome] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const loginError = searchParams.get("error");

  useEffect(() => {
    HERO_STOP_MOTION.forEach((src) => {
      const image = new window.Image();
      image.src = src;
    });

    if (reducedMotion) {
      setActiveFrame(0);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveFrame((current) => (current + 1) % HERO_STOP_MOTION.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      setAnalysisStep(5);
      return;
    }

    const steps = [
      window.setTimeout(() => setAnalysisStep(1), 1050),
      window.setTimeout(() => setAnalysisStep(2), 1550),
      window.setTimeout(() => setAnalysisStep(3), 2050),
      window.setTimeout(() => setAnalysisStep(4), 2850),
      window.setTimeout(() => setAnalysisStep(5), 3650),
    ];

    return () => steps.forEach((timer) => window.clearTimeout(timer));
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      setActiveOutcome(0);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveOutcome((current) => (current + 1) % HERO_OUTCOMES.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  return (
    <section className="d2c-hero d2c-human-hero">
      <div className="d2c-shell d2c-human-hero__layout">
        <div className="d2c-human-hero__content">
          <h1>
            <motion.span
              className="d2c-human-hero__promise-line"
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              Pare de adivinhar
            </motion.span>
            {" "}
            <motion.span
              className="d2c-human-hero__promise-line"
              initial={reducedMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              o que postar.
            </motion.span>
          </h1>
          <p className="d2c-human-hero__lead">
            Nossa IA assiste aos conteúdos dos criadores.
          </p>
          <span className="sr-only">
            Ela identifica padrões em assuntos, falas, cenários e formatos e transforma isso em direção para criar conteúdo que ganha seguidores, engaja, vende, atrai marcas e cria comunidade.
          </span>
          <div aria-hidden="true" className="d2c-human-hero__business-line">
            <AnimatePresence initial={false} mode="sync">
              <motion.span
                key={HERO_OUTCOMES[activeOutcome]}
                className="d2c-human-hero__outcome-line"
                initial={{ opacity: 0, y: "32%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "-28%" }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="d2c-human-hero__outcome-prefix">para </span>
                <em className="d2c-human-hero__outcome-word">{HERO_OUTCOMES[activeOutcome]}.</em>
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="d2c-human-hero__actions">
            <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar conta grátis" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={18} aria-hidden="true" />} trackingLocation="hero" />
          </div>
          {loginError && (
            <p role="alert" className="d2c-human-hero__auth-notice">
              {loginError === "TermsConsentRequired"
                ? "Continue com Google para atualizar seu aceite dos Termos e da Política de Privacidade."
                : "Não foi possível concluir sua entrada. Tente novamente com Google."}
            </p>
          )}
        </div>
        <figure className="d2c-human-hero__portrait">
          <div className="d2c-human-hero__media">
            <Image
              className="d2c-human-hero__mobile-image"
              src={HERO_STOP_MOTION[activeFrame] ?? HERO_STOP_MOTION[0]}
              alt="Creator desenvolvendo uma ideia em seu espaço de trabalho"
              width={1024}
              height={1536}
              priority
              sizes="100vw"
            />
            <Image
              className="d2c-human-hero__base"
              src={HERO_STOP_MOTION[activeFrame] ?? HERO_STOP_MOTION[0]}
              alt="Creator desenvolvendo uma ideia em seu espaço de trabalho"
              fill
              priority
              sizes="(max-width: 820px) 100vw, 76rem"
            />
            <figcaption
              className="d2c-human-hero__map-caption"
              aria-label="A IA assiste aos conteúdos, identifica sinais de cenário, assunto, fala e formato, encontra padrões e os transforma em direção para postar"
            >
              <dl>
                {HERO_MAP_SIGNALS.map((signal, index) => (
                  <motion.div
                    key={signal.category}
                    data-active={analysisStep < 4 && index === analysisStep}
                    animate={{
                      opacity: analysisStep >= 4 ? 0.52 : index <= analysisStep ? 1 : 0,
                      scale: analysisStep >= 4 ? 0.94 : index === analysisStep ? 1 : 0.98,
                    }}
                    transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <dt>{signal.category}</dt>
                    <dd>{signal.value}</dd>
                  </motion.div>
                ))}
              </dl>
              <div aria-hidden="true" className="d2c-human-hero__analysis-result-slot">
                <AnimatePresence initial={false} mode="wait">
                  {analysisStep >= 4 && (
                    <motion.strong
                      key={analysisStep === 4 ? "pattern" : "direction"}
                      className="d2c-human-hero__analysis-result"
                      initial={{ opacity: 0, y: 18, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {analysisStep === 4 ? "Padrão encontrado" : "Direção para postar"}
                    </motion.strong>
                  )}
                </AnimatePresence>
              </div>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
