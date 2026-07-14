"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight, Heart, HeartHandshake, MousePointer2, Pointer, RotateCcw, Sparkles, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FALLBACK_LANDING_CREATORS, MATCH_STORY } from "@/app/landing/narrativeData";
import type { LandingCreatorHighlight } from "@/types/landing";

import { CreatorAvatar } from "./CreatorAvatar";
import { LandingAuthCta } from "./LandingAuthCta";

type MatchScene = "idea" | "ideaAccepted" | "collab" | "collabAccepted" | "mutual" | "match";

const MATCH_SCENES: MatchScene[] = ["idea", "ideaAccepted", "collab", "collabAccepted", "mutual", "match"];

export const MATCH_SCENE_DURATIONS: Record<Exclude<MatchScene, "match">, number> = {
  idea: 2200,
  ideaAccepted: 2100,
  collab: 2200,
  collabAccepted: 2100,
  mutual: 1400,
};

const SWIPE_MOTION_DURATION_SECONDS = 1.9;

const SCENE_LABELS: Record<MatchScene, string> = {
  idea: "Uma pauta feita para você",
  ideaAccepted: "Você escolheu — swipe para a direita",
  collab: "Uma possibilidade de collab",
  collabAccepted: "Collab escolhida — swipe para a direita",
  mutual: "Interesse dos dois lados",
  match: "O match foi revelado",
};

function DecisionStamp() {
  return (
    <motion.span
      className="d2c-match-card__stamp"
      initial={{ opacity: 0, scale: 0.78, rotate: -10 }}
      animate={{ opacity: 1, scale: 1, rotate: -7 }}
      transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.34 }}
    >
      Quero fazer
    </motion.span>
  );
}

function DemoPointer() {
  return (
    <motion.span
      className="d2c-match-demo-pointer"
      initial={{ opacity: 0, x: 34, y: 38 }}
      animate={{ opacity: [0, 1, 1, 0], x: [34, 0, 0, 0], y: [38, 0, 0, 0], scale: [1, 1, 0.78, 0.86] }}
      transition={{ duration: 1.18, times: [0, 0.34, 0.68, 1], ease: "easeOut" }}
      aria-hidden="true"
    >
      <MousePointer2 className="d2c-match-demo-pointer__mouse" size={24} fill="currentColor" />
      <Pointer className="d2c-match-demo-pointer__touch" size={27} fill="currentColor" />
    </motion.span>
  );
}

function DecisionActions({ accepted }: { accepted: boolean }) {
  return (
    <div className="d2c-match-card__actions" aria-hidden="true">
      <span className="d2c-match-card__decision">
        <span className="d2c-match-card__decision-icon"><X size={19} /></span>
        <small>Agora não</small>
      </span>
      <span className={`d2c-match-card__decision d2c-match-card__decision--want${accepted ? " is-pressed" : ""}`}>
        <span className="d2c-match-card__decision-icon"><Heart size={20} fill="currentColor" /></span>
        <small>Quero fazer</small>
        {accepted && <DemoPointer />}
      </span>
    </div>
  );
}

