import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { bricolageGrotesque, instrumentSans } from "@/app/fonts/d2cFonts";
import { LANDING_PLAN_PRICE_DISPLAY } from "@/app/landing/copy";
import type { LandingCreatorHighlight, LandingProofMetrics } from "@/types/landing";

import { Brand } from "./components/narrative/Brand";
import { CommunityCreatorShowcase } from "./components/narrative/CommunityCreatorShowcase";
import { ConnectionBridge } from "./components/narrative/ConnectionBridge";
import { CreatorManifesto } from "./components/narrative/CreatorManifesto";
import { LandingAuthCta } from "./components/narrative/LandingAuthCta";
import { LandingMobileCta } from "./components/narrative/LandingMobileCta";
import { LandingSectionTracker } from "./components/narrative/LandingSectionTracker";
import { NarrativeCalculator } from "./components/narrative/NarrativeCalculator";
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

        <section className="d2c-match-section d2c-human-match" id="como-funciona" data-landing-section="collabs">
          <div className="d2c-shell d2c-match-section__inner">
            <div className="d2c-match-section__copy">
              <p className="d2c-section-label">Match criativo por pauta</p>
              <h2>Não é sobre combinar perfis.</h2>
              <p>É sobre querer criar a mesma ideia. Você escolhe uma pauta. Outro creator também. A identidade só aparece quando existe vontade dos dois lados.</p>
            </div>
            <NarrativeMatch creators={creators} />
          </div>
        </section>

        <section className="d2c-human-community-block" id="comunidade" data-landing-section="community">
          <div className="d2c-shell d2c-match-community">
            <div className="d2c-match-community__intro">
              <p>Quem está do outro lado</p>
              <h3>Veja quem pode aparecer no seu próximo match.</h3>
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
              <p>IA com repertório de verdade</p>
              <h2 id="data-proof-title">Tem dado. Tem gente. Tem contexto.</h2>
              <span>A inteligência não chuta. Ela aprende com conteúdo real e com a resposta de audiências reais.</span>
            </div>
            <dl className="d2c-shell d2c-data-proof__numbers">
              <div><dt>conteúdos analisados</dt><dd>{formatHistoricalProof(proofMetrics.contentAnalyzed, "content")}</dd></div>
              <div><dt>visualizações compreendidas</dt><dd>{formatHistoricalProof(proofMetrics.viewsAnalyzed, "views")}</dd></div>
              <div><dt>interações que viraram aprendizado</dt><dd>{formatHistoricalProof(proofMetrics.interactionsAnalyzed, "interactions")}</dd></div>
            </dl>
            <p className="d2c-shell d2c-data-proof__note">Dados agregados e anonimizados da comunidade D2C. Os resultados pertencem aos creators acompanhados.</p>
          </section>
        )}

        <ConnectionBridge />

        <WeeklyRitual />

        <WhatsAppCommunity creators={creators} communityCreators={communityCreators} />

        <CreatorManifesto />

        <section className="d2c-founders" data-landing-section="authority">
          <div className="d2c-shell d2c-founders__intro">
            <p>Duas experiências. Uma mesma inquietação.</p>
            <h2>Criatividade de um lado. Mercado do outro. Você no centro.</h2>
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
            <p>Um entende o que acontece no meio da criação. O outro, como uma narrativa ganha valor no mundo. A D2C junta os dois.</p>
            <LandingAuthCta className="d2c-human-link" guestLabel="Começar com a D2C" childrenAfter={<ArrowRight size={16} aria-hidden="true" />} trackingLocation="authority" />
          </div>
        </section>

        <NarrativeCalculator />

        <section className="d2c-human-pricing" id="planos" data-landing-section="pricing">
          <div className="d2c-shell d2c-human-pricing__inner">
            <div><p>Tudo junto. Sem complicar.</p><h2>Plataforma, reunião e comunidade. Em um só plano.</h2></div>
            <div className="d2c-human-final__offer">
              <b>{LANDING_PLAN_PRICE_DISPLAY}<small>/mês</small></b>
              <ul>
                <li><Check size={15} /> Mapa e pautas alinhadas à sua narrativa</li>
                <li><Check size={15} /> Matches de collab</li>
                <li><Check size={15} /> Reunião semanal e comunidade no WhatsApp</li>
                <li><Check size={15} /> Calculadora de Publi e Media Kit</li>
              </ul>
              <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Quero criar com a minha cara" childrenAfter={<ArrowRight size={17} />} trackingLocation="pricing" />
              <small className="d2c-human-pricing__note">Entre com Google. Assine quando fizer sentido. Cancele quando quiser.</small>
            </div>
          </div>
        </section>

        <section className="d2c-human-faq" data-landing-section="faq">
          <div className="d2c-shell d2c-human-faq__inner">
            <div><p>Sem letra miúda</p><h2>Perguntas que fazem sentido.</h2></div>
            <div className="d2c-human-faq__list">
              <details><summary>Preciso já ser creator profissional?</summary><p>Não. A D2C ajuda tanto quem está encontrando sua direção quanto quem já transforma conteúdo em carreira.</p></details>
              <details><summary>O que acontece quando entro e quando começa a cobrança?</summary><p>Você entra com Google, conecta ou envia seus conteúdos e começa a organizar os sinais da sua narrativa. Criar a conta não gera cobrança automática: o plano é apresentado antes de qualquer assinatura.</p></details>
              <details><summary>O que recebo toda semana?</summary><p>Novas pautas, possibilidades de match e a reunião online de quinta-feira, às 19h. Depois, as conversas, referências e collabs continuam na comunidade do WhatsApp.</p></details>
              <details><summary>Como a D2C entende minha narrativa sem decidir por mim?</summary><p>A inteligência identifica temas, histórias e formas de comunicação recorrentes nos seus conteúdos. Ela apresenta contexto e possibilidades; a escolha do que representa você continua sendo sua.</p></details>
              <details><summary>A comunidade também recebe oportunidades profissionais?</summary><p>Os membros podem ter seus perfis analisados para oportunidades em parceria com a Destaque Estratégia de Imagem. A análise considera narrativa e momento de carreira, mas não garante agenciamento ou contratação.</p></details>
              <details><summary>Posso cancelar quando quiser?</summary><p>O cancelamento pode ser solicitado a qualquer momento, conforme as condições do plano vigente.</p></details>
            </div>
          </div>
        </section>

        <section className="d2c-human-final">
          <div className="d2c-shell d2c-human-final__inner">
            <div>
              <h2>O algoritmo muda. <span>Sua voz não.</span></h2>
            </div>
            <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar com a minha cara" childrenAfter={<ArrowRight size={17} />} trackingLocation="final" />
          </div>
        </section>
      </main>

      <footer className="d2c-footer">
        <div className="d2c-shell d2c-footer__inner">
          <Brand />
          <p>IA para enxergar. Gente para criar.</p>
          <nav aria-label="Links legais"><a href="mailto:arthur@data2content.ai">Suporte</a><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-e-condicoes">Termos</Link></nav>
          <small>© {new Date().getFullYear()} Data2Content.</small>
        </div>
      </footer>
    </div>
  );
}
