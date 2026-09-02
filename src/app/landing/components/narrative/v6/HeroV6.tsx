"use client";

import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { LandingCreatorHighlight } from "@/types/landing";

import { LandingAuthCta } from "../LandingAuthCta";
import { CreatorMarquee } from "./CreatorMarquee";
import { PlatformMarquee } from "./PlatformMarquee";

/* A promessa gira só na palavra interrogativa: o verbo ("criar") e a segunda
   resposta ("qual publi fazer") ficam fixos, porque são a promessa — o que
   muda é a dimensão da pergunta que a D2C responde. */
const ROTATOR_WORDS = ["o que", "como", "quando", "onde", "com quem"] as const;

const ROTATE_MS = 2200;

const STAT_ROTATE_MS = 4200;

type HeroV6Props = {
  creators: LandingCreatorHighlight[];
  /** Provas agregadas da comunidade; o selo alterna entre elas. */
  statLines: string[];
};

export function HeroV6({ creators, statLines }: HeroV6Props) {
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [statIndex, setStatIndex] = useState(0);
  const loginError = searchParams.get("error");

  useEffect(() => {
    if (reducedMotion) {
      setIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ROTATOR_WORDS.length);
    }, ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  /* O selo só alterna se houver mais de uma prova; com uma só ele fica fixo,
     e com nenhuma nem aparece. */
  useEffect(() => {
    if (reducedMotion || statLines.length < 2) {
      setStatIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStatIndex((current) => (current + 1) % statLines.length);
    }, STAT_ROTATE_MS);

    return () => window.clearInterval(timer);
  }, [reducedMotion, statLines.length]);

  const word = ROTATOR_WORDS[index] ?? ROTATOR_WORDS[0];
  const statLine = statLines[statIndex] ?? statLines[0] ?? null;

  return (
    <section className="d2c-v6-hero" data-landing-section="hero">
      <div className="d2c-v6-hero__inner">
        {statLine && (
          <span className="d2c-v6-hero__badge">
            <i aria-hidden="true" />
            <span key={statLine} className="d2c-v6-hero__badge-text">
              {statLine}
            </span>
          </span>
        )}

        <h1 className="d2c-v6-hero__headline">
          <span className="d2c-v6-hero__quiet">Nossa IA assiste tudo o que você posta</span>
          <br />
          pra te dizer{" "}
          <span className="d2c-v6-hero__rotator">
            {/* O fantasma é a palavra ATUAL: ele dá a largura, e o CSS anima a
                mudança. Reservar a largura da maior alternativa ("com quem")
                abria um buraco fixo antes de "criar" nas palavras curtas. */}
            <span className="d2c-v6-hero__rotator-ghost" aria-hidden="true">
              {word}
            </span>
            {/* A troca é uma animação CSS reiniciada pela `key`, não um
                estado inicial invisível: se a animação não rodar (aba em
                background, rAF estrangulado, JS quebrado), a palavra continua
                visível. Com `initial={{opacity:0}}` ela sumia — e some no meio
                da frase que carrega a promessa inteira. */}
            <span key={word} className="d2c-v6-hero__rotator-word d2c-v6-mark">
              {word}
            </span>
          </span>{" "}
          criar
          <br />e <span className="d2c-v6-mark">qual publi fazer</span>.
        </h1>

        <p className="d2c-v6-hero__sub">Você não está mais sozinho. De criador pra criador.</p>

        <div className="d2c-v6-hero__cta">
          <LandingAuthCta
            className="d2c-button d2c-button--human"
            guestLabel="Criar conta grátis"
            authenticatedLabel="Acessar a D2C"
            childrenAfter={<ArrowRight size={18} aria-hidden="true" />}
            trackingLocation="hero"
          />
          <span className="d2c-v6-hero__note">
            Primeiro mês grátis com o cupom <b>d2cVIP</b> · depois R$ 97/mês
          </span>
        </div>

        {loginError && (
          <p role="alert" className="d2c-human-hero__auth-notice">
            {loginError === "TermsConsentRequired"
              ? "Continue com Google para atualizar seu aceite dos Termos e da Política de Privacidade."
              : "Não foi possível concluir sua entrada. Tente novamente com Google."}
          </p>
        )}
      </div>

      <div className="d2c-v6-hero__strips">
        <CreatorMarquee creators={creators} />
        <PlatformMarquee />
      </div>
    </section>
  );
}
