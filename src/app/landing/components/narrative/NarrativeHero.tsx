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

/* A promessa inteira é a voz grande da primeira dobra. As quebras são de
   sentido, não do acaso do wrap: a leitura primeiro (em cinza), a oferta
   depois (em preto cheio, com o grifo da marca).
   O `delay` é dramaturgia: as duas linhas da constatação entram juntas,
   pausa, e a oferta chega. */
type HeadlineLine = {
  text: string;
  emphasis: boolean;
  delay: number;
  mark?: string;
  tail?: string;
};

const HERO_HEADLINE: HeadlineLine[] = [
  { text: "Seus posts revelam", emphasis: false, delay: 0 },
  { text: "o que sua audiência quer.", emphasis: false, delay: 0.07 },
  { text: "A gente te diz ", emphasis: true, delay: 0.44, mark: "o que postar", tail: "." },
];

const MARK_DELAY = 1.2;

/* Micro-legendas de análise: uma de cada vez, ancoradas na moldura da foto,
   nunca no miolo onde está o rosto. A densidade vem da sequência, não do
   empilhamento — foi o empilhamento que tapava a criadora.
   Gramática do relatório semanal (elemento/assunto/tom/duração/horário e a
   força em múltiplos do post típico), com a âncora do 1,0× dentro da frase
   em vez de uma régua, para caber em duas linhas.
   Números da semana 29 (13–19 jul), sem identificar criador. */
type SignalAnchor =
  | "top-left"
  | "mid-left"
  | "mid-right"
  | "low-left"
  | "low-right"
  | "base";

/* Toda ação ocupa exatamente duas linhas, quebradas à mão e com comprimentos
   parecidos: é o que faz as caixas saírem idênticas sem sobrar preto.
   Ao mexer na copy, mantenha as duas linhas e ~17 caracteres por linha. */
type HeroSignal = {
  action: [string, string];
  proof: string;
  anchor: SignalAnchor;
  hold: number;
};

/* Tupla não-vazia: garante ao compilador que HERO_SIGNALS[0] existe, que é o
   fallback do índice ativo (o projeto usa noUncheckedIndexedAccess). */
const HERO_SIGNALS: [HeroSignal, ...HeroSignal[]] = [
  { action: ["Gravar o vídeo", "dentro de casa"], proof: "2,3× em comentários", anchor: "top-left", hold: 2100 },
  { action: ["Falar sobre criar", "os filhos"], proof: "5,5× em compartilhamentos", anchor: "mid-right", hold: 2100 },
  { action: ["Postar na quarta", "de manhã"], proof: "7,9× em compartilhamentos", anchor: "low-left", hold: 2100 },
  { action: ["Mostrar o carro", "na cena"], proof: "10,1× em compartilhamentos", anchor: "mid-left", hold: 2100 },
  { action: ["Aparecer sozinho", "na cena"], proof: "3,4× em alcance", anchor: "low-right", hold: 2100 },
  { action: ["Manter o vídeo", "entre 30 e 60s"], proof: "1,8× em comentários", anchor: "top-left", hold: 2100 },
  { action: ["Deixar o tom", "mais casual"], proof: "2,0× em compartilhamentos", anchor: "base", hold: 2100 },
];

export function NarrativeHero() {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [activeFrame, setActiveFrame] = useState(0);
  const [activeSignal, setActiveSignal] = useState(0);
  const [cycle, setCycle] = useState(0);
  const loginError = searchParams.get("error");
  const signal = HERO_SIGNALS[activeSignal] ?? HERO_SIGNALS[0];

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
      setActiveSignal(0);
      return;
    }

    /* Cada legenda tem seu tempo de leitura; a pauta, que fecha a volta,
       fica mais tempo na tela. */
    const timer = window.setTimeout(() => {
      const next = (activeSignal + 1) % HERO_SIGNALS.length;
      setActiveSignal(next);
      if (next === 0) {
        setCycle((current) => current + 1);
      }
    }, signal.hold);

    return () => window.clearTimeout(timer);
  }, [activeSignal, signal.hold, reducedMotion]);

  return (
    <section className="d2c-hero d2c-human-hero">
      <div className="d2c-shell d2c-human-hero__layout">
        <div className="d2c-human-hero__content">
          <h1>
            {HERO_HEADLINE.map((line) => (
              <span
                key={line.text}
                className={
                  line.emphasis
                    ? "d2c-human-hero__promise-line is-emphasis"
                    : "d2c-human-hero__promise-line"
                }
              >
                <motion.span
                  className="d2c-human-hero__promise-inner"
                  initial={reducedMotion ? false : { y: "130%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.62, delay: reducedMotion ? 0 : line.delay, ease: [0.22, 1, 0.36, 1] }}
                >
                  {line.text}
                  {line.mark && (
                    <span className="d2c-human-hero__mark">
                      {line.mark}
                      <motion.span
                        aria-hidden="true"
                        className="d2c-human-hero__mark-line"
                        initial={reducedMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.45, delay: reducedMotion ? 0 : MARK_DELAY, ease: [0.33, 1, 0.68, 1] }}
                      />
                    </span>
                  )}
                  {line.tail}{" "}
                </motion.span>
              </span>
            ))}
          </h1>
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
              aria-label={`Exemplo de análise da D2C: ${HERO_SIGNALS.map((item) => `${item.action.join(" ")} — ${item.proof}`).join("; ")}`}
            >
              {!reducedMotion && activeSignal === 0 && (
                <motion.span
                  key={`scan-${cycle}`}
                  aria-hidden="true"
                  className="d2c-human-hero__scan-line"
                  initial={{ top: "8%", opacity: 0 }}
                  animate={{ top: "76%", opacity: [0, 0.72, 0.72, 0] }}
                  transition={{ duration: 2.65, ease: "easeInOut" }}
                />
              )}
              <AnimatePresence initial={false} mode="wait">
                <motion.article
                  key={signal.action.join(" ")}
                  className="d2c-human-hero__signal"
                  data-anchor={signal.anchor}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                >
                  <strong>
                    <span>{signal.action[0]}</span>
                    <span>{signal.action[1]}</span>
                  </strong>
                  <span className="d2c-human-hero__signal-proof">{signal.proof}</span>
                </motion.article>
              </AnimatePresence>
            </figcaption>
          </div>
        </figure>
      </div>
    </section>
  );
}
