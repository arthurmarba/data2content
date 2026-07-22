"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
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
  { category: "Território", value: "Criatividade sem fórmulas" },
  { category: "Assuntos", value: "IA · negócios criativos" },
  { category: "Asset de vida", value: "Bastidores de quem constrói" },
  { category: "Tom de fala", value: "Direto · pessoal · provocativo" },
] as const;

export function NarrativeHero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [activeFrame, setActiveFrame] = useState(0);
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

  return (
    <section className="d2c-hero d2c-human-hero">
      <div className="d2c-shell d2c-human-hero__layout">
        <div className="d2c-human-hero__content">
          <p className="d2c-human-hero__eyebrow">
            Consultoria ao vivo · quintas, 19h–21h
          </p>
          <h1>
            <span className="d2c-human-hero__promise-line">Te ajudamos a criar</span>
            <span className="d2c-human-hero__business-line">pra atrair marcas.</span>
          </h1>
          <p className="d2c-human-hero__lead">
            Marcas compram narrativas. Na D2C, consultoria, IA e creators transformam sua história em direção, pautas e collabs.
          </p>
          <div className="d2c-human-hero__actions">
            <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Entrar na D2C" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={18} aria-hidden="true" />} trackingLocation="hero" />
          </div>
          {loginError && (
            <p role="alert" className="d2c-human-hero__auth-notice">
              {loginError === "TermsConsentRequired"
                ? "Continue com Google para atualizar seu aceite dos Termos e da Política de Privacidade."
                : "Não foi possível concluir sua entrada. Tente novamente com Google."}
            </p>
          )}
          <small className="d2c-human-hero__note">
            Entre com Google · sem cobrança automática.
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
              aria-label="Elementos que formam o Seu Mapa: Território, Assuntos, Asset de vida e Tom de fala"
            >
              <small>Seu mapa</small>
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
