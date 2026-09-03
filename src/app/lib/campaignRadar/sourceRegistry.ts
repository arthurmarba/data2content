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

export const campaignRadarSourceRegistry: CampaignSourceRegistryEntry[] = [
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
    pluginDistribution: pendingPluginDistribution("https://ajuda.upabc.com.br/robots.txt", {
      reviewedAt: "2026-09-01",
      reviewedBy: "public-terms-audit",
      notes: [
        "A central de ajuda publica briefing e candidatura, mas não foi encontrada licença de redistribuição automatizada.",
        "Solicitar autorização escrita pelo canal oficial do Up!ABC antes de liberar no MCP.",
      ],
    }),
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
    pluginDistribution: pendingPluginDistribution(
      "https://www.tijucageekfestival.com.br/robots.txt",
      {
        reviewedAt: "2026-09-01",
        reviewedBy: "public-terms-audit",
        notes: [
          "O site publica briefing, benefícios e candidatura, mas não foi encontrada licença de redistribuição automatizada.",
          "Solicitar autorização escrita à coordenação antes de liberar no MCP.",
        ],
      },
    ),
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
