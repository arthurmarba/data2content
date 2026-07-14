"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const CALCULATOR_STAGES = [
  "delivery",
  "protection",
  "context",
  "history",
  "calculating",
  "result",
  "saved",
] as const;

export const CALCULATOR_STAGE_DURATIONS = [1800, 1800, 1800, 1700, 1100, 3300] as const;

type CalculatorStage = (typeof CALCULATOR_STAGES)[number];

const STAGE_META: Record<CalculatorStage, { step: number; title: string; status: string; cta: string }> = {
  delivery: { step: 1, title: "Entrega", status: "Montando a entrega", cta: "Continuar" },
  protection: { step: 2, title: "Uso e proteção", status: "Definindo direitos", cta: "Continuar" },
  context: { step: 3, title: "Contexto da parceria", status: "Ajustando o contexto", cta: "Continuar" },
  history: { step: 4, title: "Seu histórico de preço", status: "Usando sua referência", cta: "Ver meu valor" },
  calculating: { step: 5, title: "Valor sugerido", status: "Calculando sua faixa", cta: "Calculando..." },
  result: { step: 5, title: "Valor sugerido", status: "Seu valor está pronto", cta: "Adicionar ao Media Kit" },
  saved: { step: 5, title: "Valor sugerido", status: "Salvo no Media Kit", cta: "Adicionado ao Media Kit" },
};

