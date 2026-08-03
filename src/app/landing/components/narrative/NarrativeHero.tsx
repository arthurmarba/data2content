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
  { category: "Tom", value: "Direto · pessoal · provocativo" },
] as const;

const HERO_OUTCOMES = [
  "ganhar seguidores",
  "engajar",
  "vender",
  "atrair publicidade",
  "criar comunidade",
] as const;

export function NarrativeHero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [activeFrame, setActiveFrame] = useState(0);
  const [activeOutcome, setActiveOutcome] = useState(0);
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
          <p className="d2c-human-hero__eyebrow">
            Inteligência de tendências para criadores e marcas
          </p>
          <h1>
            <span className="sr-only">
              Tendências de conteúdo viram direção para ganhar seguidores, engajar, vender, atrair publicidade e criar comunidade.
            </span>
            <span aria-hidden="true" className="d2c-human-hero__promise-line">Tendência vira direção</span>
            <span aria-hidden="true" className="d2c-human-hero__business-line">
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
            </span>
          </h1>
          <p className="d2c-human-hero__lead">
            Assuntos, falas, cenários, formatos e reações da audiência viram inteligência toda semana. Assinantes recebem o relatório completo e debatem os achados ao vivo com a D2C.
          </p>
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
          <small className="d2c-human-hero__note">
            Conta gratuita · relatório e reuniões para assinantes.
          </small>
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
              aria-label="Sinais que a D2C lê no conteúdo: cenário, assunto, fala e tom"
            >
              <small>Sinais do conteúdo</small>
              <dl>
                {HERO_MAP_SIGNALS.map((signal, index) => (
                  <motion.div
                    key={signal.category}
                    data-active={index === activeFrame % HERO_MAP_SIGNALS.length}
                    animate={{ opacity: reducedMotion || index === activeFrame % HERO_MAP_SIGNALS.length ? 1 : 0.58 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    <dt>{signal.category}</dt>
                    <dd>{signal.value}</dd>
                  </motion.div>
                ))}
              </dl>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
