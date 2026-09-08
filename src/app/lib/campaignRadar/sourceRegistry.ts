export type CampaignSourceInventoryVisibility =
  | "public"
  | "partial_public"
  | "authenticated"
  | "profile_selected";

export type CampaignSourceCollectionMode =
  | "automated_public"
  | "manual_capture"
  | "monitor_public_entry"
  | "email_candidate";

export type CampaignSourceReportPolicy =
  | "campaigns_eligible"
  | "programs_require_review"
  | "campaign_evidence_required";

export type CampaignPluginDistributionStatus =
  | "pending_legal_review"
  | "approved"
  | "blocked";

export interface CampaignPluginDistributionReview {
  status: CampaignPluginDistributionStatus;
  authorizationBasis:
    | "terms_allow_redistribution"
    | "written_permission"
    | "official_api"
    // Chamada aberta que a própria organização publica para atrair creators,
    // sem proibição identificada. Não é licença: é decisão registrada do
    // responsável, revogável a qualquer momento.
    | "public_open_call"
    | null;
  evidenceReference: string | null;
  termsUrl: string | null;
  robotsUrl: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string[];
}

export interface CampaignSourceRegistryEntry {
  sourceId: string;
  sourcePlatform: string;
  publicCheckUrl: string;
  creatorEntryUrl: string;
  inventoryVisibility: CampaignSourceInventoryVisibility;
  collectionModes: CampaignSourceCollectionMode[];
  reportPolicy: CampaignSourceReportPolicy;
  expectedPublicSignals: string[];
  notes: string[];
  lastVerifiedOn: string;
  pluginDistribution: CampaignPluginDistributionReview;
}

type CampaignPluginDistributionAuditDetails = Partial<
  Pick<
    CampaignPluginDistributionReview,
    "evidenceReference" | "termsUrl" | "reviewedAt" | "reviewedBy"
  >
> & {
  notes?: string[];
};

function pendingPluginDistribution(
  robotsUrl: string,
  details: CampaignPluginDistributionAuditDetails = {},
): CampaignPluginDistributionReview {
  return {
    status: "pending_legal_review",
    authorizationBasis: null,
    evidenceReference: details.evidenceReference ?? null,
    termsUrl: details.termsUrl ?? null,
    robotsUrl,
    reviewedAt: details.reviewedAt ?? null,
    reviewedBy: details.reviewedBy ?? null,
    notes: [
      "Página pública não equivale a autorização para redistribuição em plugin.",
      "A fonte permanece fora do MCP até termos, robots.txt e permissão de uso serem documentados.",
      ...(details.notes ?? []),
    ],
  };
}

function blockedPluginDistribution(
  reason: string,
  details: CampaignPluginDistributionAuditDetails & { robotsUrl?: string | null } = {},
): CampaignPluginDistributionReview {
  return {
    status: "blocked",
    authorizationBasis: null,
    evidenceReference: details.evidenceReference ?? null,
    termsUrl: details.termsUrl ?? null,
    robotsUrl: details.robotsUrl ?? null,
    reviewedAt: details.reviewedAt ?? null,
    reviewedBy: details.reviewedBy ?? null,
    notes: [reason, ...(details.notes ?? [])],
  };
}

function approvedOpenCall(
  evidenceReference: string,
  reviewedBy: string,
  notes: string[],
  robotsUrl: string | null = null,
): CampaignPluginDistributionReview {
  return {
    status: "approved",
    authorizationBasis: "public_open_call",
    evidenceReference,
    termsUrl: null,
    robotsUrl,
    reviewedAt: "2026-09-07",
    reviewedBy,
    notes: [
      "Chamada aberta publicada pela própria organização para atrair creators; nenhuma proibição de compartilhamento identificada na página.",
      "Liberação decidida pelo responsável do produto, não por licença da fonte: revogar aqui tira do MCP inclusive registros já importados.",
      ...notes,
    ],
  };
}

