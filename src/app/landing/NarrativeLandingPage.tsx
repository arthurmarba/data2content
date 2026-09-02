import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { bricolageGrotesque, instrumentSans } from "@/app/fonts/d2cFonts";
import type { LandingCreatorHighlight, LandingProofMetrics } from "@/types/landing";

import "./narrative-landing.css";
import "./narrative-landing-v6.css";

import { Brand } from "./components/narrative/Brand";
import { LandingAuthCta } from "./components/narrative/LandingAuthCta";
import { LandingMobileCta } from "./components/narrative/LandingMobileCta";
import { LandingSectionTracker } from "./components/narrative/LandingSectionTracker";
import { NarrativeHeader } from "./components/narrative/NarrativeHeader";
import { ClaudeConnection } from "./components/narrative/v6/ClaudeConnection";
import { FirstAnswer } from "./components/narrative/v6/FirstAnswer";
import { HeroV6 } from "./components/narrative/v6/HeroV6";
import { HowItWorks } from "./components/narrative/v6/HowItWorks";
import { RevealOnScroll } from "./components/narrative/v6/RevealOnScroll";
import { SecondAnswer } from "./components/narrative/v6/SecondAnswer";
import { WhoLeads } from "./components/narrative/v6/WhoLeads";

const formatDecimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/* O selo do herói alterna entre as três provas agregadas da comunidade — são
   as mesmas que antes ocupavam uma seção inteira e agora cabem na primeira
   dobra. Tudo sai de número real: se a métrica não vier, aquela linha não
   entra, e sem nenhuma o selo some. Placeholder aqui seria número falso na
   primeira coisa que o visitante lê. */
function buildStatLines(proofMetrics: LandingProofMetrics | null) {
  if (!proofMetrics) return [];

  const lines: string[] = [];
  const thousands = Math.floor(proofMetrics.contentAnalyzed / 1_000);
  if (thousands >= 1) lines.push(`+${formatDecimal(thousands)} mil conteúdos já assistidos pela nossa IA`);

  const millionViews = Math.floor(proofMetrics.viewsAnalyzed / 1_000_000);
  if (millionViews >= 1) lines.push(`${formatDecimal(millionViews)} mi visualizações compreendidas`);

  const millionInteractions = Math.floor(proofMetrics.interactionsAnalyzed / 1_000_000);
  if (millionInteractions >= 1) lines.push(`${formatDecimal(millionInteractions)} mi interações que viraram aprendizado`);

  return lines;
}

const PLAN_INCLUDES = [
  "Central de Publis do mercado inteiro",
  "Relatório de tendências toda semana",
  "Participação nas reuniões ao vivo",
  "Seu conteúdo analisado nas reuniões",
  "Conexão com o Claude",
  "Mapa, pautas, Media Kit e Calculadora de Publi",
  "Grupo exclusivo de assinantes",
];

const FAQ = [
  {
    q: "Criar uma conta é gratuito?",
    a: "Sim. Criar a conta e entrar na plataforma não custa nada. O relatório semanal, as reuniões ao vivo e a análise do seu conteúdo são para quem assina.",
  },
  {
    q: "O que encontro no relatório semanal?",
    a: "O que funcionou na semana: assuntos, falas, cenários, formatos e como o público reagiu. Tudo separado por tema e escrito como sugestão para você testar.",
  },
  {
    q: "Seguir tendência é copiar os outros?",
    a: "Não. A D2C mostra onde cada tendência está funcionando e ajuda você a adaptar isso ao seu jeito e aos seus objetivos.",
  },
  {
    q: "Como faço para ter meu conteúdo analisado?",
    a: "Assine a D2C e confirme sua presença no grupo de assinantes. Quem confirma entra na análise daquela reunião.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você pode pedir o cancelamento a qualquer momento, conforme as condições do plano.",
  },
];

type NarrativeLandingPageProps = {
  creators: LandingCreatorHighlight[];
  proofMetrics: LandingProofMetrics | null;
  communityCreators: LandingCreatorHighlight[];
};

export function NarrativeLandingPage({ proofMetrics, communityCreators }: NarrativeLandingPageProps) {
  return (
    <div
      className={`d2c-landing d2c-human-landing d2c-v6 ${instrumentSans.variable} ${bricolageGrotesque.variable}`}
    >
      <NarrativeHeader />
      <LandingSectionTracker />
      <LandingMobileCta />
      <RevealOnScroll />

      <main>
        <HeroV6 creators={communityCreators} statLines={buildStatLines(proofMetrics)} />
        <HowItWorks />
        <FirstAnswer />
        <SecondAnswer />
        <ClaudeConnection />
        <WhoLeads />

        <section className="d2c-v6-section d2c-v6-plan" id="planos" data-landing-section="pricing">
          <div className="d2c-v6-shell d2c-v6-plan__inner d2c-v6-reveal">
            <div className="d2c-v6-plan__offer">
              <span className="d2c-v6-label">a assinatura</span>
              <h2 className="d2c-v6-title">
                Uma pauta e uma publi por semana. <span className="d2c-v6-answer__soft">R$ 97 por mês.</span>
              </h2>
              <LandingAuthCta
                className="d2c-button d2c-button--human"
                guestLabel="Criar conta"
                authenticatedLabel="Assinar o Plano Pro"
                destination="/dashboard/billing"
                childrenAfter={<ArrowRight size={17} aria-hidden="true" />}
                trackingLocation="pricing"
              />
              <small className="d2c-v6-plan__note">
                Primeiro mês grátis com o cupom <b>d2cVIP</b>. Cancele quando quiser.
              </small>
            </div>

            <div className="d2c-v6-plan__includes">
              <span className="d2c-v6-label">o que está incluso</span>
              <ul>
                {PLAN_INCLUDES.map((item) => (
                  <li key={item}>
                    <Check size={15} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="d2c-v6-section d2c-v6-section--cream d2c-v6-faq" data-landing-section="faq">
          <div className="d2c-v6-shell">
            <div className="d2c-v6-head d2c-v6-reveal">
              <span className="d2c-v6-label">sem letra miúda</span>
              <h2 className="d2c-v6-title">O que é grátis e o que é pago.</h2>
            </div>
            <div className="d2c-v6-faq__list d2c-v6-reveal">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="d2c-v6-section d2c-v6-section--dark d2c-v6-close">
          <div className="d2c-v6-shell d2c-v6-close__inner d2c-v6-reveal">
            <h2 className="d2c-v6-title">
              Toda semana, uma pauta e uma publi. <span className="d2c-v6-close__soft">Sem achismo.</span>
            </h2>
            <LandingAuthCta
              className="d2c-button d2c-button--human"
              guestLabel="Criar minha conta grátis"
              authenticatedLabel="Acessar a D2C"
              childrenAfter={<ArrowRight size={17} aria-hidden="true" />}
              trackingLocation="final"
            />
            <small className="d2c-v6-close__note">
              Primeiro mês grátis com o cupom <b>d2cVIP</b> · depois R$ 97/mês
            </small>
          </div>
        </section>
      </main>

      <footer className="d2c-footer">
        <div className="d2c-shell d2c-footer__inner">
          <Brand />
          <p>Inteligência para enxergar. Plataforma para agir.</p>
          <nav aria-label="Links legais">
            <a href="mailto:arthur@data2content.ai">Suporte</a>
            <Link href="/politica-de-privacidade">Privacidade</Link>
            <Link href="/termos-e-condicoes">Termos</Link>
          </nav>
          <small>© {new Date().getFullYear()} Data2Content.</small>
        </div>
      </footer>
    </div>
  );
}
