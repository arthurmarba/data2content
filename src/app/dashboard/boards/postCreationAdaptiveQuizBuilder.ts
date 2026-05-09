import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
  PostCreationAdaptiveQuestionMapKey,
  PostCreationAdaptiveQuestionOption,
  PostCreationAdaptiveQuestionType,
} from "./postCreationAdaptiveTypes";

type QuestionInput = {
  id: string;
  type: PostCreationAdaptiveQuestionType;
  title: string;
  helper?: string;
  mapKey: PostCreationAdaptiveQuestionMapKey;
  options: PostCreationAdaptiveQuestionOption[];
};

function option(
  id: string,
  label: string,
  reason?: string,
  recommended?: boolean
): PostCreationAdaptiveQuestionOption {
  return {
    id,
    label,
    ...(reason ? { reason } : {}),
    ...(recommended ? { recommended: true } : {}),
  };
}

function question(input: QuestionInput): PostCreationAdaptiveQuestion {
  return {
    id: input.id,
    type: input.type,
    title: input.title,
    helper: input.helper || null,
    mapKey: input.mapKey,
    options: input.options,
    required: true,
  };
}

function validatePautaQuestions(detection: PostCreationAdaptiveIntentDetection): PostCreationAdaptiveQuestion[] {
  const hasCommercialSignal = detection.signals.some((signal) => /marca|collab|colab|parceria/.test(signal));

  return [
    question({
      id: "validate-objective",
      type: "strategic_choice",
      title: "Qual objetivo principal dessa pauta?",
      helper: detection.detectedPauta ? `Vamos refinar: ${detection.detectedPauta}.` : "Escolha o resultado que deve guiar a execução.",
      mapKey: "objective",
      options: [
        option("comments", "Gerar comentários", "Boa escolha quando a pauta nasce de identificação.", true),
        option("reach", "Ganhar alcance", "Prioriza abertura forte e leitura rápida."),
        option("saves", "Gerar salvamentos", "Pede entrega prática e reaplicável."),
        option("brand_collab", "Abrir marca/collab", "Organiza a pauta para oportunidade comercial."),
      ],
    }),
    question({
      id: "validate-how",
      type: "strategic_choice",
      title: "Qual execução deixaria a ideia mais forte?",
      helper: "A execução define se a pauta vira cena, ensino ou conversa.",
      mapKey: "how",
      options: [
        option("scene_reaction", "Cena/reação", "Transforma a ideia em situação fácil de reconhecer.", true),
        option("tutorial", "Tutorial", "Funciona quando a pauta promete solução clara."),
        option("direct_story", "Relato direto", "Bom para contexto pessoal ou opinião."),
        option("trend", "Trend", "Aumenta familiaridade se a trend couber sem forçar."),
      ],
    }),
    question({
      id: "validate-hook",
      type: "strategic_choice",
      title: "Qual gancho deveria abrir o conteúdo?",
      helper: "O gancho precisa deixar a tensão visível nos primeiros segundos.",
      mapKey: "hook",
      options: [
        option("pov", "POV", "Bom para transformar contexto em cena.", true),
        option("direct_question", "Pergunta direta", "Chama resposta mental imediata."),
        option("pain_sentence", "Frase de dor", "Nomeia o incômodo antes da explicação."),
        option("practical_promise", "Promessa prática", "Abre com utilidade clara."),
      ],
    }),
    question({
      id: "validate-cta",
      type: "preference",
      title: "Qual CTA combina melhor?",
      helper: "O CTA deve continuar a conversa, não só encerrar o post.",
      mapKey: "cta",
      options: [
        option("specific_question", "Pergunta específica", "Aumenta chance de comentário útil.", true),
        option("tag_someone", "Marca alguém", "Bom quando a situação é compartilhável."),
        option("save", "Salva", "Combina com dica ou framework."),
        option("follow", "Segue", "Funciona melhor quando há promessa de série."),
      ],
    }),
    question({
      id: "validate-opportunity",
      type: "strategic_choice",
      title: "Qual oportunidade essa pauta pode abrir?",
      helper: "Use essa resposta para calibrar o plano final sem perder naturalidade.",
      mapKey: hasCommercialSignal ? "brand" : "collab",
      options: [
        option("brand", "Marca", "Boa se houver objeto, rotina ou solução na cena.", hasCommercialSignal),
        option("collab", "Collab", "Boa se outra visão melhoraria a pauta."),
        option("series", "Série de posts", "Expande assunto que tem recorrência.", !hasCommercialSignal),
        option("organic_test", "Apenas teste orgânico", "Mantém foco em aprendizado rápido."),
      ],
    }),
  ];
}

function discoverPautaQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "discover-objective",
      type: "strategic_choice",
      title: "O que você quer priorizar agora?",
      helper: "A pauta nasce melhor quando o resultado vem antes do formato.",
      mapKey: "objective",
      options: [
        option("reach", "Alcance", "Pede ideia simples, forte e compartilhável.", true),
        option("comments", "Comentários", "Pede tensão ou identificação."),
        option("authority", "Autoridade", "Pede critério, opinião ou bastidor qualificado."),
        option("brands", "Marcas", "Pede contexto de uso e narrativa comercial orgânica."),
      ],
    }),
    question({
      id: "discover-format",
      type: "preference",
      title: "Que tipo de conteúdo você topa gravar?",
      helper: "Escolha o formato que cabe na energia de hoje.",
      mapKey: "format",
      options: [
        option("simple_reels", "Reels simples", "Melhor relação entre velocidade e alcance.", true),
        option("carousel", "Carrossel", "Bom para estruturar ideia salvável."),
        option("behind_scenes", "Bastidor", "Bom quando há processo real para mostrar."),
        option("story", "Story", "Bom para teste rápido e conversa."),
      ],
    }),
    question({
      id: "discover-narrative",
      type: "strategic_choice",
      title: "Qual território parece mais natural hoje?",
      helper: "O território evita pauta genérica e aproxima do seu repertório real.",
      mapKey: "narrative",
      options: [
        option("real_routine", "Rotina real", "Dá contexto e cenas naturais.", true),
        option("opinion", "Opinião", "Bom para posicionamento."),
        option("backstage", "Bastidor", "Bom para mostrar processo."),
        option("audience_pain", "Dor da audiência", "Bom para comentário e salvamento."),
      ],
    }),
    question({
      id: "discover-effort",
      type: "constraint",
      title: "Quanto esforço você quer colocar?",
      helper: "O plano precisa caber no que você consegue executar.",
      mapKey: "effort",
      options: [
        option("low", "Baixo", "Uma cena, uma ideia, pouca produção.", true),
        option("medium", "Médio", "Roteiro curto com exemplo."),
        option("high", "Alto", "Mais cenas, prova e edição."),
      ],
    }),
  ];
}

function createByGoalQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "goal-response",
      type: "strategic_choice",
      title: "Que resposta você quer provocar?",
      helper: "Isso transforma um objetivo solto em direção criativa.",
      mapKey: "objective",
      options: [
        option("comments", "Comentários", "Pede pergunta, tensão ou identificação.", true),
        option("shares", "Compartilhamentos", "Pede frase forte e fácil de repassar."),
        option("saves", "Salvamentos", "Pede utilidade e estrutura."),
        option("clicks", "Cliques", "Pede promessa objetiva e próximo passo."),
      ],
    }),
    question({
      id: "goal-narrative",
      type: "preference",
      title: "Qual abordagem combina mais com você?",
      helper: "A abordagem precisa soar natural no seu perfil.",
      mapKey: "narrative",
      options: [
        option("humor", "Humor", "Bom para alcance e identificação.", true),
        option("opinion", "Opinião", "Bom para comentário e autoridade."),
        option("backstage", "Bastidor", "Bom para proximidade."),
        option("tutorial", "Tutorial", "Bom para salvamento e clareza."),
      ],
    }),
    question({
      id: "goal-format",
      type: "strategic_choice",
      title: "Que formato sustenta melhor esse objetivo?",
      helper: "Formato errado pode enfraquecer uma boa intenção.",
      mapKey: "format",
      options: [
        option("reels", "Reels", "Melhor para alcance e resposta rápida.", true),
        option("carousel", "Carrossel", "Melhor para salvar e organizar."),
        option("stories", "Stories", "Melhor para conversa e teste."),
        option("photo_post", "Post foto", "Melhor para opinião curta ou contexto visual."),
      ],
    }),
    question({
      id: "goal-cta",
      type: "strategic_choice",
      title: "Qual CTA combina com esse objetivo?",
      helper: "O CTA fecha o comportamento que você quer provocar.",
      mapKey: "cta",
      options: [
        option("answer_question", "Responder uma pergunta", "Direto para comentários.", true),
        option("send_to_friend", "Enviar para alguém", "Direto para compartilhamento."),
        option("save_for_later", "Salvar para usar depois", "Direto para salvamentos."),
        option("click_link", "Clicar no link", "Direto para conversão."),
      ],
    }),
  ];
}

