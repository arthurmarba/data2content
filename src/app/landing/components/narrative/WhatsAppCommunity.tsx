"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowDown, CheckCheck, MessageCircleMore, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FALLBACK_LANDING_CREATORS, MATCH_STORY } from "@/app/landing/narrativeData";
import type { LandingCreatorHighlight } from "@/types/landing";

import { CreatorAvatar } from "./CreatorAvatar";
const CHAT_FRAMES = [
  ["match"],
  ["match", "opening"],
  ["match", "opening", "typing"],
  ["match", "opening", "answer"],
  ["match", "opening", "answer", "reference"],
  ["match", "opening", "answer", "reference", "next-step"],
  ["match", "opening", "answer", "reference", "next-step", "outcome"],
] as const;

export const CHAT_FRAME_DURATIONS = [1800, 3200, 1100, 3000, 2800, 2800] as const;

type ChatEvent = (typeof CHAT_FRAMES)[number][number];

type WhatsAppCommunityProps = {
  creators: LandingCreatorHighlight[];
  communityCreators: LandingCreatorHighlight[];
};

function creatorKey(creator: LandingCreatorHighlight) {
  return (creator.username || creator.id).replace(/^@/, "").toLocaleLowerCase("pt-BR");
}

export function WhatsAppCommunity({ creators, communityCreators }: WhatsAppCommunityProps) {
  const ref = useRef<HTMLElement>(null);
  const messageListRef = useRef<HTMLOListElement>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const isInView = useInView(ref, { amount: 0.35 });
  const [activeIndex, setActiveIndex] = useState(0);
  const first = creators[0] ?? FALLBACK_LANDING_CREATORS[0]!;
  const second = creators[1] ?? FALLBACK_LANDING_CREATORS[1]!;
  const usedCreators = new Set([creatorKey(first), creatorKey(second)]);
  const supporter = communityCreators.find((creator) => !usedCreators.has(creatorKey(creator))) ?? first;
  const secondFirstName = second.name.split(" ")[0];
  const supporterFirstName = supporter.name.split(" ")[0];
  const visibleEvents = reducedMotion ? CHAT_FRAMES.at(-1)! : CHAT_FRAMES[activeIndex]!;
  const isComplete = activeIndex === CHAT_FRAMES.length - 1;

  useEffect(() => {
    if (reducedMotion || !isInView || isComplete) return;

    let timer: number;
    const advance = () => {
      timer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") {
          advance();
          return;
        }
        setActiveIndex((current) => Math.min(current + 1, CHAT_FRAMES.length - 1));
      }, document.visibilityState === "visible" ? CHAT_FRAME_DURATIONS[activeIndex]! : 500);
    };

    advance();
    return () => window.clearTimeout(timer);
  }, [activeIndex, isComplete, isInView, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const list = messageListRef.current;
    if (!list) return;

    const frame = window.requestAnimationFrame(() => {
      list.scrollTo?.({ top: list.scrollHeight, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, reducedMotion]);

  const replay = () => {
    setActiveIndex(0);
    messageListRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const renderChatEvent = (event: ChatEvent) => {
    if (event === "match") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__system" {...messageMotion}>
          <span>Match por pauta</span>
          <strong>Você e {secondFirstName} deram match nessa pauta.</strong>
        </motion.li>
      );
    }

    if (event === "typing") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__typing" {...messageMotion}>
          <CreatorAvatar creator={second} size={27} />
          <div><span /><span /><span /></div>
          <small>{secondFirstName} está digitando</small>
        </motion.li>
      );
    }

    if (event === "opening") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__message is-self" {...messageMotion}>
          <div>
            <small>Você</small>
            <p>Quero abrir contando quando percebi que seguir uma fórmula estava apagando minha voz.</p>
            <span>10:14 <CheckCheck size={12} aria-hidden="true" /></span>
          </div>
        </motion.li>
      );
    }

    if (event === "answer") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__message" {...messageMotion}>
          <CreatorAvatar creator={second} size={27} />
          <div>
            <small>{secondFirstName}</small>
            <p>Também vivi isso. Posso trazer o momento em que decidi proteger meu jeito de criar.</p>
            <span>10:15</span>
          </div>
        </motion.li>
      );
    }

    if (event === "reference") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__message is-reference" {...messageMotion}>
          <CreatorAvatar creator={supporter} size={27} />
          <div>
            <small>{supporterFirstName} · comunidade</small>
            <p>Essa pauta pode ajudar no roteiro:</p>
            <strong>{MATCH_STORY.collabTitle}</strong>
            <span>10:16</span>
          </div>
        </motion.li>
      );
    }

    if (event === "next-step") {
      return (
        <motion.li key={event} className="d2c-whatsapp-chat__message is-self" {...messageMotion}>
          <div>
            <small>Você</small>
            <p>Fechou. Juntamos as duas histórias e gravamos semana que vem?</p>
            <span>10:17 <CheckCheck size={12} aria-hidden="true" /></span>
          </div>
        </motion.li>
      );
    }

    return (
      <motion.li key={event} className="d2c-whatsapp-chat__outcome" {...messageMotion}>
        <span>Collab combinada</span>
        <strong>A ideia começou a ganhar forma.</strong>
      </motion.li>
    );
  };

  return (
    <section ref={ref} className="d2c-whatsapp-community" data-landing-section="whatsapp-community" aria-labelledby="whatsapp-community-title">
      <div className="d2c-shell d2c-whatsapp-community__inner">
        <div className="d2c-whatsapp-community__copy">
          <p>Grupo exclusivo de assinantes</p>
          <h2 id="whatsapp-community-title">A reunião começa<br />antes das 19h.</h2>
          <span>É no grupo que assinantes confirmam presença para serem analisados — e onde referências, pautas e collabs continuam ganhando forma depois do ao vivo.</span>
          <a href="#comunidade">Conhecer quem já está na comunidade <ArrowDown size={16} aria-hidden="true" /></a>
        </div>

        <div className={`d2c-whatsapp-chat${reducedMotion ? " is-static" : ""}`} aria-label="Exemplo de uma conversa na comunidade D2C">
          <p className="sr-only">Depois do match, dois creators trocam perspectivas, recebem uma referência da comunidade e combinam o próximo passo da collab.</p>
          <header>
            <span className="d2c-whatsapp-chat__avatars" aria-hidden="true">
              <CreatorAvatar creator={first} size={29} />
              <CreatorAvatar creator={second} size={29} />
              <CreatorAvatar creator={supporter} size={29} />
            </span>
            <div><strong>Assinantes D2C Pro</strong><small>Creators criando em rede</small></div>
            <MessageCircleMore size={18} aria-hidden="true" />
          </header>
          <div className="d2c-whatsapp-chat__body">
            <span className="d2c-whatsapp-chat__day">Hoje</span>
            <ol ref={messageListRef} aria-hidden="true">
              <AnimatePresence initial={false}>{visibleEvents.map(renderChatEvent)}</AnimatePresence>
            </ol>
            {!reducedMotion && isComplete && (
              <button className="d2c-whatsapp-chat__replay" type="button" onClick={replay}>
                <RotateCcw size={13} aria-hidden="true" /> Ver conversa novamente
              </button>
            )}
          </div>
          <footer aria-hidden="true"><span>Mensagem</span><Send size={15} /></footer>
        </div>
      </div>
    </section>
  );
}

const messageMotion = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -5, transition: { duration: 0.18 } },
  transition: { duration: 0.36, ease: [0.22, 0.8, 0.28, 1] },
} as const;