export const campaignRadarSourceRegistry: CampaignSourceRegistryEntry[] = [
  {
    sourceId: "manual-editorial", sourcePlatform: "Captura manual",
    publicCheckUrl: "https://data2content.ai/", creatorEntryUrl: "https://data2content.ai/",
    inventoryVisibility: "authenticated", collectionModes: ["manual_capture"], reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Data2Content"], notes: ["Registro editorial privado; não autoriza redistribuição."], lastVerifiedOn: "2026-09-07",
    pluginDistribution: blockedPluginDistribution("Origem manual sem autorização de distribuição documentada."),
  },
  {
    sourceId: "influencer-brasil",
    sourcePlatform: "Influencer Brasil",
    publicCheckUrl: "https://influencerbrasil.com.br/sitemap-projects.xml",
    creatorEntryUrl: "https://influencerbrasil.com.br/projetos",
    inventoryVisibility: "public",
    collectionModes: ["automated_public"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["<urlset", "/projeto/"],
    notes: ["Projetos e prazos são publicados em páginas indexáveis."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "Os Termos de Uso proíbem coleta automatizada sem autorização e exigem permissão escrita para redistribuição ou uso comercial.",
      {
        evidenceReference: "https://influencerbrasil.com.br/termos-de-uso",
        termsUrl: "https://influencerbrasil.com.br/termos-de-uso",
        robotsUrl: "https://influencerbrasil.com.br/robots.txt",
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
        notes: [
          "Cláusulas relevantes: 3 (licença), 4 (compartilhamento) e 5 (coleta automatizada).",
          "Só reclassificar após autorização escrita da Influencer Brasil.",
        ],
      },
    ),
  },
  {
    sourceId: "squid-public-campaigns",
    sourcePlatform: "Squid",
    publicCheckUrl: "https://vidadeinfluencer.squidit.com.br/campanha/t",
    creatorEntryUrl: "https://app.squidit.com.br/",
    inventoryVisibility: "partial_public",
    collectionModes: ["automated_public", "email_candidate"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Campanhas", "article-sq"],
    notes: ["Artigos públicos podem expor links diretos; prazo e cachê nem sempre aparecem."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: pendingPluginDistribution(
      "https://vidadeinfluencer.squidit.com.br/robots.txt",
      {
        termsUrl: "https://app.squidit.com.br/contract/plataform",
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
        notes: [
          "O termo oficial depende de JavaScript e a consulta pública não comprovou autorização para redistribuição.",
          "Solicitar autorização escrita ou integração oficial à Squid antes de liberar no MCP.",
        ],
      },
    ),
  },
  {
    sourceId: "creator-ads-public-calls",
    sourcePlatform: "Creator Ads",
    publicCheckUrl: "https://linktr.ee/creatorads.br",
    creatorEntryUrl: "https://linktr.ee/creatorads.br",
    inventoryVisibility: "partial_public",
    collectionModes: ["automated_public", "email_candidate"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["creatorads.br", "campanha"],
    notes: ["A vitrine pública mostra algumas chamadas; o briefing completo exige cadastro."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "Os Termos do Linktree proíbem scripts, bots e scraping para acessar, extrair, agregar ou coletar conteúdo de perfis.",
      {
        evidenceReference: "https://linktr.ee/s/terms#our-platform",
        termsUrl: "https://linktr.ee/s/terms",
        robotsUrl: "https://linktr.ee/robots.txt",
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
        notes: [
          "A permissão deve vir da Creator Ads e a coleta não pode depender do perfil hospedado no Linktree.",
          "Preferir API, feed ou página própria fornecida pela Creator Ads.",
        ],
      },
    ),
  },
  {
    sourceId: "playnest-public-programs",
    sourcePlatform: "PlayNest / Play9",
    publicCheckUrl: "https://business.playnest.com.br/acelera-casas-bahia/acelera-cb",
    creatorEntryUrl: "https://www.playnest.com.br/creators",
    inventoryVisibility: "partial_public",
    collectionModes: ["automated_public", "email_candidate"],
    reportPolicy: "programs_require_review",
    expectedPublicSignals: ["Acelera CB", "pré-seleção"],
    notes: ["Landings públicas cobrem programas; as missões ficam no app."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: pendingPluginDistribution("https://business.playnest.com.br/robots.txt", {
      termsUrl: "https://app.playnest.com.br/terms",
      reviewedAt: "2026-09-01",
      reviewedBy: "public-terms-audit",
      notes: [
        "A página oficial de termos não expôs texto verificável na consulta pública.",
        "Solicitar autorização escrita ou API oficial à PlayNest antes de liberar no MCP.",
      ],
    }),
  },
  {
    sourceId: "mis-manual-capture",
    sourcePlatform: "MIS",
    publicCheckUrl: "https://www.mis-app.com/",
    creatorEntryUrl: "https://creators.mis-app.com/auth/signup",
    inventoryVisibility: "profile_selected",
    collectionModes: ["manual_capture", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["MIS", "Micro e Nano Influenciadores"],
    notes: [
      "Campanhas são escolhidas para o perfil dentro do app.",
      "A edição de 01/09/2026 inclui uma captura manual identificada como recorte de uma conta.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "Inventário selecionado dentro de conta autenticada; não pode ser redistribuído pelo plugin.",
    ),
  },
  {
    sourceId: "influency-me",
    sourcePlatform: "Influency.me",
    publicCheckUrl: "https://influency.me/sou-influenciador/",
    creatorEntryUrl: "https://public.influency.me/pt/#/auth/logout",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: [
      "Como se inscrever em uma campanha?",
      "ainda não é possível localizar as campanhas",
    ],
    notes: [
      "O cadastro é gratuito e exige pelo menos 2 mil seguidores.",
      "A própria página informa que o creator não consegue localizar campanhas; o contato ocorre por telefone ou e-mail.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "Campanhas específicas não são localizáveis publicamente pelo creator.",
    ),
  },
  {
    sourceId: "creators-llc",
    sourcePlatform: "Creators LLC",
    publicCheckUrl: "https://creators.llc/central-de-ajuda/duvidas-de-creators.html",
    creatorEntryUrl: "https://creators.llc/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "programs_require_review",
    expectedPublicSignals: ["oportunidades de campanhas", "dashboard", "Job List"],
    notes: [
      "O inventário de jobs aparece no dashboard apenas para perfis elegíveis ou convidados.",
      "Programas públicos encontrados: Druid Creator Hub; Tasty Shorts e AliExperts estão em lista de espera; Cesu Creators e Selvers estão encerrados.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "O inventário de jobs é restrito ao dashboard ou a convites.",
    ),
  },
  {
    sourceId: "comu-delas",
    sourcePlatform: "Comû Delas",
    publicCheckUrl: "https://comudelas.com/aplicacao",
    creatorEntryUrl: "https://comudelas.com/aplicacao",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Inscrição para o agenciamento", "R$ 69/mês", "R$ 89/mês"],
    notes: [
      "A candidatura pública é para o casting, com plano mensal após aprovação.",
      "O exemplo promocional 'Vaga UGC: beleza · R$ 600' não tem marca, prazo ou link próprio e não deve virar oportunidade do radar.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "A inscrição pública é para o casting, não para uma oportunidade verificável.",
    ),
  },
  {
    sourceId: "noovid",
    sourcePlatform: "Noovid",
    publicCheckUrl: "https://app.noovid.com/pt-BR/auth/signup?type=creator",
    creatorEntryUrl: "https://app.noovid.com/pt-BR/auth/signup?type=creator",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Sua próxima oportunidade de criar começa aqui", "Para criadores"],
    notes: [
      "O cadastro de creator é público.",
      "Rotas de jobs e tasks redirecionam para login; campanhas específicas não são públicas.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "As oportunidades específicas exigem autenticação e não são públicas.",
    ),
  },
  {
    sourceId: "ninety-nine-freelas-public",
    sourcePlatform: "99Freelas",
    publicCheckUrl: "https://www.99freelas.com.br/projects?q=ugc",
    creatorEntryUrl: "https://www.99freelas.com.br/projects?q=ugc",
    inventoryVisibility: "public",
    collectionModes: ["automated_public"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["result-item", "/project/", "data-content"],
    notes: [
      "Projetos UGC são legíveis sem conta; enviar proposta exige cadastro.",
      "O valor mínimo de R$ 50 é um piso da plataforma e não deve ser tratado como cachê confirmado.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: pendingPluginDistribution("https://www.99freelas.com.br/robots.txt", {
      termsUrl: "https://www.99freelas.com.br/termos",
      reviewedAt: "2026-09-01",
      reviewedBy: "public-terms-audit",
      notes: [
        "Os termos públicos consultados não concedem autorização para coleta e redistribuição automatizadas.",
        "Solicitar autorização escrita ou API oficial ao 99Freelas antes de liberar no MCP.",
      ],
    }),
  },
  {
    sourceId: "animextreme-public-creators",
    sourcePlatform: "Animextreme",
    publicCheckUrl: "https://linktr.ee/animextreme",
    creatorEntryUrl: "https://forms.gle/UKQCouidgrpjsLCYA",
    inventoryVisibility: "public",
    collectionModes: ["automated_public"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Cadastro de Embaixadores e Promotores", "Cadastro Creators e Imprensa"],
    notes: ["A chamada pública detalha vagas, nichos e a permuta para Promotores."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: blockedPluginDistribution(
      "A chamada é monitorada por um perfil no Linktree, cujos Termos proíbem acesso e coleta automatizados.",
      {
        evidenceReference: "https://linktr.ee/s/terms#our-platform",
        termsUrl: "https://linktr.ee/s/terms",
        robotsUrl: "https://linktr.ee/robots.txt",
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
        notes: [
          "O Animextreme possui site e contato oficiais, mas a chamada específica ainda precisa de autorização escrita ou feed próprio.",
          "Contato público: contato@afarprodutora.com.br.",
        ],
      },
    ),
  },
  {
    sourceId: "upabc-public-coverage",
    sourcePlatform: "Up!ABC",
    publicCheckUrl: "https://ajuda.upabc.com.br/index.php?catid=16&id=45&view=article",
    creatorEntryUrl: "https://www.pulsocriativo.com.br/sys/imprensa/publico/?e=21",
    inventoryVisibility: "public",
    collectionModes: ["automated_public"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Credenciamento para Cobertura do Up!ABC", "Criadores de Conteúdo"],
    notes: ["O formulário e as contrapartidas de cobertura são públicos e não exigem login."],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: approvedOpenCall(
      "https://ajuda.upabc.com.br/index.php?catid=16&id=45&view=article",
      "arthur",
      ["Credenciamento de cobertura publicado na central de ajuda, sem login e sem cláusula restritiva."],
      "https://ajuda.upabc.com.br/robots.txt",
    ),
  },
  {
    sourceId: "tijuca-geek-public-coverage",
    sourcePlatform: "Tijuca Geek Festival",
    publicCheckUrl: "https://www.tijucageekfestival.com.br/",
    creatorEntryUrl: "https://forms.gle/mDY8BQ7tMNe2FQFBA",
    inventoryVisibility: "public",
    collectionModes: ["automated_public"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["CREDENCIAMENTO DE IMPRENSA E INFLUENCIADORES", "produzir e publicar conteudo"],
    notes: [
      "Briefing, benefícios e critérios são públicos.",
      "O formulário de candidatura abre via Google e pode exigir uma conta Google.",
    ],
    lastVerifiedOn: "2026-09-01",
    pluginDistribution: approvedOpenCall(
      "https://www.tijucageekfestival.com.br/",
      "arthur",
      ["Briefing, critérios e benefícios do credenciamento são públicos no site do festival."],
      "https://www.tijucageekfestival.com.br/robots.txt",
    ),
  },
  {
    sourceId: "the-insiders-public-campaigns",
    sourcePlatform: "The Insiders Brasil",
    publicCheckUrl: "https://www.theinsidersnet.com/pt-br/campaigns/overview",
    creatorEntryUrl: "https://www.theinsidersnet.com/pt-br/campaigns/overview",
    inventoryVisibility: "partial_public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Inscreva-se!", "Inscrições encerradas!", "/pt-br/campaigns/info/"],
    notes: [
      "A vitrine pública nomeia as campanhas e mostra se a inscrição está aberta ou encerrada.",
      "Briefing, contrapartida e prazo ficam atrás de login; a remuneração é permuta de produto.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.theinsidersnet.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Descoberto na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "popline-creators-public-campaigns",
    sourcePlatform: "POPline Creators",
    publicCheckUrl: "https://poplinecreators.com.br/",
    creatorEntryUrl: "https://poplinecreators.com.br/",
    inventoryVisibility: "partial_public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "programs_require_review",
    expectedPublicSignals: ["Campanhas ativas", "POPline Creators"],
    notes: [
      "A home lista nomes de campanhas ativas de música e cultura pop (festivais e gravadoras).",
      "Cachê, entregas e prazo não aparecem sem conta; cada campanha precisa de confirmação antes de virar oportunidade.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://poplinecreators.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Descoberto na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "achapubli-public-feed",
    sourcePlatform: "AchaPubli",
    publicCheckUrl: "https://achapubli.com.br/data_new.json",
    creatorEntryUrl: "https://achapubli.com.br/",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["brand_name", "application_url", "deadline_at"],
    notes: [
      "Agregador com feed público de vagas, sem login, incluindo marca, entregas e link de candidatura.",
      "Em 07/09/2026 as 283 entradas seguiam marcadas como ativas, mas nenhuma foi publicada depois de março de 2026: o campo status não confirma chamada aberta.",
      "As entradas apontam para CreatorGPT, The Insiders, Inbazz e MIS; serve mais para descobrir origens do que para publicar oportunidade.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://achapubli.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Descoberto na varredura de 07/09/2026; conteúdo é de terceiros e não há autorização de redistribuição."],
    }),
  },
  {
    sourceId: "portalg-oportunidades",
    sourcePlatform: "Portal G",
    publicCheckUrl: "https://portalg.com.br/oportunidades-e-vantagens/feed/",
    creatorEntryUrl: "https://portalg.com.br/oportunidades-e-vantagens/",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["<item>", "oportunidades-e-vantagens"],
    notes: [
      "Portal editorial com feed RSS público que noticia squads e clubes de creators de marcas (MBOOM, Lola, Vizzela, Dermage).",
      "As matérias não trazem link de candidatura: cada chamada precisa ser confirmada na página oficial da marca antes de entrar no relatório.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://portalg.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Descoberto na varredura de 07/09/2026; matéria jornalística de terceiros, sem autorização de redistribuição."],
    }),
  },
  {
    sourceId: "workana-public",
    sourcePlatform: "Workana",
    publicCheckUrl: "https://www.workana.com/pt/jobs?query=ugc",
    creatorEntryUrl: "https://www.workana.com/pt/jobs?query=ugc",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Fazer uma proposta", "UGC"],
    notes: [
      "Listagem pública de projetos de UGC e vídeo, com data de publicação e faixa de valor em dólar.",
      "Enviar proposta exige conta. O site responde 403 a requisição automatizada: só leitura manual.",
      "Mesmo papel do 99Freelas, com mais projetos internacionais na busca.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.workana.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "creator-gpt",
    sourcePlatform: "CreatorGPT",
    publicCheckUrl: "https://mycreatorgpt.com/",
    creatorEntryUrl: "https://mycreatorgpt.com/",
    inventoryVisibility: "partial_public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["CreatorGPT"],
    notes: [
      "Páginas de campanha em /campanha/<id> abrem sem login quando o link é conhecido; não há índice público.",
      "O domínio creatorgpt.com.br não resolvia em 07/09/2026; o ativo no ar é mycreatorgpt.com.",
      "Foi a origem mais citada no feed do AchaPubli.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://mycreatorgpt.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "tag-creator",
    sourcePlatform: "TAG Creator",
    publicCheckUrl: "https://www.tagcreator.com.br/campanhas",
    creatorEntryUrl: "https://www.tagcreator.com.br/campanhas",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["TAG Creator"],
    notes: [
      "A página de campanhas é vitrine de 2022 (Chilli Beans, Adobe, Realme); os botões não levam a chamada aberta. Propostas chegam por e-mail ou WhatsApp depois do cadastro.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.tagcreator.com.br/campanhas/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "unfy",
    sourcePlatform: "Unfy",
    publicCheckUrl: "https://unfy.com.br/",
    creatorEntryUrl: "https://unfy.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Unfy"],
    notes: [
      "Marketplace de campanhas dentro do aplicativo; nada visível sem conta.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://unfy.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "publipost",
    sourcePlatform: "Publipost",
    publicCheckUrl: "https://publipost.com.br/mural-dos-creators",
    creatorEntryUrl: "https://publipost.com.br/mural-dos-creators",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Publipost"],
    notes: [
      "O mural público lista creators disponíveis, não campanhas de marca: o fluxo é a marca achar o creator.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://publipost.com.br/mural-dos-creators/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "buzzcreators",
    sourcePlatform: "Buzzcreators",
    publicCheckUrl: "https://buzzcreators.com.br/",
    creatorEntryUrl: "https://buzzcreators.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Buzzcreators"],
    notes: [
      "Campanhas compatíveis aparecem no painel depois do cadastro.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://buzzcreators.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "publion",
    sourcePlatform: "Publion",
    publicCheckUrl: "https://publionapp.com/",
    creatorEntryUrl: "https://publionapp.com/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Publion"],
    notes: [
      "Painel de campanhas fechado. Material de terceiros menciona assinatura paga para o creator; confirmar antes de indicar.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://publionapp.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "vulse",
    sourcePlatform: "Vulse",
    publicCheckUrl: "https://vulse.io/",
    creatorEntryUrl: "https://vulse.io/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Vulse"],
    notes: [
      "Marketplace de creators e negócios; campanhas não aparecem sem conta.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://vulse.io/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "airfluencers",
    sourcePlatform: "AirFluencers",
    publicCheckUrl: "https://www.airfluencers.com/",
    creatorEntryUrl: "https://www.airfluencers.com/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["AirFluencers"],
    notes: [
      "SaaS do lado da marca (busca, curadoria por IA, campanhas e afiliados). O creator entra por convite da marca, não por vitrine.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.airfluencers.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "get-influencer",
    sourcePlatform: "Get Influencer",
    publicCheckUrl: "https://www.getinfluencer.me/",
    creatorEntryUrl: "https://www.getinfluencer.me/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Get Influencer"],
    notes: [
      "Aplicativo da mesma casa do AchaPubli; campanhas e recebidos ficam dentro do app.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.getinfluencer.me/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "bloomer",
    sourcePlatform: "Bloomer",
    publicCheckUrl: "https://www.bloomer.pro/",
    creatorEntryUrl: "https://www.bloomer.pro/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Bloomer"],
    notes: [
      "Site institucional de UGC; campanhas só depois do cadastro do creator.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.bloomer.pro/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "the-creator-br",
    sourcePlatform: "The Creator",
    publicCheckUrl: "https://thecreator.com.br/",
    creatorEntryUrl: "https://thecreator.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["The Creator"],
    notes: [
      "Vitrine para marcas escolherem creators; não publica campanha aberta.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://thecreator.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "creatify-br",
    sourcePlatform: "Creatify",
    publicCheckUrl: "https://creatify.com.br/",
    creatorEntryUrl: "https://creatify.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Creatify"],
    notes: [
      "Conecta marcas a creators de UGC e live commerce; sem inventário público.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://creatify.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "inbazz",
    sourcePlatform: "Inbazz",
    publicCheckUrl: "https://inbazz.com.br/",
    creatorEntryUrl: "https://inbazz.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Inbazz"],
    notes: [
      "Plataforma de comunidades de creators contratada pela marca; campanhas ficam na comunidade fechada.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://inbazz.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "skeepers-brasil",
    sourcePlatform: "Skeepers",
    publicCheckUrl: "https://www.skeepers.io/pt/influencer-marketing/",
    creatorEntryUrl: "https://www.skeepers.io/pt/influencer-marketing/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Skeepers"],
    notes: [
      "A leitura pública foi bloqueada por proteção antibot em 07/09/2026; as campanhas ficam na área da comunidade.",
      "Só voltar a checar com navegador; requisição automatizada recebe desafio de bot.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: blockedPluginDistribution(
      "Página protegida por desafio antibot e sem autorização de redistribuição.",
      {
        reviewedAt: "2026-09-07",
        reviewedBy: "varredura-manual-2026-09-07",
        notes: ["Origem protegida por desafio de bot; coleta automatizada fora de questão sem acordo."],
      },
    ),
  },
  {
    sourceId: "brandlovrs",
    sourcePlatform: "BrandLovrs",
    publicCheckUrl: "https://www.brandlovrs.com/",
    creatorEntryUrl: "https://www.brandlovrs.com/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["BrandLovrs"],
    notes: [
      "A leitura pública foi bloqueada por proteção antibot em 07/09/2026; campanhas exigem conta.",
      "Só voltar a checar com navegador; requisição automatizada recebe desafio de bot.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: blockedPluginDistribution(
      "Página protegida por desafio antibot e sem autorização de redistribuição.",
      {
        reviewedAt: "2026-09-07",
        reviewedBy: "varredura-manual-2026-09-07",
        notes: ["Origem protegida por desafio de bot; coleta automatizada fora de questão sem acordo."],
      },
    ),
  },
  {
    sourceId: "bgs-credenciamento",
    sourcePlatform: "Brasil Game Show",
    publicCheckUrl: "https://credenciamento.brasilgameshow.com.br/",
    creatorEntryUrl: "https://credenciamento.brasilgameshow.com.br/",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Influenciadores", "Quero solicitar uma credencial"],
    notes: [
      "O portal de credenciamento tem categoria própria de Influenciadores, sem login para ver as regras.",
      "Edição 2026: pedidos até 19/09, evento de 09 a 12/10 em São Paulo, aprovação individual.",
      "Repete todo ano: conferir em agosto.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: approvedOpenCall(
      "https://credenciamento.brasilgameshow.com.br/",
      "arthur",
      ["Portal de credenciamento com categoria própria de Influenciadores, aberto sem login."],
      "https://credenciamento.brasilgameshow.com.br/robots.txt",
    ),
  },
  {
    sourceId: "ccxp-credenciamento",
    sourcePlatform: "CCXP",
    publicCheckUrl: "https://www.ccxp.com.br/",
    creatorEntryUrl: "https://www.ccxp.com.br/",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["CCXP"],
    notes: [
      "CCXP26 acontece de 3 a 6 de dezembro em São Paulo.",
      "O credenciamento de imprensa e creators costuma abrir algumas semanas antes; conferir a partir de outubro.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.ccxp.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "gamescom-latam-creators",
    sourcePlatform: "gamescom latam",
    publicCheckUrl: "https://latam.gamescom.global/pt/creators/",
    creatorEntryUrl: "https://latam.gamescom.global/pt/creators/",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Creators", "gamescom latam"],
    notes: [
      "Página de creators da edição de 2026 (30/04 a 03/05), já realizada.",
      "A chamada volta a cada edição; conferir no primeiro trimestre.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://latam.gamescom.global/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "beauty-fair-influenciadores",
    sourcePlatform: "Beauty Fair",
    publicCheckUrl: "https://beleza.beautyfair.com.br/credenciamento-de-influenciadores-beauty-fair-2026",
    creatorEntryUrl: "https://beleza.beautyfair.com.br/credenciamento-de-influenciadores-beauty-fair-2026",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Credenciamento de Influenciadores"],
    notes: [
      "Edição 2026: pedidos de 27/07 a 10/08, análise até 01/09, evento de 5 a 8/09 — já encerrada.",
      "Repete todo ano e puxa junto as seleções de marcas de beleza (Lola, Hidramais); conferir em julho.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://beleza.beautyfair.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "virada-cultural-sp",
    sourcePlatform: "Virada Cultural SP",
    publicCheckUrl: "https://prefeitura.sp.gov.br/web/cultura",
    creatorEntryUrl: "https://prefeitura.sp.gov.br/web/cultura",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Cultura", "credenciamento"],
    notes: [
      "A Secretaria Municipal de Cultura abre formulário separado para influenciadores a cada edição (maio).",
      "Modelo de permuta/credencial, sem cachê; serve a creators de cultura e cidade.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://prefeitura.sp.gov.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "keune-creators",
    sourcePlatform: "Keune Creators",
    publicCheckUrl: "https://www.keune.com.br/m/blog/69a1af88047f0967a61e987a/faca-parte-do-nosso-time-de-keune-creators",
    creatorEntryUrl: "https://www.keune.com.br/m/blog/69a1af88047f0967a61e987a/faca-parte-do-nosso-time-de-keune-creators",
    inventoryVisibility: "public",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaigns_eligible",
    expectedPublicSignals: ["Keune Creators", "inscrições"],
    notes: [
      "Squad de marca com formulário público (Google, exige conta Google) e ciclos trimestrais desde 2026.",
      "Contrapartida: acesso antecipado a lançamentos, bônus por vendas, comissão e cupom.",
      "O texto da página ainda anuncia resultado na primeira quinzena de abril; confirmar o ciclo aberto antes de publicar.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: approvedOpenCall(
      "https://www.keune.com.br/m/blog/69a1af88047f0967a61e987a/faca-parte-do-nosso-time-de-keune-creators",
      "arthur",
      ["A marca publica a chamada e o formulário no próprio blog para recrutar creators.", "Confirmar o ciclo aberto antes de manter no ar: a página ainda cita resultado em abril."],
      "https://www.keune.com.br/robots.txt",
    ),
  },
  {
    sourceId: "publify",
    sourcePlatform: "Publify",
    publicCheckUrl: "https://publify.com.br/",
    creatorEntryUrl: "https://publify.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Publify", "creators"],
    notes: [
      "Plataforma do lado da marca: a página pública fala de curadoria, contrato e pagamento, sem listar campanha.",
      "Sem chamada pública em 07/09/2026: registrar aqui evita repetir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://publify.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "spark-agencia",
    sourcePlatform: "Spark",
    publicCheckUrl: "https://spark.com.br/",
    creatorEntryUrl: "https://spark.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Spark", "influência"],
    notes: [
      "Agência de marketing de influência: seleciona creators por projeto, sem vitrine pública.",
      "Caminho possível é parceria comercial, não coleta.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://spark.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "threads-posts-publicos",
    sourcePlatform: "Threads (posts públicos)",
    publicCheckUrl: "https://www.threads.com/@maisinfluencer",
    creatorEntryUrl: "https://www.threads.com/@maisinfluencer",
    inventoryVisibility: "partial_public",
    collectionModes: ["manual_capture"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Campanha", "creators", "grupo de jobs"],
    notes: [
      "Verificado em 07/09/2026: a página de um post abre sem login e mostra texto, data, respostas e 'Threads relacionadas'; a grade do perfil exige login.",
      "O caminho que funciona é busca por termos de recrutamento restrita a threads.com, e depois abrir o post.",
      "Contas que publicam chamada com frequência: @maisinfluencer (a mais constante), @laurasouzaolv, @clubepatroa, @nexa.creators, @thaismassuchetto, @parceirosweb_, @bondcreators_.",
      "O post quase nunca traz briefing: manda para um grupo de WhatsApp de terceiro. Serve para descobrir a chamada, não para publicá-la.",
      "Não confundir com a busca da API do Threads, que segue desligada por falta de confirmação de gratuidade.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: blockedPluginDistribution(
      "Conteúdo de terceiros publicado em rede social, sem autorização de redistribuição.",
      {
        robotsUrl: "https://www.threads.com/robots.txt",
        reviewedAt: "2026-09-07",
        reviewedBy: "varredura-manual-2026-09-07",
        notes: ["Só captura manual com evidência; nada de coleta automatizada na rede social."],
      },
    ),
  },
  {
    sourceId: "whatsapp-canais-publi",
    sourcePlatform: "Canais de WhatsApp de publi",
    publicCheckUrl: "https://whatsapp.com/channel/0029VbCsi4n4tRrsryZx8D05",
    creatorEntryUrl: "https://whatsapp.com/channel/0029VbCsi4n4tRrsryZx8D05",
    inventoryVisibility: "partial_public",
    collectionModes: ["manual_capture"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Channel", "followers"],
    notes: [
      "Verificado em 07/09/2026: a página de um canal mostra nome, descrição e a última atualização sem login — uma espiada, não um histórico.",
      "Grupo de WhatsApp (chat.whatsapp.com) não tem prévia: só nome e convite; entrar é ato humano.",
      "Boa parte desses canais cobra do creator pelo acesso às vagas (o canal conferido pedia R$ 29,99); avaliar antes de mandar creator para lá.",
      "A saída sustentável aqui é o creator da comunidade encaminhar a publi que recebe, e não a coleta.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: blockedPluginDistribution(
      "Conteúdo privado de mensageria, sem autorização e sem observabilidade completa.",
      {
        reviewedAt: "2026-09-07",
        reviewedBy: "varredura-manual-2026-09-07",
        notes: ["Nunca automatizar leitura de WhatsApp; entrada manual com evidência apenas."],
      },
    ),
  },
  {
    sourceId: "seu-influencer",
    sourcePlatform: "Seu Influencer",
    publicCheckUrl: "https://seuinfluencer.com/",
    creatorEntryUrl: "https://seuinfluencer.com/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Seu Influencer", "UGC"],
    notes: [
      "Plataforma de UGC do lado da marca; a página pública fala da base de creators, não de campanha aberta.",
      "Divulga bastante no Threads, o que faz o nome reaparecer nas buscas: registrar evita reabrir a pesquisa.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://seuinfluencer.com/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "nexa-creators",
    sourcePlatform: "NEXA Creators",
    publicCheckUrl: "https://nexacreators.com.br/",
    creatorEntryUrl: "https://nexacreators.com.br/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry", "email_candidate"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Nexa"],
    notes: [
      "Recruta pelo Threads (@nexa.creators) com campanhas de permuta e comissão sobre vendas; o site é aplicação fechada.",
      "Material público de terceiros indica acesso por assinatura do creator: confirmar antes de indicar.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://nexacreators.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem autorização de redistribuição documentada."],
    }),
  },
  {
    sourceId: "freelancer-com-br",
    sourcePlatform: "Freelancer.com.br",
    publicCheckUrl: "https://www.freelancer.com.br/jobs/ugc/",
    creatorEntryUrl: "https://www.freelancer.com.br/jobs/ugc/",
    inventoryVisibility: "authenticated",
    collectionModes: ["monitor_public_entry"],
    reportPolicy: "campaign_evidence_required",
    expectedPublicSignals: ["Freelancer", "projetos"],
    notes: [
      "Ao contrário do 99Freelas e do Workana, a listagem de projetos não renderiza sem login: a página devolve só o formulário de acesso.",
      "Verificado em 07/09/2026 por requisição e por navegador; não insistir.",
    ],
    lastVerifiedOn: "2026-09-07",
    pluginDistribution: pendingPluginDistribution("https://www.freelancer.com.br/robots.txt", {
      reviewedAt: "2026-09-07",
      reviewedBy: "varredura-manual-2026-09-07",
      notes: ["Verificado na varredura de 07/09/2026; sem inventário público e sem autorização de redistribuição."],
    }),
  },
];

export function sourceRegistryEntry(sourceId: string): CampaignSourceRegistryEntry | null {
  return campaignRadarSourceRegistry.find((entry) => entry.sourceId === sourceId) ?? null;
}

export function isSourceApprovedForPlugin(sourceId: string): boolean {
  const review = sourceRegistryEntry(sourceId)?.pluginDistribution;
  return Boolean(
    review?.status === "approved" &&
      review.authorizationBasis &&
      review.evidenceReference &&
      review.reviewedAt &&
      review.reviewedBy,
  );
}

export function pluginDistributionValidationIssues(
  entry: CampaignSourceRegistryEntry,
): string[] {
  const review = entry.pluginDistribution;
  const issues: string[] = [];

  if (review.notes.length === 0) issues.push("pluginDistribution.notes precisa explicar a decisão");
  if (Boolean(review.reviewedAt) !== Boolean(review.reviewedBy)) {
    issues.push("reviewedAt e reviewedBy devem ser preenchidos juntos");
  }

  if (entry.collectionModes.includes("automated_public") && !review.robotsUrl) {
    issues.push("fontes automatizadas precisam registrar robotsUrl");
  }

  if (review.status === "approved") {
    if (!review.authorizationBasis) issues.push("fonte aprovada precisa de authorizationBasis");
    if (!review.evidenceReference) issues.push("fonte aprovada precisa de evidenceReference");
    if (!review.reviewedAt || !review.reviewedBy) {
      issues.push("fonte aprovada precisa de data e responsável pela revisão");
    }
  } else if (review.authorizationBasis) {
    issues.push("fonte não aprovada não pode declarar authorizationBasis");
  }

  return issues;
}