function brandMatchQuestions(detection: PostCreationAdaptiveIntentDetection): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "brand-category",
      type: "strategic_choice",
      title: "Que tipo de marca você quer atrair/encaixar?",
      helper: detection.brandCategory ? `Sinal detectado: ${detection.brandCategory}.` : "Escolha o território comercial mais natural.",
      mapKey: "brand",
      options: [
        option("beauty_selfcare", "Beleza/autocuidado", "Entra bem em rotina, pausa e transformação.", detection.brandCategory === "beleza" || detection.brandCategory === "skincare"),
        option("technology", "Tecnologia", "Entra bem como ferramenta ou conflito cotidiano."),
        option("home_comfort", "Casa/conforto", "Entra bem em cenas domésticas e bem-estar."),
        option("food_wellness", "Alimentação/bem-estar", "Entra bem em rotina, energia e cuidado."),
      ],
    }),
    question({
      id: "brand-how",
      type: "strategic_choice",
      title: "Como a marca deveria entrar?",
      helper: "A entrada precisa parecer parte da cena, não uma interrupção.",
      mapKey: "how",
      options: [
        option("natural_solution", "Solução natural da cena", "Reduz sensação de publi forçada.", true),
        option("routine_item", "Item de rotina", "Bom para produto recorrente."),
        option("review", "Review", "Bom quando a audiência precisa de critério."),
        option("direct_ad", "Publi direta", "Bom quando a proposta comercial é explícita."),
      ],
    }),
    question({
      id: "brand-narrative",
      type: "strategic_choice",
      title: "Qual narrativa deixa a marca menos forçada?",
      helper: "A marca precisa resolver ou amplificar algo que já existe na pauta.",
      mapKey: "narrative",
      options: [
        option("problem_solution", "Problema/solução", "Cria encaixe comercial claro.", true),
        option("real_routine", "Rotina real", "Mostra contexto de uso."),
        option("transformation", "Transformação", "Bom para antes/depois."),
        option("backstage", "Bastidor", "Bom para mostrar processo e ferramenta."),
      ],
    }),
    question({
      id: "brand-format",
      type: "preference",
      title: "Qual entrega faria mais sentido?",
      helper: "A entrega precisa caber no tipo de marca e no seu formato forte.",
      mapKey: "format",
      options: [
        option("reels", "Reels", "Bom para narrativa e alcance.", true),
        option("stories", "Stories", "Bom para demonstração e conversa."),
        option("carousel", "Carrossel", "Bom para argumento e prova."),
        option("package", "Pacote", "Bom para campanha com mais de um ponto de contato."),
      ],
    }),
    question({
      id: "brand-why",
      type: "strategic_choice",
      title: "Qual argumento comercial é mais forte?",
      helper: "Esse argumento orienta o plano 5W2H e um eventual relatório para marca.",
      mapKey: "why",
      options: [
        option("organic_match", "Match orgânico", "Defende naturalidade narrativa.", true),
        option("audience_pain", "Dor da audiência", "Defende relevância para quem assiste."),
        option("usage_context", "Contexto de uso", "Defende presença real do produto."),
        option("data_proof", "Prova por dados", "Defende decisão com performance."),
      ],
    }),
  ];
}

function collabMatchQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "collab-type",
      type: "strategic_choice",
      title: "Qual tipo de collab faz mais sentido?",
      helper: "A dinâmica define se a collab parece conversa, cena ou experimento.",
      mapKey: "collab",
      options: [
        option("reaction", "Reação", "Fácil de executar e bom para comentário.", true),
        option("debate", "Debate", "Bom para contraste e autoridade."),
        option("challenge", "Desafio", "Bom para alcance e participação."),
        option("joint_scene", "Cena conjunta", "Bom para humor ou narrativa cotidiana."),
      ],
    }),
    question({
      id: "collab-who",
      type: "strategic_choice",
      title: "Que tipo de creator combina melhor?",
      helper: "O parceiro precisa adicionar tensão, prova ou público novo.",
      mapKey: "who",
      options: [
        option("same_niche", "Mesmo nicho", "Aumenta precisão da conversa.", true),
        option("complementary_niche", "Nicho complementar", "Cria ponte para audiência nova."),
        option("similar_audience", "Audiência parecida", "Facilita identificação."),
        option("larger_creator", "Creator maior", "Prioriza alcance e validação."),
      ],
    }),
    question({
      id: "collab-objective",
      type: "strategic_choice",
      title: "O que a collab precisa gerar?",
      helper: "Sem objetivo, collab vira só participação.",
      mapKey: "objective",
      options: [
        option("reach", "Alcance", "Pede formato simples e compartilhável.", true),
        option("comments", "Comentários", "Pede tensão ou discordância saudável."),
        option("authority", "Autoridade", "Pede troca de critério ou experiência."),
        option("brand", "Marca", "Pede narrativa com potencial comercial."),
      ],
    }),
    question({
      id: "collab-narrative",
      type: "strategic_choice",
      title: "Qual dinâmica narrativa usar?",
      helper: "A dinâmica precisa justificar por que existem duas pessoas no conteúdo.",
      mapKey: "narrative",
      options: [
        option("opinion_contrast", "Contraste de opiniões", "Cria tensão produtiva.", true),
        option("shared_experience", "Experiência compartilhada", "Cria identificação."),
        option("before_after", "Antes/depois", "Cria transformação clara."),
        option("humor", "Humor", "Cria leveza e alcance."),
      ],
    }),
  ];
}

function commentToPostQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "comment-why",
      type: "strategic_choice",
      title: "Qual é a dor principal por trás desse comentário?",
      helper: "A resposta melhora quando entendemos o que o comentário realmente pede.",
      mapKey: "why",
      options: [
        option("question", "Dúvida", "Pede resposta clara e útil.", true),
        option("identification", "Identificação", "Pede POV ou cena reconhecível."),
        option("frustration", "Frustração", "Pede acolhimento e virada prática."),
        option("tip_request", "Pedido de dica", "Pede tutorial curto."),
      ],
    }),
    question({
      id: "comment-format",
      type: "strategic_choice",
      title: "Qual formato responde melhor?",
      helper: "O comentário pode virar resposta rápida ou conteúdo salvável.",
      mapKey: "format",
      options: [
        option("reply_reels", "Reels resposta", "Aproveita o contexto do comentário.", true),
        option("carousel", "Carrossel", "Organiza resposta em passos."),
        option("story", "Story", "Bom para conversa imediata."),
        option("direct_video", "Vídeo direto", "Bom para opinião ou explicação curta."),
      ],
    }),
    question({
      id: "comment-narrative",
      type: "strategic_choice",
      title: "Qual narrativa aproveita melhor esse comentário?",
      helper: "A narrativa define se o comentário vira resposta, cena ou posicionamento.",
      mapKey: "narrative",
      options: [
        option("practical_answer", "Resposta prática", "Entrega valor direto.", true),
        option("pov", "POV", "Transforma comentário em cena."),
        option("opinion", "Opinião", "Bom para posicionamento."),
        option("backstage", "Bastidor", "Mostra como você lida com isso na prática."),
      ],
    }),
    question({
      id: "comment-cta",
      type: "strategic_choice",
      title: "Qual CTA gera continuidade?",
      helper: "O melhor CTA abre novos comentários para próximos posts.",
      mapKey: "cta",
      options: [
        option("anyone_else", "Perguntar se mais alguém passa por isso", "Aumenta identificação.", true),
        option("ask_examples", "Pedir exemplos", "Gera repertório para novos conteúdos."),
        option("ask_questions", "Pedir dúvidas", "Abre fila de respostas."),
        option("save", "Salvar", "Funciona quando a resposta é prática."),
      ],
    }),
  ];
}

function weeklyPlanQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "weekly-objective",
      type: "strategic_choice",
      title: "Qual objetivo da semana?",
      helper: "A semana precisa ter uma intenção dominante para não virar lista solta.",
      mapKey: "objective",
      options: [
        option("grow", "Crescer", "Prioriza alcance e descoberta.", true),
        option("engage", "Engajar", "Prioriza conversa e comunidade."),
        option("sell", "Vender", "Prioriza oferta e prova."),
        option("brands", "Atrair marcas", "Prioriza narrativa comercial orgânica."),
      ],
    }),
    question({
      id: "weekly-schedule",
      type: "constraint",
      title: "Quantos conteúdos pretende publicar?",
      helper: "A cadência precisa ser executável.",
      mapKey: "schedule",
      options: [
        option("two", "2", "Plano leve, com foco em qualidade."),
        option("three", "3", "Boa cadência para consistência.", true),
        option("five", "5", "Semana forte sem exigir todo dia."),
        option("daily", "Todos os dias", "Boa para sprint de crescimento."),
      ],
    }),
    question({
      id: "weekly-format",
      type: "preference",
      title: "Qual mistura de formatos prefere?",
      helper: "A mistura define ritmo, profundidade e proximidade.",
      mapKey: "format",
      options: [
        option("reels_stories", "Reels + stories", "Combina alcance e conversa.", true),
        option("reels_carousel", "Reels + carrossel", "Combina alcance e salvamento."),
        option("only_reels", "Só reels", "Foco total em descoberta."),
        option("full_mix", "Mistura completa", "Bom para semana editorial mais rica."),
      ],
    }),
    question({
      id: "weekly-narrative",
      type: "strategic_choice",
      title: "Qual narrativa deve ser prioridade?",
      helper: "Essa escolha vira eixo editorial da semana.",
      mapKey: "narrative",
      options: [
        option("strongest", "Narrativa mais forte", "Explora o que já tende a funcionar.", true),
        option("new", "Narrativa nova", "Abre espaço para aprendizado."),
        option("commercial", "Narrativa comercial", "Prepara oportunidade de marca ou venda."),
        option("community", "Narrativa de comunidade", "Puxa conversa e pertencimento."),
      ],
    }),
  ];
}

function unknownQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "unknown-intent",
      type: "confirmation",
      title: "O que você quer fazer agora?",
      helper: "Escolha o caminho inicial para eu montar perguntas mais úteis.",
      mapKey: "objective",
      options: [
        option("validate_pauta", "Validar pauta", "Você já tem uma ideia e quer melhorar.", true),
        option("discover_pauta", "Descobrir ideia", "Você quer sair do zero."),
        option("brand_match", "Atrair marca", "Você quer potencial comercial."),
        option("weekly_plan", "Planejar semana", "Você quer organizar a cadência."),
      ],
    }),
    question({
      id: "unknown-what",
      type: "confirmation",
      title: "Você já tem uma ideia de conteúdo?",
      helper: "Isso define se o próximo passo é validar ou descobrir pauta.",
      mapKey: "what",
      options: [
        option("yes", "Sim", "Vamos refinar execução.", true),
        option("no", "Não", "Vamos descobrir um caminho."),
        option("goal_only", "Tenho só objetivo", "Vamos transformar meta em narrativa."),
        option("comment", "Tenho comentário", "Vamos transformar resposta em post."),
      ],
    }),
    question({
      id: "unknown-objective",
      type: "strategic_choice",
      title: "Qual resultado você quer buscar?",
      helper: "Mesmo com intenção vaga, o resultado já cria direção.",
      mapKey: "objective",
      options: [
        option("reach", "Alcance", "Pede abertura forte e formato simples.", true),
        option("comments", "Comentários", "Pede identificação ou pergunta."),
        option("authority", "Autoridade", "Pede opinião, critério ou prova."),
        option("brand", "Marca", "Pede contexto comercial orgânico."),
      ],
    }),
  ];
}

export function buildPostCreationAdaptiveQuiz(params: {
  detection: PostCreationAdaptiveIntentDetection;
}): PostCreationAdaptiveQuestion[] {
  const mode = params.detection.mode;

  if (mode === "validate_pauta") return validatePautaQuestions(params.detection);
  if (mode === "discover_pauta") return discoverPautaQuestions();
  if (mode === "create_by_goal") return createByGoalQuestions();
  if (mode === "brand_match") return brandMatchQuestions(params.detection);
  if (mode === "collab_match") return collabMatchQuestions();
  if (mode === "comment_to_post") return commentToPostQuestions();
  if (mode === "weekly_plan") return weeklyPlanQuestions();
  return unknownQuestions();
}
