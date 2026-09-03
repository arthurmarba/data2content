import { creatorAdsCollectorTestUtils } from "./creatorAds";
import { influencerBrasilCollectorTestUtils } from "./influencerBrasil";
import { ninetyNineFreelasCollectorTestUtils } from "./ninetyNineFreelas";
import { playNestCollectorTestUtils } from "./playNest";
import { publicEventCallsCollectorTestUtils } from "./publicEventCalls";
import { squidCollectorTestUtils } from "./squid";

describe("public campaign collectors", () => {
  test("extracts deadline, individual range and requirements from Influencer Brasil", () => {
    const html = `
      <html><head><meta name="description" content="Provador. Categorias: Moda. Plataformas: TikTok. Formatos: Reels. Idiomas: Português. Faixa de investimento: R$ 200 a R$ 250. Período: 2026-08-28 até 2026-09-06."></head>
      <body><h1>Provador da nova coleção</h1>
      <h2>O que a marca está buscando</h2><p>Creators de moda para um provador natural.</p>
      <h3>O que você vai fazer</h3><p>Produzir 1 vídeo para TikTok.</p>
      <h3>Quem estamos procurando</h3><p>Tenham 10 mil seguidores ou mais no TikTok</p><p>Produzam conteúdo de moda</p>
      <h3>Entrega da campanha</h3><p>1 vídeo de até 1 minuto no TikTok</p>
      <h3>Cachê + peça</h3><p>Cada creator selecionado receberá</p><p>Entre R$ 200 e R$ 250 pelo conteúdo produzido</p>
      <div><dt>Prazo</dt><dd>28/08/2026 até 06/09/2026</dd></div></body></html>`;

    const opportunity = influencerBrasilCollectorTestUtils.parseOpportunity(
      html,
      { url: "https://influencerbrasil.com.br/projeto/provador", lastModified: "2026-08-28" },
      new Date("2026-08-31T18:00:00-03:00"),
    );

    expect(opportunity.applicationDeadline).toBe("2026-09-06");
    expect(opportunity.status).toBe("open");
    expect(opportunity.compensation).toMatchObject({
      type: "range",
      minimum: 200,
      maximum: 250,
      basis: "per_creator",
      confirmed: true,
    });
    expect(opportunity.requirements).toContain("Tenham 10 mil seguidores ou mais no TikTok");
    expect(opportunity.summary).toContain("Creators de moda");
  });

  test("derives Squid article URLs from the rendered public listing", () => {
    const listing = `<article class="article-sq box">
      <p class="article-info">jul. 31, 2026 - 2 min de leitura</p>
      <h2><a>Vem ser Forever Lover! Convocação geral!</a></h2>
    </article>`;

    expect(squidCollectorTestUtils.listingEntries(listing)).toEqual([
      {
        title: "Vem ser Forever Lover! Convocação geral!",
        url: "https://vidadeinfluencer.squidit.com.br/blog/vem-ser-forever-lover-convocacao-geral",
        publishedAt: "2026-07-31",
      },
    ]);
  });

  test("emits one Squid opportunity per direct application link", () => {
    const article = `<html><head><meta name="description" content="Matrix e Redken estão com campanhas abertas para creators de 18 a 35 anos com +5k seguidores."></head><body>
      <h1>Chegou a publi de haircare perfeita pra você!</h1>
      <p>Campanhas abertas para creators.</p>
      <a href="https://app.squidit.com.br/campaigns/matrix/summary">Inscreva-se para Matrix no Instagram</a>
      <a href="https://app.squidit.com.br/campaigns/redken/summary">Inscreva-se para Redken no TikTok</a>
    </body></html>`;

    const opportunities = squidCollectorTestUtils.parseArticle(
      article,
      "https://vidadeinfluencer.squidit.com.br/blog/haircare",
      new Date("2026-08-31T18:00:00-03:00"),
      "2026-07-03",
    );

    expect(opportunities).toHaveLength(2);
    expect(opportunities.map((item) => item.brand)).toEqual(["Matrix", "Redken"]);
    expect(opportunities.map((item) => item.platforms[0])).toEqual(["Instagram", "TikTok"]);
    expect(opportunities.every((item) => item.opportunityType === "open_application")).toBe(true);
  });

  test("keeps only campaign calls from the Creator Ads public link page", () => {
    const html = `<main>
      <a href="https://link.creatorads.io/sxsw" aria-label="Vote no nosso painel no SXSW" data-testid="LinkClickTriggerLink"></a>
      <a href="https://link.creatorads.io/cocacola-linktree" aria-label="Quer fazer uma campanha de Coca-Cola? Se cadastra aqui!" data-testid="LinkClickTriggerLink"></a>
      <a href="https://link.creatorads.io/betmgm-linktree" aria-label="Participe da seleção da campanha de Bet MGM!" data-testid="LinkClickTriggerLink"></a>
      <a href="https://link.creatorads.io/cadastro" aria-label="Cadastre-se aqui" data-testid="LinkClickTriggerLink"></a>
    </main>`;

    const links = creatorAdsCollectorTestUtils.publicCallLinks(html);

    expect(links).toEqual([
      {
        title: "Quer fazer uma campanha de Coca-Cola? Se cadastra aqui!",
        url: "https://link.creatorads.io/cocacola-linktree",
      },
      {
        title: "Participe da seleção da campanha de Bet MGM!",
        url: "https://link.creatorads.io/betmgm-linktree",
      },
    ]);
  });

  test("classifies the public Casas Bahia recruitment as a creator program", () => {
    const html = `<main>
      <h1>Acelera CB</h1>
      <p>Inscreva-se na pré-seleção de criadores:</p>
      <a href="/acelera-casas-bahia/login?recruitmentFormId=abc">Inscreva-se</a>
    </main>`;

    const opportunity = playNestCollectorTestUtils.parseAcelera(
      html,
      new Date("2026-08-31T18:00:00-03:00"),
    );

    expect(opportunity.opportunityType).toBe("creator_program");
    expect(opportunity.status).toBe("uncertain");
    expect(opportunity.applicationUrl).toBe(
      "https://business.playnest.com.br/acelera-casas-bahia/login?recruitmentFormId=abc",
    );
  });

  test("marks the 2026 Convocados intake as closed after its public deadline", () => {
    const html = `<main>
      <p>INSCRIÇÕES ATÉ 30/04/2026</p>
      <a href="/inscricao">INSCREVA-SE AGORA</a>
    </main>`;

    const opportunity = playNestCollectorTestUtils.parseConvocados(
      html,
      new Date("2026-08-31T18:00:00-03:00"),
    );

    expect(opportunity.applicationDeadline).toBe("2026-04-30");
    expect(opportunity.status).toBe("closed");
  });

  test("Creator Ads: identifica a marca pelo slug do link, não pelo texto do botão", () => {
    const { brandSlug, opportunityFromLink } = creatorAdsCollectorTestUtils;

    expect(brandSlug("https://link.creatorads.io/cocacola-linktree")).toBe("cocacola");
    // Slug de cadastro geral não vira marca.
    expect(brandSlug("https://link.creatorads.io/pg7-linktree")).toBeNull();

    const nova = opportunityFromLink(
      { title: "Participe da seleção da campanha!", url: "https://link.creatorads.io/nivea-linktree" },
      new Date("2026-08-31T18:00:00-03:00"),
    );
    // Marca desconhecida é reconhecida sem precisar mexer no código.
    expect(nova.brand).toBe("Nivea");
    expect(nova.title).toBe("Nivea - seleção pública de creators");
  });

  test("Creator Ads: chamada sem página própria explica que a seleção é por cadastro", () => {
    const generica = creatorAdsCollectorTestUtils.opportunityFromLink(
      { title: "Campanha para homens do Nordeste, se cadastra!", url: "https://link.creatorads.io/pg7-linktree" },
      new Date("2026-08-31T18:00:00-03:00"),
    );

    expect(generica.brand).toBeNull();
    // A chamada continua valendo: o cadastro é a porta da seleção, não um beco sem saída.
    expect(generica.summary).toContain("se for escolhido, recebe a campanha por e-mail");
    expect(generica.evidence).toContainEqual({
      field: "destino",
      excerpt: "O link abre o cadastro da seleção da Creator Ads, sem página própria desta campanha.",
    });
  });

  test("99Freelas: coleta projeto UGC público e não trata o piso da plataforma como cachê", () => {
    const published = new Date("2026-09-01T10:00:00-03:00").getTime();
    const deadline = new Date("2026-09-07T23:59:00-03:00").getTime();
    const html = `<ul><li class="with-flag result-item" data-id="123">
      <h1 class="title"><a href="/project/criadora-ugc-123?fs=t">Criadora UGC para material infantil</a></h1>
      <p>Publicado: <b class="datetime" cp-datetime="${published}"></b>
      Tempo restante: <b class="datetime-restante" cp-datetime="${deadline}"></b></p>
      <div class="item-text description formatted-text" data-content="Buscamos uma mãe para gravar 2 vídeos UGC verticais para anúncios no Instagram. O produto será enviado."></div>
    </li></ul>`;

    const projects = ninetyNineFreelasCollectorTestUtils.parsePublicProjects(
      html,
      new Date("2026-09-01T12:00:00-03:00"),
    );
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      url: "https://www.99freelas.com.br/project/criadora-ugc-123",
      deadline: "2026-09-07",
      publishedAt: "2026-09-01",
    });
    expect(ninetyNineFreelasCollectorTestUtils.isCreatorProject(projects[0]!)).toBe(true);

    const opportunity = ninetyNineFreelasCollectorTestUtils.opportunityFromProject(
      projects[0]!,
      new Date("2026-09-01T12:00:00-03:00"),
    );
    expect(opportunity.compensation).toMatchObject({
      type: "variable",
      minimum: null,
      confirmed: false,
      includesProduct: true,
    });
    expect(opportunity.compensation.sourceText).toContain("piso de R$ 50");
    expect(opportunity.deliverables).toContain("2 vídeos UGC verticais para anúncios no Instagram");
  });

  test("99Freelas: rejeita trabalhos de edição que não pedem gravação pelo creator", () => {
    expect(
      ninetyNineFreelasCollectorTestUtils.isCreatorProject({
        url: "https://www.99freelas.com.br/project/editor-1",
        title: "Edição recorrente de vídeos UGC",
        description: "O cliente envia os vídeos brutos e o editor faz cortes e legendas.",
        publishedAt: null,
        deadline: null,
      }),
    ).toBe(false);
  });

  test("chamadas de eventos: reconhece a permuta pública do Animextreme", () => {
    const opportunity = publicEventCallsCollectorTestUtils.parseAnimextreme(
      `<a>Cadastro de Embaixadores e Promotores</a>`,
      `<p>Vagas Promotores: 30. Consiste em realizar 1 postagem em uma data estipulada, usando o card template, em troca de um ingresso.</p>`,
      new Date("2026-09-01T12:00:00-03:00"),
    );

    expect(opportunity).toMatchObject({
      sourceId: "animextreme-public-creators",
      opportunityType: "barter",
      requiresAccount: false,
      status: "open",
    });
    expect(opportunity?.deliverables[0]).toContain("1 postagem");
  });

  test("chamadas de eventos: só emite Up!ABC quando formulário e entrega estão públicos", () => {
    const opportunity = publicEventCallsCollectorTestUtils.parseUpAbc(
      `<h1>Credenciamento para Cobertura do Up!ABC</h1><p>Criadores de Conteúdo</p>`,
      `<form><p>Para fotógrafos é solicitado o mínimo de 100 fotos por dia de cobertura.</p></form>`,
      new Date("2026-09-01T12:00:00-03:00"),
    );

    expect(opportunity).toMatchObject({
      sourceId: "upabc-public-coverage",
      applicationUrl: "https://www.pulsocriativo.com.br/sys/imprensa/publico/?e=21",
      requiresAccount: false,
      status: "open",
    });
  });
});
