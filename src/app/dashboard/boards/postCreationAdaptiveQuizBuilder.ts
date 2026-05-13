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
      title: "O que esse post precisa provocar em quem assistir?",
      helper: detection.detectedPauta ? `Vamos dar mais intenção para: ${detection.detectedPauta}.` : "Escolha a reação que deve guiar a execução.",
      mapKey: "objective",
      options: [
        option("comments", "Fazer a galera comentar", "Funciona quando a ideia tem identificação ou uma tensão boa para responder.", true),
        option("reach", "Fazer mais gente compartilhar", "Pede uma abertura simples, reconhecível e fácil de repassar."),
        option("saves", "Fazer alguém salvar pra usar depois", "Combina com dica prática, passo claro ou aprendizado reaproveitável."),
        option("brand_collab", "Abrir espaço pra marca/collab", "Ajuda a deixar a pauta útil sem perder naturalidade comercial."),
      ],
    }),
    question({
      id: "validate-how",
      type: "strategic_choice",
      title: "Onde está a força dessa ideia?",
      helper: "A melhor execução é a que deixa a ideia óbvia sem precisar explicar demais.",
      mapKey: "how",
      options: [
        option("scene_reaction", "Na sua reação", "A expressão e o timing entregam a piada ou a tensão rápido.", true),
        option("tutorial", "Na solução que você mostra", "Funciona quando a pauta resolve algo que a audiência vive."),
        option("direct_story", "Na história do jeito que você conta", "Bom quando contexto pessoal ou opinião fazem a ideia crescer."),
        option("trend", "Na trend que encaixa sem forçar", "Aumenta familiaridade se a brincadeira já combina com o tema."),
      ],
    }),
    question({
      id: "validate-hook",
      type: "strategic_choice",
      title: "O que precisa aparecer nos primeiros 2 segundos?",
      helper: "A abertura precisa entregar a tensão antes da pessoa pensar em passar.",
      mapKey: "hook",
      options: [
        option("pov", "Um POV que já coloca a pessoa dentro", "Bom para transformar contexto em cena reconhecível.", true),
        option("direct_question", "Uma pergunta que dá vontade de responder", "Faz a pessoa entrar mentalmente na conversa."),
        option("pain_sentence", "Uma frase que nomeia o incômodo", "Mostra de cara que você entendeu a situação."),
        option("practical_promise", "Uma promessa útil e direta", "Abre com valor claro para quem quer resolver algo."),
      ],
    }),
    question({
      id: "validate-cta",
      type: "preference",
      title: "Que pergunta faria a galera entrar na brincadeira?",
      helper: "O CTA bom parece continuação da cena, não aviso de fim de post.",
      mapKey: "cta",
      options: [
        option("specific_question", "Perguntar se isso também acontece com ela", "Aumenta comentários porque a pessoa só precisa se reconhecer.", true),
        option("tag_someone", "Pedir pra marcar quem vive isso", "Bom quando a situação tem cara de grupo ou amizade."),
        option("save", "Pedir pra salvar pra usar depois", "Combina com dica, lista ou passo que vale voltar."),
        option("follow", "Chamar pra acompanhar a continuação", "Funciona melhor quando a ideia pode virar série."),
      ],
    }),
    question({
      id: "validate-opportunity",
      type: "strategic_choice",
      title: "Essa pauta pode virar o quê além de um post?",
      helper: "A ideia pode continuar crescendo sem perder o jeito natural.",
      mapKey: hasCommercialSignal ? "brand" : "collab",
      options: [
        option("brand", "Uma ponte natural com marca", "Boa se existe produto, rotina ou solução aparecendo na cena.", hasCommercialSignal),
        option("collab", "Uma collab com outra visão", "Boa quando outra pessoa deixaria a situação mais rica."),
        option("series", "Uma série de variações", "Expande assunto que rende repetição sem ficar igual.", !hasCommercialSignal),
        option("organic_test", "Um teste orgânico rápido", "Mantém foco em aprender com a resposta da audiência."),
      ],
    }),
  ];
}

function discoverPautaQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "discover-objective",
      type: "strategic_choice",
      title: "Que tipo de energia você quer puxar agora?",
      helper: "Quando a tela está em branco, começar pela reação ajuda a achar a pauta.",
      mapKey: "objective",
      options: [
        option("reach", "Algo leve pra mais gente ver", "Pede uma ideia simples, forte e compartilhável.", true),
        option("comments", "Algo que puxe conversa", "Pede tensão, identificação ou pergunta boa."),
        option("authority", "Algo que mostre seu ponto de vista", "Pede critério, opinião ou bastidor com substância."),
        option("brands", "Algo que deixe marcas de olho", "Pede contexto real de uso e encaixe comercial natural."),
      ],
    }),
    question({
      id: "discover-format",
      type: "preference",
      title: "O que você realmente topa produzir hoje?",
      helper: "A melhor ideia é a que sai do papel sem virar uma novela de produção.",
      mapKey: "format",
      options: [
        option("simple_reels", "Um reels simples e gravável", "Boa relação entre velocidade, clareza e alcance.", true),
        option("carousel", "Um carrossel bem salvável", "Bom quando a ideia precisa de ordem e consulta depois."),
        option("behind_scenes", "Um bastidor real", "Funciona quando existe processo acontecendo para mostrar."),
        option("story", "Um story pra testar conversa", "Bom para sentir a resposta antes de virar post maior."),
      ],
    }),
    question({
      id: "discover-narrative",
      type: "strategic_choice",
      title: "De onde essa pauta pode nascer com mais verdade?",
      helper: "Uma pauta boa costuma sair de algo que você já vive, observa ou escuta.",
      mapKey: "narrative",
      options: [
        option("real_routine", "Da sua rotina real", "Dá contexto, cena e naturalidade.", true),
        option("opinion", "De uma opinião que você segurou", "Bom para posicionamento e comentário."),
        option("backstage", "Do bastidor do que você faz", "Mostra processo e aproxima quem acompanha."),
        option("audience_pain", "De uma dor que a audiência vive", "Bom para conversa, salvamento e próximos posts."),
      ],
    }),
    question({
      id: "discover-effort",
      type: "constraint",
      title: "Quanto fôlego você tem pra esse conteúdo?",
      helper: "A ideia precisa caber no seu dia, não só ficar bonita no plano.",
      mapKey: "effort",
      options: [
        option("low", "Baixo, quero resolver rápido", "Uma cena, uma ideia e pouca produção.", true),
        option("medium", "Médio, dá pra caprichar um pouco", "Roteiro curto com exemplo ou virada."),
        option("high", "Alto, quero construir melhor", "Mais cenas, prova, edição e acabamento."),
        option("batch", "Quero gravar mais de uma ideia de uma vez", "Bom para aproveitar energia de produção, mas pode diluir a precisão de cada pauta."),
      ],
    }),
  ];
}

function createByGoalQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "goal-response",
      type: "strategic_choice",
      title: "O que você quer que aconteça depois que alguém assistir?",
      helper: "A meta fica mais clara quando vira comportamento de audiência.",
      mapKey: "objective",
      options: [
        option("comments", "A pessoa comentar na hora", "Pede pergunta, tensão ou identificação.", true),
        option("shares", "Ela mandar pra alguém", "Pede frase forte e fácil de repassar."),
        option("saves", "Ela salvar pra voltar depois", "Pede utilidade, ordem e clareza."),
        option("clicks", "Ela seguir para o próximo passo", "Pede promessa objetiva e motivo para agir."),
      ],
    }),
    question({
      id: "goal-narrative",
      type: "preference",
      title: "Qual caminho combina mais com seu jeito de falar?",
      helper: "O conteúdo performa melhor quando parece seu, não uma fantasia de estratégia.",
      mapKey: "narrative",
      options: [
        option("humor", "Brincar com a situação", "Bom para alcance e identificação.", true),
        option("opinion", "Falar sem rodeio", "Bom para comentário e autoridade."),
        option("backstage", "Mostrar o bastidor", "Bom para proximidade e confiança."),
        option("tutorial", "Ensinar de um jeito simples", "Bom para salvamento e clareza."),
      ],
    }),
    question({
      id: "goal-format",
      type: "strategic_choice",
      title: "Qual formato dá mais chance desse objetivo acontecer?",
      helper: "O formato certo faz a reação desejada parecer mais fácil.",
      mapKey: "format",
      options: [
        option("reels", "Reels direto ao ponto", "Melhor para alcance e resposta rápida.", true),
        option("carousel", "Carrossel organizado", "Melhor para salvar, comparar e consultar."),
        option("stories", "Stories em conversa", "Melhor para teste e resposta imediata."),
        option("photo_post", "Post foto com legenda forte", "Melhor para opinião curta ou contexto visual."),
      ],
    }),
    question({
      id: "goal-cta",
      type: "strategic_choice",
      title: "Qual convite deixa o próximo passo óbvio?",
      helper: "O CTA não precisa gritar. Ele só precisa continuar a intenção do post.",
      mapKey: "cta",
      options: [
        option("answer_question", "Responder uma pergunta específica", "Direto para comentários.", true),
        option("send_to_friend", "Enviar para quem precisa ver", "Direto para compartilhamento."),
        option("save_for_later", "Salvar pra usar depois", "Direto para salvamentos."),
        option("click_link", "Clicar porque tem algo útil lá", "Direto para conversão."),
      ],
    }),
  ];
}

function formatGuidanceQuestions(detection: PostCreationAdaptiveIntentDetection): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "format-narrative",
      type: "strategic_choice",
      title: "Onde está a força principal dessa pauta?",
      helper: "Antes de escolher o formato, vale entender o que precisa carregar a ideia.",
      mapKey: "narrative",
      options: [
        option("scene_motion", "Cena, reação ou movimento", "Pede vídeo curto, ritmo e contexto visual rápido.", true),
        option("step_by_step", "Lista, passo a passo ou organização", "Pede estrutura clara para a pessoa consultar ou salvar."),
        option("opinion_positioning", "Opinião, tensão ou posicionamento", "Pede fala direta, argumento e ponto de vista."),
        option("backstage_context", "Bastidor, contexto ou rotina real", "Pede proximidade e construção de cena com naturalidade."),
      ],
    }),
    question({
      id: "format-objective",
      type: "strategic_choice",
      title: "Qual reação esse conteúdo deveria puxar primeiro?",
      helper: "O formato fica mais claro quando a intenção da audiência está definida.",
      mapKey: "objective",
      options: [
        option("reach", "Alcance e descoberta", "Pede formato fácil de entender e compartilhar rápido.", true),
        option("saves", "Salvamento e consulta", "Pede estrutura clara, lista ou passo que a pessoa queira rever."),
        option("comments", "Comentário e conversa", "Pede identificação, tensão ou pergunta que abra resposta."),
        option("clicks", "Clique ou conversão", "Pede promessa objetiva e motivo claro para o próximo passo."),
      ],
    }),
    question({
      id: "format-hook",
      type: "strategic_choice",
      title: "Como a ideia precisa abrir para segurar atenção?",
      helper: "A abertura indica se a pauta precisa mostrar, prometer, perguntar ou comparar.",
      mapKey: "hook",
      options: [
        option("visual_tension", "Tensão visual imediata", "Funciona quando a pessoa entende a cena antes da explicação.", true),
        option("practical_promise", "Promessa prática", "Funciona quando o valor está em resolver algo de forma clara."),
        option("direct_question", "Pergunta direta", "Funciona quando o conteúdo depende de identificação ou opinião."),
        option("contrast", "Antes/depois ou contraste", "Funciona quando a diferença precisa aparecer rápido."),
      ],
    }),
    question({
      id: "format-effort",
      type: "constraint",
      title: "Quanto esforço de produção cabe agora?",
      helper: "O melhor formato também precisa caber no tempo e na energia disponíveis.",
      mapKey: "effort",
      options: [
        option("low", "Baixo, quero decidir e postar rápido", "Favorece stories, foto com legenda ou reels simples.", true),
        option("medium", "Médio, dá pra estruturar melhor", "Favorece carrossel curto ou reels com roteiro enxuto."),
        option("high", "Alto, quero caprichar na entrega", "Favorece vídeo com cenas, edição e prova visual."),
        option("batch", "Quero gravar em lote", "Bom para aproveitar produção, mas exige formatos fáceis de repetir."),
      ],
    }),
    question({
      id: "format-primary",
      type: "strategic_choice",
      title: "Com essa leitura, qual formato parece mais coerente?",
      helper: detection.detectedPauta
        ? `Agora sim, vamos escolher o formato mais coerente para: ${detection.detectedPauta}.`
        : "Agora sim, o formato entra como consequência da intenção, da execução e do esforço.",
      mapKey: "format",
      options: [
        option("reels", "Reels", "Faz sentido quando a força está em cena, ritmo, reação ou movimento.", true),
        option("carousel", "Carrossel", "Faz sentido quando a ideia precisa de ordem, comparação ou consulta depois."),
        option("photo_post", "Foto com legenda forte", "Faz sentido quando imagem e opinião carregam a mensagem sem muita edição."),
        option("stories", "Stories", "Faz sentido quando a intenção é testar conversa rápida ou bastidor próximo."),
      ],
    }),
  ];
}