export function NarrativeCalculator() {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = Boolean(useReducedMotion());
  const isInView = useInView(ref, { amount: 0.35 });
  const [activeIndex, setActiveIndex] = useState(0);
  const stage = reducedMotion ? CALCULATOR_STAGES.at(-1)! : CALCULATOR_STAGES[activeIndex]!;
  const meta = STAGE_META[stage];
  const isComplete = activeIndex === CALCULATOR_STAGES.length - 1;

  useEffect(() => {
    if (reducedMotion || !isInView || isComplete) return;

    let timer: number;
    const advance = () => {
      timer = window.setTimeout(() => {
        if (document.visibilityState !== "visible") {
          advance();
          return;
        }
        setActiveIndex((current) => Math.min(current + 1, CALCULATOR_STAGES.length - 1));
      }, document.visibilityState === "visible" ? CALCULATOR_STAGE_DURATIONS[activeIndex]! : 500);
    };

    advance();
    return () => window.clearTimeout(timer);
  }, [activeIndex, isComplete, isInView, reducedMotion]);

  const replay = () => setActiveIndex(0);

  return (
    <section ref={ref} className="d2c-calculator-story" data-landing-section="calculator">
      <div className="d2c-shell d2c-calculator-story__inner">
        <div className="d2c-calculator-story__copy">
          <p>Do conteúdo ao valor</p>
          <h2>Quanto cobrar deixa de ser um chute.</h2>
          <span>A Calculadora de Publi considera entrega, alcance, direitos e contexto da marca — e transforma o resultado em pacote no seu Media Kit.</span>
          <small>Calculadora de Publi e Media Kit incluídos no plano D2C.</small>
        </div>

        <div className={`d2c-calculator-demo${reducedMotion ? " is-static" : ""}`} aria-label="Demonstração da Calculadora de Publi no app mobile">
          <p className="sr-only">A calculadora percorre cinco etapas do app, combina entrega, direitos, contexto e histórico, e recomenda os valores mínimo, justo e máximo.</p>

          <header className="d2c-calculator-demo__appbar" aria-hidden="true">
            <span><BriefcaseBusiness size={17} /><strong>Calculadora de Publi</strong></span>
            <small>Como no app</small>
          </header>

          <div className="d2c-calculator-demo__canvas" aria-hidden="true">
            <motion.div
              className="d2c-calculator-sheet"
              initial={reducedMotion ? false : { opacity: 0, y: 34, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.58, ease: [0.22, 0.8, 0.28, 1] }}
            >
              <header className="d2c-calculator-sheet__header">
                <i className="d2c-calculator-sheet__handle" />
                <div className="d2c-calculator-sheet__heading">
                  <span className={`d2c-calculator-sheet__back${meta.step > 1 ? " is-visible" : ""}`}><ArrowLeft size={13} /></span>
                  <div>
                    <small>Etapa {meta.step} de 5</small>
                    <h3>{meta.title}</h3>
                  </div>
                  <span className="d2c-calculator-sheet__close"><X size={13} /></span>
                </div>
                <div className="d2c-calculator-sheet__progress">
                  {[1, 2, 3, 4, 5].map((step) => <i key={step} className={meta.step >= step ? "is-active" : undefined} />)}
                </div>
              </header>

              <main className="d2c-calculator-sheet__body">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={stage} className={`d2c-calculator-stage is-${stage}`} {...stageMotion}>
                    {stage === "delivery" && <DeliveryStep />}
                    {stage === "protection" && <ProtectionStep />}
                    {stage === "context" && <ContextStep />}
                    {stage === "history" && <HistoryStep />}
                    {stage === "calculating" && <CalculatingStep />}
                    {(stage === "result" || stage === "saved") && <ResultStep saved={stage === "saved"} />}
                  </motion.div>
                </AnimatePresence>
              </main>

              <footer className="d2c-calculator-sheet__footer">
                <span className={`d2c-calculator-sheet__cta${stage === "calculating" || stage === "saved" ? " is-disabled" : ""}${stage === "calculating" ? " is-loading" : ""}`}>
                  {stage === "calculating" && <LoaderCircle size={14} />}
                  {stage === "saved" && <Check size={14} />}
                  {meta.cta}
                  {!["calculating", "saved"].includes(stage) && <ArrowRight size={14} />}
                </span>
              </footer>
            </motion.div>
          </div>

          <footer className="d2c-calculator-demo__status">
            <span>{meta.status}</span>
            {!reducedMotion && isComplete && (
              <button type="button" onClick={replay}><RotateCcw size={13} /> Ver novamente</button>
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}

function DeliveryStep() {
  return (
    <div className="d2c-calculator-mobile-step">
      <div className="d2c-calculator-reach"><span>Alcance usado no cálculo</span><strong>185 mil pessoas</strong></div>
      <div className="d2c-calculator-quantities">
        <Quantity label="Reels" value="1" />
        <Quantity label="Stories" value="3" active />
        <Quantity label="Post" value="0" muted />
      </div>
    </div>
  );
}

function Quantity({ label, value, active = false, muted = false }: { label: string; value: string; active?: boolean; muted?: boolean }) {
  return (
    <div className={`d2c-calculator-quantity${active ? " is-active" : ""}${muted ? " is-muted" : ""}`}>
      <strong>{label}</strong>
      <span><i><Minus size={11} /></i><b>{value}</b><i className="is-plus"><Plus size={11} /></i></span>
    </div>
  );
}

function ProtectionStep() {
  return (
    <div className="d2c-calculator-mobile-step">
      <p className="d2c-calculator-helper">Defina como a marca pode usar seu conteúdo e imagem.</p>
      <Field label="Uso pela marca"><Choice label="Orgânico" /><Choice label="Mídia paga" selected /><Choice label="Uso global" /></Field>
      <Field label="Duração de uso"><Choice label="7 dias" /><Choice label="15 dias" /><Choice label="30 dias" selected /><Choice label="90 dias" /></Field>
      <Field label="Exclusividade"><Choice label="Sem" /><Choice label="7 dias" /><Choice label="15 dias" selected /><Choice label="30 dias" /></Field>
    </div>
  );
}

function ContextStep() {
  return (
    <div className="d2c-calculator-mobile-step">
      <p className="d2c-calculator-helper">Considere a marca e como o conteúdo será distribuído.</p>
      <Field label="Distribuição" stacked>
        <Toggle label="Collab no Instagram" active />
        <Toggle label="Repost no TikTok" />
      </Field>
      <Field label="Porte da marca"><Choice label="Pequena" /><Choice label="Média" selected /><Choice label="Grande" /></Field>
      <Field label="Risco de imagem"><Choice label="Baixo" selected /><Choice label="Médio" /><Choice label="Alto" /></Field>
    </div>
  );
}

function HistoryStep() {
  return (
    <div className="d2c-calculator-mobile-step">
      <div className="d2c-calculator-history-intro"><strong>Você já tem um valor habitual?</strong><p>Ele é uma referência pessoal; direitos e contexto continuam sendo calculados.</p></div>
      <div className="d2c-calculator-history-choice is-selected">
        <span><strong>Usar meu valor habitual</strong><small>R$ 1.500 por 1 Reel orgânico</small></span><Check size={15} />
      </div>
      <div className="d2c-calculator-history-choice">
        <span><strong>Prefiro só a sugestão</strong><small>Usar somente métricas, escopo e contexto.</small></span>
      </div>
    </div>
  );
}

function CalculatingStep() {
  return (
    <div className="d2c-calculator-calculating">
      <div><LoaderCircle size={22} /><strong>Calculando sua faixa</strong></div>
      <p>Combinando métricas, escopo, contexto e seu histórico.</p>
      <span><i /><i /><i /></span>
    </div>
  );
}

function ResultStep({ saved }: { saved: boolean }) {
  return (
    <div className="d2c-calculator-result">
      <p>Para 1 Reels · 3 Stories · Mídia paga · marca média</p>
      <div className="d2c-calculator-result__range">
        <div className="is-minimum"><small>Mínimo</small><strong>R$ 2.400</strong></div>
        <div className="is-fair"><small>Justo</small><strong>R$ 2.800</strong><span>Valor recomendado</span></div>
        <div className="is-maximum"><small>Máximo</small><strong>R$ 3.400</strong></div>
      </div>
      <div className="d2c-calculator-result__proof"><span>Alcance considerado</span><strong>185 mil pessoas · 8 conteúdos</strong></div>
      {saved && <div className="d2c-calculator-result__saved"><Check size={14} /><span><strong>Pacote salvo no Media Kit</strong><small>Pronto para apresentar às marcas.</small></span></div>}
    </div>
  );
}

function Field({ label, children, stacked = false }: { label: string; children: ReactNode; stacked?: boolean }) {
  return <div className={`d2c-calculator-field${stacked ? " is-stacked" : ""}`}><small>{label}</small><div>{children}</div></div>;
}

function Choice({ label, selected = false }: { label: string; selected?: boolean }) {
  return <span className={`d2c-calculator-choice${selected ? " is-selected" : ""}`}>{selected && <Check size={10} />}{label}</span>;
}

function Toggle({ label, active = false }: { label: string; active?: boolean }) {
  return <span className="d2c-calculator-toggle"><b>{label}</b><i className={active ? "is-active" : undefined}><em /></i></span>;
}

const stageMotion = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -14 },
  transition: { duration: 0.34, ease: [0.22, 0.8, 0.28, 1] },
} as const;
