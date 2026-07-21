import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { bricolageGrotesque, instrumentSans } from "@/app/fonts/d2cFonts";
import { LANDING_PLAN_PRICE_DISPLAY } from "@/app/landing/copy";
import type { LandingCreatorHighlight, LandingProofMetrics } from "@/types/landing";

import "./narrative-landing.css";

import { Brand } from "./components/narrative/Brand";
import { CommunityCreatorShowcase } from "./components/narrative/CommunityCreatorShowcase";
import { LandingAuthCta } from "./components/narrative/LandingAuthCta";
import { LandingMobileCta } from "./components/narrative/LandingMobileCta";
import { LandingSectionTracker } from "./components/narrative/LandingSectionTracker";
import { NarrativeHeader } from "./components/narrative/NarrativeHeader";
import { NarrativeHero } from "./components/narrative/NarrativeHero";
import { NarrativeMatch } from "./components/narrative/NarrativeMatch";
import { WeeklyRitual } from "./components/narrative/WeeklyRitual";
import { WhatsAppCommunity } from "./components/narrative/WhatsAppCommunity";

const formatDecimal = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function formatHistoricalProof(value: number, kind: "content" | "views" | "interactions") {
  if (kind === "content") return `${formatDecimal(Math.floor(value / 100) / 10)} mil`;
  if (kind === "views") return `${Math.floor(value / 10_000_000) * 10} milhões`;
  return `${Math.floor(value / 1_000_000)} milhões`;
}

type NarrativeLandingPageProps = {
  creators: LandingCreatorHighlight[];
  proofMetrics: LandingProofMetrics | null;
  communityCreators: LandingCreatorHighlight[];
};