function StoryCard({
  kind,
  creator,
  accepted,
  preview = false,
}: {
  kind: "idea" | "collab";
  creator: LandingCreatorHighlight;
  accepted: boolean;
  preview?: boolean;
}) {
  const isIdea = kind === "idea";

  return (
    <motion.article
      className={`d2c-match-card d2c-match-card--${kind}${preview ? " is-preview" : ""}`}
      aria-hidden={preview || undefined}
      initial={accepted
        ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }
        : { opacity: 0, y: 28, scale: 0.965, rotate: isIdea ? -1.2 : 1.1 }}
      animate={accepted
        ? {
            opacity: 1,
            x: [0, 0, 18, 18, 120, 720],
            y: [0, 0, -12, -12, -18, -52],
            scale: [1, 0.99, 1.018, 1.018, 1, 0.92],
            rotate: [0, 0, 5.5, 5.5, 8, 14],
          }
        : { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
      exit={accepted
        ? undefined
        : { opacity: 0, x: 0, y: 0, scale: 0.995, rotate: 0, transition: { duration: 0.08 } }}
      transition={accepted
        ? {
            duration: SWIPE_MOTION_DURATION_SECONDS,
            times: [0, 0.2, 0.43, 0.61, 0.76, 1],
            ease: [0.22, 0.8, 0.24, 1],
          }
        : { type: "spring", stiffness: 250, damping: 24 }}
    >
      {accepted && <DecisionStamp />}

      <header className="d2c-match-card__header">
        <span className="d2c-match-card__identity">
          {isIdea ? <CreatorAvatar creator={creator} size={42} /> : <span className="d2c-match-card__anonymous"><UsersRound size={20} /></span>}
          <span>
            <small>{isIdea ? "Pauta para você" : "Possibilidade de collab"}</small>
            <b>{isIdea ? creator.name.split(" ")[0] : "Alguém também escolheu essa ideia"}</b>
          </span>
        </span>
        <span className="d2c-match-card__number">{isIdea ? "01" : "02"}</span>
      </header>

      <div className="d2c-match-card__body">
        <span className="d2c-match-card__eyebrow">{isIdea ? "Sua próxima pauta" : "Vocês podem criar juntos"}</span>
        <h3>{isIdea ? MATCH_STORY.ideaTitle : MATCH_STORY.collabTitle}</h3>
        <p>{isIdea ? MATCH_STORY.ideaBody : MATCH_STORY.collabBody}</p>
        <blockquote>{isIdea ? MATCH_STORY.ideaHook : MATCH_STORY.collabDirection}</blockquote>
      </div>

      <DecisionActions accepted={accepted} />
    </motion.article>
  );
}

function MatchReveal({ first, second, preview = false }: { first: LandingCreatorHighlight; second: LandingCreatorHighlight; preview?: boolean }) {
  const secondFirstName = second.name.split(" ")[0];

  return (
    <motion.article
      className="d2c-match-reveal"
      aria-hidden={preview || undefined}
      initial={{ opacity: 0, scale: 0.88, y: 34, borderRadius: 40 }}
      animate={{ opacity: 1, scale: 1, y: 0, borderRadius: 28 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <motion.span
        className="d2c-match-reveal__spark"
        initial={{ opacity: 0, scale: 0, rotate: -25 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 290, damping: 15, delay: 0.34 }}
        aria-hidden="true"
      >
        <Sparkles size={26} />
      </motion.span>

      <div className="d2c-match-reveal__portraits" aria-label={`${first.name} e ${second.name}`}>
        <motion.div initial={{ opacity: 0, x: -80 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.16 }}>
          <CreatorAvatar creator={first} size={132} />
          <span>{first.name.split(" ")[0]}</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.22 }}>
          <CreatorAvatar creator={second} size={132} />
          <span>{secondFirstName}</span>
        </motion.div>
      </div>

      <motion.div className="d2c-match-reveal__copy" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, delay: 0.4 }}>
        <span>É um match</span>
        <h3>Essa ideia tinha<br />a cara dos dois.</h3>
        <p>Você e {secondFirstName}, pela mesma pauta.</p>
        <blockquote>“{MATCH_STORY.ideaTitle}”</blockquote>
        <strong className="d2c-match-reveal__conclusion">Agora vocês já sabem com quem criar — e por onde começar.</strong>
        {!preview && (
          <LandingAuthCta
            className="d2c-match-reveal__cta"
            guestLabel="Quero dar match criativo"
            childrenAfter={<ArrowRight size={17} aria-hidden="true" />}
            trackingLocation="collabs"
          />
        )}
      </motion.div>
    </motion.article>
  );
}

function MutualInterest({ first, preview = false }: { first: LandingCreatorHighlight; preview?: boolean }) {
  return (
    <motion.article
      className="d2c-match-mutual"
      aria-hidden={preview || undefined}
      initial={{ opacity: 0, scale: 0.92, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.04, y: -14 }}
      transition={{ duration: 0.5, ease: [0.22, 0.8, 0.28, 1] }}
    >
      <HeartHandshake size={28} aria-hidden="true" />
      <div className="d2c-match-mutual__people" aria-label="Duas pessoas escolheram criar a mesma ideia">
        <CreatorAvatar creator={first} size={96} />
        <span><UsersRound size={30} aria-hidden="true" /></span>
      </div>
      <p>Interesse dos dois lados</p>
      <h3>Mais alguém também escolheu essa ideia.</h3>
      <span>A identidade aparece agora.</span>
    </motion.article>
  );
}

