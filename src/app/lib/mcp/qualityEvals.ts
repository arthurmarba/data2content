export type McpEvalClient = "chatgpt" | "claude";

export type McpObservedToolCall = {
  name: string;
  afterExplicitUserConfirmation?: boolean;
};

export type McpQualityEvalCase = {
  id: string;
  clients: McpEvalClient[];
  userRequest: string;
  requiredTools: string[];
  forbiddenTools: string[];
  rules: Array<
    | "exact_period_no_estimation"
    | "respect_missing_evidence"
    | "draft_before_save"
    | "explicit_confirmation_before_write"
    | "explain_collab_evidence"
    | "community_inspiration_research"
    | "community_inspiration_privacy"
    | "trend_requires_velocity_evidence"
    | "resolve_admin_creator_first"
    | "admin_evidence_listing"
  >;
};

export const MCP_QUALITY_EVAL_CASES: McpQualityEvalCase[] = [
  {
    id: "exact_last_week_count",
    clients: ["chatgpt", "claude"],
    userRequest: "Quantos conteúdos eu publiquei na última semana?",
    requiredTools: ["analyze_creator_period"],
    forbiddenTools: ["list_top_content", "get_performance_summary"],
    rules: ["exact_period_no_estimation"],
  },
  {
    id: "deep_content_evidence",
    clients: ["chatgpt", "claude"],
    userRequest: "Analise as cenas, objetos, gancho e fala deste conteúdo.",
    requiredTools: ["get_content_deep_analysis"],
    forbiddenTools: [],
    rules: ["respect_missing_evidence"],
  },
  {
    id: "personalized_script_draft",
    clients: ["chatgpt", "claude"],
    userRequest: "Crie um roteiro baseado no que funciona para mim.",
    requiredTools: ["generate_script_draft"],
    forbiddenTools: ["save_script"],
    rules: ["draft_before_save"],
  },
  {
    id: "confirmed_script_save",
    clients: ["chatgpt", "claude"],
    userRequest: "Gostei desse rascunho. Pode salvar.",
    requiredTools: ["save_script"],
    forbiddenTools: [],
    rules: ["explicit_confirmation_before_write"],
  },
  {
    id: "collab_recommendation",
    clients: ["chatgpt", "claude"],
    userRequest: "Quais creators da Data2Content combinam para uma collab sobre IA?",
    requiredTools: ["recommend_collab_creators"],
    forbiddenTools: [],
    rules: ["explain_collab_evidence"],
  },
  {
    id: "creative_inspiration_filters",
    clients: ["chatgpt", "claude"],
    userRequest: "Busque Reels longos de humor, gravados em escritório, com gancho de pergunta e notebook em cena.",
    requiredTools: ["research_inspiration_content"],
    forbiddenTools: ["list_top_content", "recommend_collab_creators"],
    rules: ["community_inspiration_research", "community_inspiration_privacy"],
  },
  {
    id: "community_trending_research",
    clients: ["chatgpt", "claude"],
    userRequest: "Quais conteúdos estão ganhando força agora na comunidade Data2Content?",
    requiredTools: ["research_inspiration_content"],
    forbiddenTools: ["list_top_content"],
    rules: ["community_inspiration_research", "trend_requires_velocity_evidence"],
  },
  {
    id: "compare_research_references",
    clients: ["chatgpt", "claude"],
    userRequest: "Compare essas três inspirações e diga quais padrões elas têm em comum.",
    requiredTools: ["compare_inspiration_contents"],
    forbiddenTools: ["get_content_deep_analysis"],
    rules: ["community_inspiration_privacy"],
  },
];

export const MCP_ADMIN_QUALITY_EVAL_CASES: McpQualityEvalCase[] = [
  {
    id: "admin_find_creator",
    clients: ["chatgpt", "claude"],
    userRequest: "Encontre Arthur Marba na plataforma.",
    requiredTools: ["search"],
    forbiddenTools: [],
    rules: [],
  },
  {
    id: "admin_analyze_creator_30_days",
    clients: ["chatgpt", "claude"],
    userRequest: "Analise os conteúdos desse criador nos últimos 30 dias.",
    requiredTools: ["search", "fetch", "analyze_creator_period"],
    forbiddenTools: ["list_creator_top_content"],
    rules: ["exact_period_no_estimation", "resolve_admin_creator_first"],
  },
  {
    id: "admin_hooks_and_scenarios",
    clients: ["chatgpt", "claude"],
    userRequest: "Quais ganchos e cenários trouxeram mais resultado?",
    requiredTools: ["search", "fetch", "get_creator_intelligence", "list_creator_top_content"],
    forbiddenTools: [],
    rules: ["resolve_admin_creator_first", "respect_missing_evidence"],
  },
  {
    id: "admin_show_supporting_contents",
    clients: ["chatgpt", "claude"],
    userRequest: "Mostre os conteúdos usados para sustentar essa conclusão.",
    requiredTools: ["get_creator_contents"],
    forbiddenTools: [],
    rules: ["admin_evidence_listing"],
  },
  {
    id: "admin_compare_creators",
    clients: ["chatgpt", "claude"],
    userRequest: "Compare este criador com outros três.",
    requiredTools: ["compare_creators"],
    forbiddenTools: [],
    rules: ["respect_missing_evidence"],
  },
  {
    id: "admin_research_inspirations",
    clients: ["chatgpt", "claude"],
    userRequest: "Encontre referências para ele se inspirar.",
    requiredTools: ["research_creator_inspirations"],
    forbiddenTools: [],
    rules: ["community_inspiration_privacy"],
  },
];

export type McpQualityEvalResult = {
  passed: boolean;
  violations: string[];
};

export function evaluateMcpToolPlan(
  evalCase: McpQualityEvalCase,
  calls: McpObservedToolCall[],
): McpQualityEvalResult {
  const names = calls.map((call) => call.name);
  const violations: string[] = [];

  for (const required of evalCase.requiredTools) {
    if (!names.includes(required)) violations.push(`missing_required_tool:${required}`);
  }
  for (const forbidden of evalCase.forbiddenTools) {
    if (names.includes(forbidden)) violations.push(`forbidden_tool:${forbidden}`);
  }

  const saveIndex = names.indexOf("save_script");
  const draftIndex = names.indexOf("generate_script_draft");
  if (saveIndex >= 0) {
    const saveCall = calls[saveIndex];
    if (!saveCall?.afterExplicitUserConfirmation) {
      violations.push("save_without_explicit_confirmation");
    }
    if (draftIndex >= 0 && draftIndex > saveIndex) {
      violations.push("save_before_draft");
    }
  }

  if (
    evalCase.rules.includes("exact_period_no_estimation") &&
    !names.includes("analyze_creator_period")
  ) {
    violations.push("period_answer_without_exact_inventory");
  }

  if (evalCase.rules.includes("resolve_admin_creator_first")) {
    const searchIndex = names.indexOf("search");
    const fetchIndex = names.indexOf("fetch");
    const firstAnalysisIndex = names.findIndex((name) =>
      ["analyze_creator_period", "get_creator_intelligence", "list_creator_top_content"].includes(name),
    );
    if (
      searchIndex < 0 ||
      fetchIndex < 0 ||
      firstAnalysisIndex < 0 ||
      searchIndex > fetchIndex ||
      fetchIndex > firstAnalysisIndex
    ) {
      violations.push("admin_creator_not_resolved_before_analysis");
    }
  }

  if (
    evalCase.rules.includes("admin_evidence_listing") &&
    !names.includes("get_creator_contents")
  ) {
    violations.push("admin_conclusion_without_supporting_contents");
  }

  return { passed: violations.length === 0, violations };
}
