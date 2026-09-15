export const promptGroups = [
  {
    title: "Ter ideias do que postar",
    prompts: [
      {
        title: "Estou sem ideia. O que eu posso postar esta semana?",
        request:
          "Olhe meu mapa e meus posts recentes. Me dê cinco ideias que combinem com o que eu quero contar, sem repetir meus últimos posts. Diga o assunto e o que eu poderia mostrar em cada uma.",
        scope: "Para quando você trava na hora de criar",
      },
      {
        title: "Qual ideia minha vale gravar primeiro?",
        request:
          "Veja as ideias que já tenho salvas na D2C. Me ajude a escolher uma para gravar hoje e explique por que combina comigo.",
        scope: "Para tirar uma ideia do papel",
      },
      {
        title: "Como falar de novo sobre [assunto] sem ficar repetitivo?",
        request:
          "Veja o que já publiquei sobre [assunto] e meu mapa. Sugira três maneiras diferentes de voltar ao tema, com uma ideia concreta para cada post.",
        scope: "Troque [assunto] pelo tema que quer retomar",
      },
    ],
  },
  {
    title: "Escrever um roteiro para gravar",
    prompts: [
      {
        title: "Transforme esta ideia em um roteiro de 30 segundos.",
        request:
          "Minha ideia é [ideia]. Use meu mapa e exemplos dos meus próprios vídeos para escrever um roteiro de 30 segundos, com falas e sugestões simples do que mostrar.",
        scope: "Preencha [ideia] com o que quer contar",
      },
      {
        title:
          "Esse roteiro está com cara de texto de robô. Deixe mais parecido comigo.",
        request:
          "Revise este roteiro: [roteiro]. Compare com meu jeito de falar nos vídeos disponíveis. Reescreva com frases naturais, mantendo a ideia.",
        scope: "Cole o roteiro que quer melhorar",
      },
      {
        title: "Me dê três jeitos de começar este vídeo.",
        request:
          "Vou gravar sobre [assunto]. Use meu mapa e as aberturas dos meus vídeos disponíveis para sugerir três começos no meu jeito de falar, sem promessa exagerada.",
        scope: "Para sair do “Oi, gente!”",
      },
    ],
  },
  {
    title: "Melhorar um conteúdo antes de postar",
    prompts: [
      {
        title: "Vale a pena postar esta ideia no meu perfil?",
        request:
          "Minha ideia é [ideia]. Compare com meu mapa e meus posts. Diga o que combina comigo, o que está confuso e como eu poderia melhorar.",
        scope: "Para decidir antes de gastar tempo gravando",
      },
      {
        title: "Onde este roteiro fica enrolado?",
        request:
          "Leia este roteiro: [roteiro]. Mostre onde eu demoro para chegar ao ponto e o que posso cortar. Depois, faça uma versão mais curta no meu jeito de falar.",
        scope: "Cole o roteiro que quer enxugar",
      },
      {
        title: "Como terminar este vídeo sem pedir “curte e compartilha”?",
        request:
          "Este é o roteiro: [roteiro]. Sugira três finais naturais, ligados ao assunto, que convidem quem assistir a conversar comigo.",
        scope: "Para fechar o vídeo sem uma frase pronta",
      },
    ],
  },
  {
    title: "Entender meus resultados",
    prompts: [
      {
        title: "O que deu mais certo no meu perfil este mês?",
        request:
          "Analise meus posts dos últimos 30 dias. Mostre os que mais alcançaram pessoas, os mais salvos e os mais compartilhados. Explique em linguagem simples o que vale repetir ou testar.",
        scope: "Para saber onde colocar seu esforço",
      },
      {
        title: "Meu alcance caiu. O que mudou?",
        request:
          "Compare meus últimos 30 dias com os 30 anteriores. Veja alcance, quantidade de posts e formatos. Mostre o que mudou e o que os dados ainda não explicam.",
        scope: "Para investigar uma queda sem adivinhar a causa",
      },
      {
        title: "Para mim, vale mais fazer Reels ou carrosséis?",
        request:
          "Compare meus Reels e carrosséis dos últimos 90 dias. Mostre o resultado médio por post em alcance, salvamentos e compartilhamentos. Me ajude a escolher o próximo formato.",
        scope: "Para decidir o que produzir",
      },
    ],
  },
  {
    title: "Entender o crescimento do perfil",
    prompts: [
      {
        title: "Ganhei ou perdi seguidores nesta semana?",
        request:
          "Mostre como meu número de seguidores mudou nos últimos sete dias e compare com a semana anterior. Se houver dias sem dados, me avise.",
        scope: "Para acompanhar o crescimento",
      },
      {
        title: "Quais posts trouxeram mais seguidores?",
        request:
          "Liste meus posts dos últimos 90 dias com mais novos seguidores registrados. Mostre os números e os links, usando só os posts que têm esse dado.",
        scope: "Para descobrir quais conteúdos trouxeram gente nova",
      },
      {
        title: "Quais conteúdos meus as pessoas mais compartilham?",
        request:
          "Mostre meus cinco posts mais compartilhados nos últimos 90 dias. Compare os assuntos e sugira três novas ideias ligadas ao meu mapa.",
        scope: "Para criar algo que dê vontade de enviar",
      },
    ],
  },
  {
    title: "Buscar ideias em outros perfis",
    prompts: [
      {
        title: "O que o @perfil mais publica?",
        request:
          "Analise os últimos 25 posts disponíveis do @perfil. Quais assuntos e formatos aparecem mais? Me mostre exemplos com links.",
        scope: "Troque @perfil pela sua referência",
      },
      {
        title: "O que posso aprender com os melhores posts do @perfil?",
        request:
          "Encontre os posts com mais curtidas e comentários entre os últimos 25 disponíveis do @perfil. Veja o que as legendas têm em comum e sugira ideias que combinem comigo, sem copiar.",
        scope: "Para transformar uma referência em ideia própria",
      },
      {
        title: "Qual desses perfis recebe mais resposta do público?",
        request:
          "Compare @perfil1, @perfil2 e @perfil3. Mostre seguidores e a média de curtidas e comentários por post. Diga quantos posts e quais datas entraram na comparação.",
        scope: "Preencha até três perfis",
      },
    ],
  },
  {
    title: "Pesquisar marcas para uma publi",
    prompts: [
      {
        title: "Com quais criadores a @marca já fez publi?",
        request:
          "Nos posts disponíveis da @marca, encontre criadores apresentados em publicidade. Mostre quem são e os links. Separe publis identificadas de simples menções.",
        scope: "Troque @marca pela marca que quer conhecer",
      },
      {
        title: "Quem apareceu nas publis da @timbrasil no Rock in Rio?",
        request:
          "Pesquise nos posts disponíveis da @timbrasil sobre o Rock in Rio de [ano]. Liste os criadores encontrados e quantas publis de cada um aparecem nessa amostra, com links.",
        scope: "Troque marca, evento e ano para outra pesquisa",
      },
      {
        title: "Quais números meus posso mostrar para uma marca?",
        request:
          "Use meus resultados dos últimos 90 dias para montar um resumo curto para uma proposta de publi. Inclua números disponíveis, três posts de destaque e o período analisado.",
        scope: "Para apresentar seu trabalho com dados reais",
      },
    ],
  },
  {
    title: "Escolher uma collab e fazer o convite",
    prompts: [
      {
        title: "Quem na D2C combina comigo para gravar junto?",
        request:
          "Encontre criadores da D2C que falem de [assunto] e tenham relação com meu mapa. Explique por que cada um combina comigo e sugira uma ideia de vídeo juntos.",
        scope: "Troque [assunto] pelo tema da collab",
      },
      {
        title: "Qual destes três criadores combina mais comigo?",
        request:
          "Compare @perfil1, @perfil2 e @perfil3 com meu mapa. Veja os assuntos e formatos dos posts disponíveis. Me ajude a escolher um parceiro, sem presumir que temos o mesmo público.",
        scope: "Para decidir quem convidar",
      },
      {
        title: "O que eu proponho numa mensagem de collab?",
        request:
          "Quero convidar o @perfil para uma collab sobre [assunto]. Consulte meu mapa e os posts disponíveis dele. Sugira uma ideia que combine com nós dois e escreva uma mensagem curta de convite.",
        scope: "Para chegar com uma proposta concreta",
      },
    ],
  },
  {
    title: "Encontrar oportunidades de trabalho",
    prompts: [
      {
        title: "Tem alguma campanha aberta que combina comigo?",
        request:
          "Consulte as oportunidades disponíveis na D2C e meu mapa. Mostre as que mais combinam comigo, com prazo, requisitos e link para eu conferir.",
        scope: "Para encontrar uma oportunidade de publi",
      },
      {
        title: "Quais oportunidades têm cachê de pelo menos R$ [valor]?",
        request:
          "Busque oportunidades disponíveis na D2C com cachê individual confirmado de pelo menos R$ [valor]. Mostre as que combinam com meu perfil e o que cada uma pede.",
        scope: "Preencha o valor mínimo que procura",
      },
      {
        title: "Eu me encaixo nesta campanha?",
        request:
          "Compare os requisitos desta oportunidade [link ou nome] com meu perfil. Diga o que eu já atendo e o que preciso conferir antes de me candidatar.",
        scope: "Para avaliar uma oportunidade antes de se inscrever",
      },
    ],
  },
];