function SwipeTransition({
  outgoing,
  creator,
  first,
}: {
  outgoing: "idea" | "collab";
  creator: LandingCreatorHighlight;
  first: LandingCreatorHighlight;
}) {
  return (
    <div className="d2c-match-swipe-transition">
      <motion.div
        className="d2c-match-swipe-transition__incoming"
        initial={{ opacity: 0.24, scale: 0.955, y: 20, rotate: -1.5 }}
        animate={{ opacity: [0.24, 0.24, 1], scale: [0.955, 0.955, 1], y: [20, 20, 0], rotate: [-1.5, -1.5, 0] }}
        transition={{ duration: SWIPE_MOTION_DURATION_SECONDS, times: [0, 0.6, 1], ease: [0.22, 0.8, 0.28, 1] }}
      >
        {outgoing === "idea"
          ? <StoryCard kind="collab" creator={creator} accepted={false} preview />
          : <MutualInterest first={first} preview />}
      </motion.div>
      <div className="d2c-match-swipe-transition__outgoing">
        <StoryCard kind={outgoing} creator={creator} accepted />
      </div>
    </div>
  );
}

export function NarrativeMatch({ creators }: { creators: LandingCreatorHighlight[] }) {
  const storyRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const isInView = useInView(storyRef, { amount: 0.5 });
  const first = creators[0] ?? FALLBACK_LANDING_CREATORS[0]!;
  const second = creators[1] ?? FALLBACK_LANDING_CREATORS[1]!;
  const [scene, setScene] = useState<MatchScene>("idea");
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (reducedMotion || !isInView || hasStarted) return;
    setHasStarted(true);
  }, [hasStarted, isInView, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !isInView || !hasStarted || scene === "match") return;

    const timer = window.setTimeout(() => {
      const nextScene = MATCH_SCENES[MATCH_SCENES.indexOf(scene) + 1] ?? "match";
      setScene(nextScene);
    }, MATCH_SCENE_DURATIONS[scene]);

    return () => window.clearTimeout(timer);
  }, [hasStarted, isInView, reducedMotion, scene]);

  const replay = () => {
    setScene("idea");
    setHasStarted(true);
  };

  const visibleScene: MatchScene = reducedMotion ? "match" : scene;
  const sceneIndex = MATCH_SCENES.indexOf(visibleScene);

  return (
    <div ref={storyRef} className={`d2c-match-experience${reducedMotion ? " is-static" : ""}`}>
      <div className="d2c-match-stage" aria-label="Demonstração automática do match criativo">
        <div className="d2c-match-stage__progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(0.12, (sceneIndex + 1) / 6)})` }} />
        </div>
        <p className="d2c-match-stage__status" aria-live="polite">{SCENE_LABELS[visibleScene]}</p>

        <div className={`d2c-match-stage__canvas is-${visibleScene}`}>
          <AnimatePresence mode="sync" initial={false}>
            {visibleScene === "idea" && <StoryCard key="idea" kind="idea" creator={first} accepted={false} />}
            {visibleScene === "ideaAccepted" && <SwipeTransition key="idea-accepted" outgoing="idea" creator={first} first={first} />}
            {visibleScene === "collab" && <StoryCard key="collab" kind="collab" creator={first} accepted={false} />}
            {visibleScene === "collabAccepted" && <SwipeTransition key="collab-accepted" outgoing="collab" creator={first} first={first} />}
            {visibleScene === "mutual" && <MutualInterest key="mutual" first={first} />}
            {visibleScene === "match" && <MatchReveal key="match" first={first} second={second} />}
          </AnimatePresence>
        </div>

        {!reducedMotion && visibleScene === "match" && (
          <button className="d2c-match-stage__replay" type="button" onClick={replay}>
            <RotateCcw size={14} aria-hidden="true" /> Ver novamente
          </button>
        )}
      </div>
    </div>
  );
}