export function NarrativeLandingPage({ creators, proofMetrics, communityCreators }: NarrativeLandingPageProps) {
  return (
    <div className={`d2c-landing d2c-human-landing ${instrumentSans.variable} ${bricolageGrotesque.variable}`}>
      <NarrativeHeader />
      <LandingSectionTracker />
      <LandingMobileCta />
      <main>
        <NarrativeHero />

        <section className="d2c-human-community-block" id="comunidade" data-landing-section="community">
          <div className="d2c-shell d2c-match-community">
            <div className="d2c-match-community__intro">
              <p>Quem já está criando junto</p>
              <h3>Uma comunidade de creators, não uma plateia.</h3>
            </div>
            <CommunityCreatorShowcase creators={communityCreators} />
            <p className="d2c-match-community__proof">
              Todos os perfis exibidos estão ativos na comunidade. Cada retrato abre o Media Kit público do creator.
            </p>
          </div>
        </section>

        {proofMetrics && (
          <section className="d2c-data-proof" aria-labelledby="data-proof-title" data-landing-section="data-proof">
            <div className="d2c-shell d2c-data-proof__intro">
              <p>Experiência alimentada por sinais reais</p>
              <h2 id="data-proof-title">Tem dado. Tem gente. Tem contexto.</h2>
              <span>A tecnologia organiza os sinais. O repertório humano transforma esses sinais em direção.</span>
            </div>
            <dl className="d2c-shell d2c-data-proof__numbers">
              <div><dt>conteúdos analisados</dt><dd>{formatHistoricalProof(proofMetrics.contentAnalyzed, "content")}</dd></div>
              <div><dt>visualizações compreendidas</dt><dd>{formatHistoricalProof(proofMetrics.viewsAnalyzed, "views")}</dd></div>
              <div><dt>interações que viraram aprendizado</dt><dd>{formatHistoricalProof(proofMetrics.interactionsAnalyzed, "interactions")}</dd></div>
            </dl>
            <p className="d2c-shell d2c-data-proof__note">Dados agregados e anonimizados da comunidade D2C. Os resultados pertencem aos creators acompanhados.</p>
          </section>
        )}

        <section className="d2c-founders" id="quem-conduz" data-landing-section="authority">
          <div className="d2c-shell d2c-founders__intro">
            <p>Quem conduz a reunião</p>
            <h2>Repertório de mercado, aplicado ao seu conteúdo.</h2>
          </div>
          <div className="d2c-shell d2c-founders__people">
            <article className="d2c-founder d2c-founder--arthur">
              <figure><Image src="/images/community/avatars/arthur-marba.jpg" alt="Arthur Marbá" fill sizes="(max-width: 820px) 100vw, 42vw" /></figure>
              <div>
                <span>Creators · dados · estratégia</span>
                <h3>Arthur Marbá</h3>
                <p className="d2c-founder__bio">Fundador da D2C e estrategista de creators. Há mais de uma década transforma conteúdo, dados e comportamento em direção prática.</p>
                <details className="d2c-founder__bio-disclosure"><summary>Conhecer trajetória</summary><p>Fundador da D2C e estrategista de creators. Há mais de uma década transforma conteúdo, dados e comportamento em direção prática.</p></details>
              </div>
            </article>
            <article className="d2c-founder d2c-founder--ronaldo">
              <figure><Image src="/images/community/avatars/ronaldo-fonseca-jr.jpg" alt="Ronaldo Fonseca" fill sizes="(max-width: 820px) 100vw, 42vw" /></figure>
              <div>
                <span>Narrativas · cultura · negócios</span>
                <h3>Ronaldo Fonseca</h3>
                <p className="d2c-founder__bio">Sócio da D2C e CEO da A-Lab, do Grupo Dreamers. Conecta narrativas, cultura e oportunidades de negócio.</p>
                <details className="d2c-founder__bio-disclosure"><summary>Conhecer trajetória</summary><p>Sócio da D2C e CEO da A-Lab, do Grupo Dreamers. Conecta narrativas, cultura e oportunidades de negócio.</p></details>
              </div>
            </article>
          </div>
          <div className="d2c-shell d2c-founders__synthesis">
            <p>Arthur lê os sinais da criação. Ronaldo conecta narrativa, cultura e negócio. Toda quinta, os dois colocam essa experiência na mesa.</p>
          </div>
        </section>

        <WeeklyRitual />

        <section className="d2c-match-section d2c-human-match" id="collabs" data-landing-section="collabs">
          <div className="d2c-shell d2c-match-section__inner">
            <div className="d2c-match-section__copy">
              <p className="d2c-section-label">Match criativo por pauta</p>
              <h2>Quando a direção encontra outra pessoa.</h2>
              <p>Você escolhe uma pauta. Outro creator também. O match nasce da vontade de criar a mesma ideia — não de um perfil genérico.</p>
            </div>
            <NarrativeMatch creators={creators} />
          </div>
        </section>

        <WhatsAppCommunity creators={creators} communityCreators={communityCreators} />

        <section className="d2c-human-pricing" id="planos" data-landing-section="pricing">
          <div className="d2c-shell d2c-human-pricing__inner">
            <div><p>A experiência completa</p><h2>Uma reunião por semana. Uma plataforma para os outros seis dias.</h2></div>
            <div className="d2c-human-final__offer">
              <b>{LANDING_PLAN_PRICE_DISPLAY}<small>/mês</small></b>
              <ul>
                <li><Check size={15} /> Análise garantida quando você confirma presença no grupo</li>
                <li><Check size={15} /> Grupo exclusivo de assinantes no WhatsApp</li>
                <li><Check size={15} /> Mapa, pautas e análise de conteúdo na plataforma</li>
                <li><Check size={15} /> Matches, Calculadora de Publi e Media Kit</li>
              </ul>
              <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar conta e assinar" authenticatedLabel="Ver meu plano" destination="/dashboard/billing" childrenAfter={<ArrowRight size={17} />} trackingLocation="pricing" />
              <small className="d2c-human-pricing__note">Assista gratuitamente antes de decidir. Cancele quando quiser.</small>
            </div>
          </div>
        </section>

        <section className="d2c-human-faq" data-landing-section="faq">
          <div className="d2c-shell d2c-human-faq__inner">
            <div><p>Sem letra miúda</p><h2>Como a reunião e a assinatura funcionam.</h2></div>
            <div className="d2c-human-faq__list">
              <details><summary>Posso assistir sem pagar?</summary><p>Sim. Depois do login e do onboarding, você pode assistir gratuitamente às reuniões de quinta-feira, sempre às 19h. Criar a conta não gera cobrança automática.</p></details>
              <details><summary>Como faço para ter meu conteúdo analisado?</summary><p>Assine o D2C Pro e confirme presença na reunião dentro do grupo exclusivo de assinantes no WhatsApp. Todos os assinantes que confirmam presença são analisados naquela reunião.</p></details>
              <details><summary>Quanto tempo dura a reunião?</summary><p>Ela começa às 19h e costuma durar cerca de duas horas. O acesso e a opção de salvar na agenda ficam disponíveis dentro da D2C.</p></details>
              <details><summary>O que assino além da análise ao vivo?</summary><p>Você entra no grupo exclusivo e acessa o Mapa, pautas, análise de conteúdo, matches de collab, Calculadora de Publi e Media Kit para continuar evoluindo entre as reuniões.</p></details>
              <details><summary>Preciso já ser creator profissional?</summary><p>Não. A D2C acompanha tanto quem está encontrando sua direção quanto quem já transforma conteúdo em carreira.</p></details>
              <details><summary>Posso cancelar quando quiser?</summary><p>O cancelamento pode ser solicitado a qualquer momento, conforme as condições do plano vigente.</p></details>
            </div>
          </div>
        </section>

        <section className="d2c-human-final">
          <div className="d2c-shell d2c-human-final__inner">
            <div>
              <h2>Assista primeiro. <span>Depois, decida até onde quer levar.</span></h2>
            </div>
            <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Assistir à próxima reunião" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={17} />} trackingLocation="final" />
          </div>
        </section>
      </main>

      <footer className="d2c-footer">
        <div className="d2c-shell d2c-footer__inner">
          <Brand />
          <p>Gente para enxergar. Plataforma para continuar.</p>
          <nav aria-label="Links legais"><a href="mailto:arthur@data2content.ai">Suporte</a><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-e-condicoes">Termos</Link></nav>
          <small>© {new Date().getFullYear()} Data2Content.</small>
        </div>
      </footer>
    </div>
  );
}