function brandMatchQuestions(detection: PostCreationAdaptiveIntentDetection): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "brand-category",
      type: "strategic_choice",
      title: "Que tipo de marca caberia naturalmente no seu conteúdo?",
      helper: detection.brandCategory ? `Parece que existe um caminho com ${detection.brandCategory}.` : "Escolha o território comercial que entraria sem cara de interrupção.",
      mapKey: "brand",
      options: [
        option("beauty_selfcare", "Beleza ou autocuidado", "Entra bem em rotina, pausa, preparação e transformação.", detection.brandCategory === "beleza" || detection.brandCategory === "skincare"),
        option("technology", "Tecnologia do dia a dia", "Funciona como ferramenta, solução ou conflito cotidiano."),
        option("home_comfort", "Casa, conforto e rotina", "Combina com cenas domésticas, bem-estar e vida real."),
        option("food_wellness", "Alimentação e bem-estar", "Entra bem em energia, cuidado, pausa e hábito."),
      ],
    }),
    question({
      id: "brand-how",
      type: "strategic_choice",
      title: "Como a marca entra sem parecer interrupção?",
      helper: "O melhor encaixe comercial resolve ou melhora algo que já está acontecendo.",
      mapKey: "how",
      options: [
        option("natural_solution", "Como solução natural da cena", "Reduz sensação de publi forçada.", true),
        option("routine_item", "Como item que já estaria ali", "Bom para produto recorrente e hábito real."),
        option("review", "Como opinião com critério", "Bom quando a audiência precisa entender se vale a pena."),
        option("direct_ad", "Como proposta assumida", "Funciona quando a oferta é clara e combina com o perfil."),
      ],
    }),
    question({
      id: "brand-narrative",
      type: "strategic_choice",
      title: "Qual história faz a marca parecer parte do assunto?",
      helper: "A narrativa boa cria motivo para a marca estar ali.",
      mapKey: "narrative",
      options: [
        option("problem_solution", "Um problema que ela resolve", "Cria encaixe comercial claro.", true),
        option("real_routine", "Uma rotina onde ela aparece", "Mostra contexto de uso sem discurso forçado."),
        option("transformation", "Uma mudança antes e depois", "Bom quando o produto ajuda a visualizar resultado."),
        option("backstage", "Um bastidor com ferramenta", "Bom para mostrar processo, escolha e critério."),
      ],
    }),
    question({
      id: "brand-format",
      type: "preference",
      title: "Qual entrega venderia a ideia sem pesar a mão?",
      helper: "A entrega precisa caber no tipo de marca e no jeito que você já cria.",
      mapKey: "format",
      options: [
        option("reels", "Reels com cena clara", "Bom para narrativa, demonstração e alcance.", true),
        option("stories", "Stories com conversa", "Bom para demonstração rápida e resposta."),
        option("carousel", "Carrossel com argumento", "Bom para prova, comparação e salvamento."),
        option("package", "Pacote com pontos de contato", "Bom para campanha que precisa aparecer mais de uma vez."),
      ],
    }),
    question({
      id: "brand-why",
      type: "strategic_choice",
      title: "Qual argumento faria a marca entender o match?",
      helper: "Pense no motivo que deixaria a parceria fácil de defender.",
      mapKey: "why",
      options: [
        option("organic_match", "O encaixe é natural", "Defende que a marca já cabe na narrativa.", true),
        option("audience_pain", "A audiência sente essa dor", "Mostra relevância para quem assiste."),
        option("usage_context", "O produto aparece em uso real", "Defende presença concreta, não decorativa."),
        option("data_proof", "Existe prova de performance", "Ajuda quando a conversa precisa de resultado."),
      ],
    }),
  ];
}

function collabMatchQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "collab-type",
      type: "strategic_choice",
      title: "Que tipo de creator acrescentaria algo real?",
      helper: "A collab precisa trazer contraste, repertório ou cena, não só mais uma pessoa no vídeo.",
      mapKey: "collab",
      options: [
        option("reaction", "Alguém para reagir junto", "Fácil de executar e bom para comentário.", true),
        option("debate", "Alguém com outra opinião", "Bom para contraste e autoridade."),
        option("challenge", "Alguém para entrar em desafio", "Bom para alcance e participação."),
        option("joint_scene", "Alguém para dividir a cena", "Bom para humor ou narrativa cotidiana."),
      ],
    }),
    question({
      id: "collab-who",
      type: "strategic_choice",
      title: "Quem faria essa ideia crescer de verdade?",
      helper: "O parceiro ideal adiciona tensão, prova ou público novo.",
      mapKey: "who",
      options: [
        option("same_niche", "Alguém do mesmo nicho", "Aumenta precisão da conversa.", true),
        option("complementary_niche", "Alguém de nicho complementar", "Cria ponte para audiência nova."),
        option("similar_audience", "Alguém com audiência parecida", "Facilita identificação e troca real."),
        option("larger_creator", "Alguém maior para validar", "Prioriza alcance e prova social."),
      ],
    }),
    question({
      id: "collab-objective",
      type: "strategic_choice",
      title: "O que faria essa collab valer a pena?",
      helper: "Sem um papel claro, collab vira participação solta.",
      mapKey: "objective",
      options: [
        option("reach", "Chegar em mais gente", "Pede formato simples e compartilhável.", true),
        option("comments", "Criar conversa nos comentários", "Pede tensão ou discordância saudável."),
        option("authority", "Mostrar repertório", "Pede troca de critério ou experiência."),
        option("brand", "Abrir ponte com marca", "Pede narrativa com potencial comercial."),
      ],
    }),
    question({
      id: "collab-narrative",
      type: "strategic_choice",
      title: "Qual dinâmica justifica as duas pessoas no conteúdo?",
      helper: "A collab fica melhor quando a presença de cada creator muda a história.",
      mapKey: "narrative",
      options: [
        option("opinion_contrast", "Contraste de opiniões", "Cria tensão produtiva.", true),
        option("shared_experience", "Experiência compartilhada", "Cria identificação e conversa."),
        option("before_after", "Antes e depois", "Cria transformação clara."),
        option("humor", "Humor de dupla", "Cria leveza e alcance."),
      ],
    }),
  ];
}

function commentToPostQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "comment-why",
      type: "strategic_choice",
      title: "O que esse comentário está te entregando?",
      helper: "Por trás de um comentário pode ter dúvida, dor, piada ou pauta inteira.",
      mapKey: "why",
      options: [
        option("question", "Uma dúvida real", "Pede resposta clara e útil.", true),
        option("identification", "Uma identificação forte", "Pede POV ou cena reconhecível."),
        option("frustration", "Uma frustração escondida", "Pede acolhimento e virada prática."),
        option("tip_request", "Um pedido de dica", "Pede tutorial curto e direto."),
      ],
    }),
    question({
      id: "comment-format",
      type: "strategic_choice",
      title: "Qual resposta vira conteúdo, e não só reply?",
      helper: "O comentário pode ser ponto de partida para algo que mais gente reconhece.",
      mapKey: "format",
      options: [
        option("reply_reels", "Reels respondendo o comentário", "Aproveita o contexto e mostra que veio da audiência.", true),
        option("carousel", "Carrossel com resposta em partes", "Organiza a ideia para salvar e consultar."),
        option("story", "Story para abrir conversa", "Bom para resposta imediata e novas perguntas."),
        option("direct_video", "Vídeo direto olhando pra câmera", "Bom para opinião ou explicação curta."),
      ],
    }),
    question({
      id: "comment-narrative",
      type: "strategic_choice",
      title: "Qual ângulo faz esse comentário render mais?",
      helper: "A resposta pode ensinar, virar cena ou marcar seu posicionamento.",
      mapKey: "narrative",
      options: [
        option("practical_answer", "Responder com algo aplicável", "Entrega valor direto.", true),
        option("pov", "Transformar em POV", "Faz o comentário virar cena."),
        option("opinion", "Assumir uma opinião", "Bom para posicionamento."),
        option("backstage", "Mostrar como você lida com isso", "Traz bastidor e prova prática."),
      ],
    }),
    question({
      id: "comment-cta",
      type: "strategic_choice",
      title: "Como puxar mais comentários a partir desse?",
      helper: "O melhor CTA transforma uma resposta em fila de próximas pautas.",
      mapKey: "cta",
      options: [
        option("anyone_else", "Perguntar quem mais passa por isso", "Aumenta identificação.", true),
        option("ask_examples", "Pedir exemplos parecidos", "Gera repertório para novos conteúdos."),
        option("ask_questions", "Pedir novas dúvidas", "Abre fila de respostas."),
        option("save", "Pedir pra salvar a resposta", "Funciona quando a resposta é prática."),
      ],
    }),
  ];
}

function weeklyPlanQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "weekly-objective",
      type: "strategic_choice",
      title: "Qual clima essa semana precisa ter?",
      helper: "Uma semana boa tem intenção clara, não só uma lista de posts.",
      mapKey: "objective",
      options: [
        option("grow", "Mais descoberta", "Prioriza alcance e posts fáceis de compartilhar.", true),
        option("engage", "Mais conversa", "Prioriza comunidade, resposta e bastidor."),
        option("sell", "Mais intenção de compra", "Prioriza oferta, prova e clareza."),
        option("brands", "Mais vitrine para marcas", "Prioriza narrativa comercial orgânica."),
      ],
    }),
    question({
      id: "weekly-schedule",
      type: "constraint",
      title: "Quantos conteúdos você realmente consegue sustentar?",
      helper: "Cadência boa é a que você consegue cumprir sem matar a qualidade.",
      mapKey: "schedule",
      options: [
        option("two", "2 conteúdos", "Plano leve, com foco em qualidade."),
        option("three", "3 conteúdos", "Boa cadência para consistência.", true),
        option("five", "5 conteúdos", "Semana forte sem exigir todo dia."),
        option("daily", "Todos os dias", "Boa para sprint de crescimento."),
      ],
    }),
    question({
      id: "weekly-format",
      type: "preference",
      title: "Qual mistura deixa a semana mais viva?",
      helper: "A mistura define quando você alcança, aprofunda e conversa.",
      mapKey: "format",
      options: [
        option("reels_stories", "Reels + stories", "Combina alcance e conversa.", true),
        option("reels_carousel", "Reels + carrossel", "Combina alcance e salvamento."),
        option("only_reels", "Só reels por enquanto", "Foco total em descoberta."),
        option("full_mix", "Mistura completa", "Bom para semana editorial mais rica."),
      ],
    }),
    question({
      id: "weekly-narrative",
      type: "strategic_choice",
      title: "Qual fio deve costurar os posts da semana?",
      helper: "Esse eixo evita que cada conteúdo pareça uma ideia solta.",
      mapKey: "narrative",
      options: [
        option("strongest", "O que já costuma funcionar", "Explora um caminho que tende a performar.", true),
        option("new", "Um teste novo", "Abre espaço para aprendizado."),
        option("commercial", "Uma vitrine comercial discreta", "Prepara oportunidade de marca ou venda."),
        option("community", "Uma conversa com a comunidade", "Puxa pertencimento e resposta."),
      ],
    }),
  ];
}

function unknownQuestions(): PostCreationAdaptiveQuestion[] {
  return [
    question({
      id: "unknown-intent",
      type: "confirmation",
      title: "Vamos achar o melhor caminho pra começar?",
      helper: "Escolha o ponto de partida que mais parece com o que você precisa hoje.",
      mapKey: "objective",
      options: [
        option("validate_pauta", "Tenho uma ideia e quero melhorar", "Vamos lapidar execução, gancho e próximo passo.", true),
        option("discover_pauta", "Quero sair do branco", "Vamos encontrar uma pauta gravável."),
        option("brand_match", "Quero abrir espaço pra marca", "Vamos procurar um encaixe comercial natural."),
        option("weekly_plan", "Quero organizar a semana", "Vamos montar uma cadência possível."),
      ],
    }),
    question({
      id: "unknown-what",
      type: "confirmation",
      title: "Você já tem alguma faísca de conteúdo?",
      helper: "Mesmo uma ideia pequena já ajuda a escolher o próximo passo.",
      mapKey: "what",
      options: [
        option("yes", "Sim, tenho uma ideia", "Vamos refinar execução.", true),
        option("no", "Ainda não", "Vamos descobrir um caminho."),
        option("goal_only", "Tenho só um objetivo", "Vamos transformar meta em narrativa."),
        option("comment", "Tenho um comentário da audiência", "Vamos transformar resposta em post."),
      ],
    }),
    question({
      id: "unknown-objective",
      type: "strategic_choice",
      title: "Se esse conteúdo desse certo, o que aconteceria?",
      helper: "Mesmo com intenção aberta, a reação desejada já cria direção.",
      mapKey: "objective",
      options: [
        option("reach", "Mais gente descobriria você", "Pede abertura forte e formato simples.", true),
        option("comments", "As pessoas responderiam", "Pede identificação ou pergunta."),
        option("authority", "Você mostraria mais critério", "Pede opinião, experiência ou prova."),
        option("brand", "Uma marca enxergaria potencial", "Pede contexto comercial orgânico."),
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
  if (mode === "format_guidance") return formatGuidanceQuestions(params.detection);
  if (mode === "brand_match") return brandMatchQuestions(params.detection);
  if (mode === "collab_match") return collabMatchQuestions();
  if (mode === "comment_to_post") return commentToPostQuestions();
  if (mode === "weekly_plan") return weeklyPlanQuestions();
  return unknownQuestions();
}
