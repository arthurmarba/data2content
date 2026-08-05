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
              <p>Conteúdo real · sinais reais</p>
              <h3>A metodologia que, toda semana, ajuda centenas de criadores a saber o que postar e alcançar milhões de visualizações.</h3>
            </div>
            <CommunityCreatorShowcase creators={communityCreators} />
            <p className="d2c-match-community__proof">
              Os perfis exibidos estão ativos na comunidade. Cada retrato abre o Media Kit público do creator.
            </p>
          </div>
        </section>

        {proofMetrics && (
          <section className="d2c-data-proof" aria-labelledby="data-proof-title" data-landing-section="data-proof">
            <div className="d2c-shell d2c-data-proof__intro">
              <p>Inteligência alimentada por sinais reais</p>
              <h2 id="data-proof-title">Cada conteúdo deixa sinais. A D2C aprende com eles.</h2>
              <span>A tecnologia organiza milhares de conteúdos e interações. A leitura humana transforma padrões em hipóteses, tendências e decisões.</span>
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
            <p>Quem interpreta a inteligência</p>
            <h2>Dados mostram o movimento. Repertório dá sentido.</h2>
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
            <p>Arthur lê os sinais da criação. Ronaldo conecta conteúdo, cultura e negócio. Toda semana, os dois transformam os achados do relatório em uma conversa aplicável.</p>
          </div>
        </section>

        <WeeklyRitual />

        <section className="d2c-match-section d2c-human-match" id="collabs" data-landing-section="collabs">
          <div className="d2c-shell d2c-match-section__inner">
            <div className="d2c-match-section__copy">
              <p className="d2c-section-label">Tendência aplicada à criação</p>
              <h2>Quando uma tendência encontra duas narrativas.</h2>
              <p>Uma pauta sugerida pela inteligência pode aproximar creators que enxergam oportunidade no mesmo assunto.</p>
            </div>
            <NarrativeMatch creators={creators} />
          </div>
        </section>

        <section className="d2c-human-pricing" id="planos" data-landing-section="pricing">
          <div className="d2c-shell d2c-human-pricing__inner">
            <div><p>A inteligência completa</p><h2>Inteligência nova toda semana. Direção para todos os dias.</h2></div>
            <div className="d2c-human-final__offer">
              <b>{LANDING_PLAN_PRICE_DISPLAY}<small>/mês</small></b>
              <ul>
                <li><Check size={15} /> Relatório completo de tendências toda semana</li>
                <li><Check size={15} /> Participação nas reuniões ao vivo</li>
                <li><Check size={15} /> Análise e direcionamento para assinantes</li>
                <li><Check size={15} /> Mapa, pautas, matches, Media Kit e Calculadora de Publi</li>
                <li><Check size={15} /> Grupo exclusivo de assinantes</li>
              </ul>
              <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar conta para assinar" authenticatedLabel="Assinar o Plano Pro" destination="/dashboard/billing" childrenAfter={<ArrowRight size={17} />} trackingLocation="pricing" />
              <small className="d2c-human-pricing__note">Criar a conta é grátis. Cancele a assinatura quando quiser.</small>
            </div>
          </div>
        </section>

        <section className="d2c-human-faq" data-landing-section="faq">
          <div className="d2c-shell d2c-human-faq__inner">
            <div><p>Sem letra miúda</p><h2>Como a conta gratuita e a assinatura funcionam.</h2></div>
            <div className="d2c-human-faq__list">
              <details><summary>Criar uma conta é gratuito?</summary><p>Sim. Você pode criar sua conta e entrar na plataforma gratuitamente. O relatório semanal, as reuniões ao vivo e a análise de conteúdo são exclusivos para assinantes.</p></details>
              <details><summary>Posso participar da reunião sem assinar?</summary><p>Não. As reuniões semanais fazem parte da assinatura D2C e acontecem às quintas-feiras, das 19h às 21h.</p></details>
              <details><summary>O que encontro no relatório semanal?</summary><p>Achados sobre assuntos, falas, cenários, formatos, estéticas e respostas da audiência, organizados por território e transformados em hipóteses para testar.</p></details>
              <details><summary>O relatório serve para criadores e marcas?</summary><p>Sim. A inteligência ajuda quem usa conteúdo para crescer, engajar, vender, atrair publicidade ou criar comunidade — seja creator, profissional ou marca.</p></details>
              <details><summary>Tendência significa copiar um formato?</summary><p>Não. A D2C mostra onde cada sinal funciona e ajuda você a interpretar o movimento dentro da sua narrativa e dos seus objetivos.</p></details>
              <details><summary>Como faço para ter meu conteúdo analisado?</summary><p>Assine o D2C Pro e confirme sua participação pelos canais exclusivos de assinantes. Quem confirma presença entra nas análises daquela reunião.</p></details>
              <details><summary>Posso cancelar quando quiser?</summary><p>O cancelamento pode ser solicitado a qualquer momento, conforme as condições do plano vigente.</p></details>
            </div>
          </div>
        </section>

        <section className="d2c-human-final">
          <div className="d2c-shell d2c-human-final__inner">
            <div>
              <h2>Conteúdo muda toda semana. <span>Sua direção também pode evoluir.</span></h2>
            </div>
            <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar minha conta grátis" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={17} />} trackingLocation="final" />
          </div>
        </section>
      </main>

      <footer className="d2c-footer">
        <div className="d2c-shell d2c-footer__inner">
          <Brand />
          <p>Inteligência para enxergar. Plataforma para agir.</p>
          <nav aria-label="Links legais"><a href="mailto:arthur@data2content.ai">Suporte</a><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-e-condicoes">Termos</Link></nav>
          <small>© {new Date().getFullYear()} Data2Content.</small>
        </div>
      </footer>
    </div>
  );
}
