import { promises as fs } from "node:fs";
import path from "node:path";

const source = path.resolve("output/reunioes/2026-07-16/deck.json");
const target = path.resolve("output/reunioes/2026-07-16-completo/deck.json");
const deck: any = JSON.parse(await fs.readFile(source, "utf8"));

deck.reuniao.participantes = deck.reuniao.participantes.map((p: string) =>
  /debora broch/i.test(p)
    ? "@deborabroch"
    : /camila barros/i.test(p)
      ? "@caamilabarross"
      : p === "@brunaarrudaoficial"
        ? "@riocomerebeber"
        : p,
);

if (!deck.reuniao.participantes.includes("@amandamol_")) {
  const amandaMagalhaesIndex = deck.reuniao.participantes.indexOf("@aamandamag");
  deck.reuniao.participantes.splice(amandaMagalhaesIndex + 1, 0, "@amandamol_");
}

// URLs do Instagram expiram. A nova hidratação deve puxar todas novamente do contexto fresco.
for (const c of deck.criadores) {
  delete c.userId;
  delete c.profilePictureUrl;
  delete c.grafico;
  if (c.pontoForte) delete c.pontoForte.thumbnailUrl;
  if (c.pontoAjustar) delete c.pontoAjustar.thumbnailUrl;
  if (c.reel) {
    delete c.reel.posterUrl;
    delete c.reel.videoPath;
  }
}

const replace = (matcher: (c: any) => boolean, value: any) => {
  const index = deck.criadores.findIndex(matcher);
  if (index < 0) throw new Error(`Criador não encontrado para substituição: ${value.nome}`);
  deck.criadores[index] = value;
};

if (!deck.criadores.some((c: any) => c.handle === "@amandamol_")) {
  const amandaMagalhaesIndex = deck.criadores.findIndex((c: any) => c.handle === "@aamandamag");
  deck.criadores.splice(amandaMagalhaesIndex + 1, 0, {
    handle: "@amandamol_",
    nome: "Amanda Mol",
    narrativaCentral: "Maternidade real, relações familiares e sono infantil explicados com experiência e neurociência",
    territorios: ["Maternidade", "Sono infantil", "Relações familiares", "Educação dos filhos", "Autocuidado materno"],
    pontoForte: {
      texto: "Amanda contou a conversa com o pai enquanto pensa em como cria os próprios filhos. A cena trouxe 14 pessoas para a conversa.",
      evidencia: "O post de 15 de julho teve 14 comentários e 106 interações — a resposta veio pela identificação com a história de duas gerações.",
      postId: "18402920242085002",
      stat: { valor: "14", label: "comentários" },
      selos: { narrativa: "verde", audiencia: "amarelo", marca: "amarelo" },
    },
    pontoAjustar: {
      texto: "A pergunta sobre a ‘janela de ouro’ ficou aberta. Faltou ligar a experiência pessoal ao que Amanda sabe sobre infância e sono.",
      evidencia: "Mesmo com 14 comentários, o post não teve salvamentos nem compartilhamentos. A história aproximou; uma resposta prática faria o conteúdo viajar.",
      postId: "18402920242085002",
      selos: { narrativa: "verde", audiencia: "amarelo", marca: "amarelo" },
    },
    coerencia: {
      status: "no-mapa",
      resumo: "A conversa com o pai mostrou Amanda no meio de duas gerações: ainda filha e, ao mesmo tempo, responsável por criar os próprios filhos.",
    },
    audienciaPede: "Levar a reflexão um passo adiante: explicar como conversas, pausas e sono mudam conforme os filhos crescem.",
    numeros: [
      { valor: "1", label: "post na semana" },
      { valor: "14", label: "pessoas comentaram" },
    ],
    ganchoMarca: {
      categoria: "sono e cuidado que respeitam a rotina da família",
      exemplo: "Fisher-Price",
      porque: "Amanda une conhecimento sobre sono infantil às escolhas reais de uma casa com filhos",
    },
    proximosPassos: {
      lacuna: "a história pessoal abriu a conversa; agora o conhecimento sobre sono infantil pode transformar essa identificação em ajuda prática",
      pautas: [
        {
          titulo: "Existe mesmo uma janela de ouro? O que a ciência diz — e o que meus filhos me ensinaram",
          porque: "Responde à pergunta do post da semana e junta neurociência, maternidade e experiência própria.",
        },
        {
          titulo: "Quando meus filhos me esperam acordados: como faço a volta para a cama",
          porque: "Retoma uma cena que já apareceu no perfil e transforma a rotina noturna em orientação concreta.",
        },
        {
          titulo: "Meu pai, meus filhos e uma conversa que mudou de geração",
          porque: "Continua a história que trouxe 14 comentários e mostra o que Amanda escolheu fazer diferente em casa.",
        },
      ],
    },
  });
}

replace((c: any) => c.handle === "@blununees", {
  handle: "@blununees",
  nome: "Blu Nunes",
  semSinal: true,
  retomadaFonte: "mapa",
  narrativaCentral: "Uma mãe real que encontra beleza e humor na rotina",
  territorios: ["Maternidade", "Beleza", "Autocuidado", "Cuidados capilares", "Vida familiar"],
  falaSugerida: "O Instagram está desconectado. O último post lido é de 21 de maio; hoje usamos o mapa para planejar uma volta simples.",
  numeros: [
    { valor: "21/05", label: "último post disponível" },
    { valor: "146", label: "posts no histórico" },
  ],
  ganchoMarca: {
    categoria: "beleza prática para a rotina com filhos",
    exemplo: "Lola Cosmetics",
    porque: "cabelo, autocuidado e maternidade já aparecem juntos no mapa e no histórico dela",
  },
  proximosPassos: {
    lacuna: "não há dados novos desde maio; a retomada precisa caber na casa e na rotina real",
    pautas: [
      {
        titulo: "Arrumo o cabelo em dez minutos — com duas interrupções no meio",
        porque: "Mostra cuidado capilar do jeito que ele realmente acontece para uma mãe.",
      },
      {
        titulo: "Cada filho escolhe um produto da minha nécessaire",
        porque: "As crianças entram na cena e a recomendação vira conversa de família.",
      },
      {
        titulo: "Ter mais de um filho: uma vantagem e uma dificuldade que ninguém me contou",
        porque: "Retoma uma pergunta que já gerou conversa e agora pede uma resposta mais pessoal.",
      },
    ],
  },
});

replace((c: any) => /debora broch/i.test(c.handle ?? c.nome), {
  handle: "@deborabroch",
  nome: "Débora Broch",
  narrativaCentral: "Uma mãe que encontra força e propósito na jornada da maternidade",
  territorios: ["Maternidade", "Fé", "Bem-estar", "Autocuidado", "Crescimento pessoal", "Espiritualidade"],
  pontoForte: {
    texto: "Quando Débora ri dos sintomas dos 35+, outras mulheres se reconhecem e mandam o vídeo umas para as outras.",
    evidencia: "O reel teve 791 compartilhamentos e 59 comentários — foi, com folga, o assunto que mais circulou na semana.",
    postId: "17914586346222230",
    stat: { valor: "791", label: "compartilhamentos" },
    selos: { narrativa: "verde", audiencia: "verde", marca: "verde" },
  },
  pontoAjustar: {
    texto: "Na publi da roupa infantil, faltou colocar as filhas escolhendo, usando ou reagindo às peças.",
    evidencia: "O post ficou em 1 compartilhamento e nenhum salvamento; o produto apareceu, mas a vida da família não entrou em cena.",
    postId: "18090372428384883",
    selos: { narrativa: "vermelho", audiencia: "vermelho", marca: "amarelo" },
  },
  coerencia: {
    status: "parcial",
    resumo: "Humor sobre os 35+ e o cabelo maluco aproximaram Débora da vida real. A publi de roupa infantil perdeu essa presença da família.",
  },
  audienciaPede: "Na próxima publi, abrir com uma filha escolhendo a peça e explicar por que aquela escolha faz sentido na rotina dela.",
  comparativo: "A ideia de mostrar o antes e o depois apareceu no vídeo gravado no mesmo lugar com oito anos de diferença; agora falta contar o que mudou por dentro.",
  reel: { postId: "17914586346222230" },
  numeros: [
    { valor: "4", label: "posts na semana" },
    { valor: "791", label: "compartilhamentos no pico" },
  ],
  ganchoMarca: {
    categoria: "autocuidado e bem-estar para mulheres 35+",
    exemplo: "Nivea",
    porque: "o humor abre a conversa e a rotina de mãe mostra onde o cuidado realmente precisa caber",
  },
  proximosPassos: {
    lacuna: "o humor circulou muito; agora ele pode puxar uma sequência mais pessoal sobre idade, filhas e autocuidado",
    pautas: [
      {
        titulo: "Minha filha avalia os sintomas dos 35+ que eu já tenho",
        porque: "Continua o assunto mais compartilhado e coloca a relação entre mãe e filha no centro.",
      },
      {
        titulo: "O mesmo lugar, oito anos depois: três coisas que mudaram em mim",
        porque: "Dá palavras ao vídeo emocional e transforma a comparação em história.",
      },
      {
        titulo: "Cabelo maluco: o passo que quase deu errado",
        porque: "O tutorial já foi guardado; o bastidor acrescenta humor e uma cena real com a filha.",
      },
    ],
  },
});

replace((c: any) => /camila barros/i.test(c.nome), {
  handle: "@caamilabarross",
  nome: "Dra. Camila Barros",
  narrativaCentral: "Sou fisioterapeuta e mostro o movimento na minha rotina",
  territorios: ["Fisioterapia", "Movimento", "Rotina"],
  semSinal: true,
  retomadaFonte: "mapa",
  falaSugerida: "Não houve post entre 10 e 16 de julho. O histórico vai até 9 de junho — e o mapa já aponta a volta: fisioterapia, movimento e rotina.",
  numeros: [
    { valor: "09/06", label: "último post disponível" },
    { valor: "131", label: "posts no histórico" },
  ],
  ganchoMarca: {
    categoria: "movimento e bem-estar que cabem na rotina",
    exemplo: "Track&Field",
    porque: "a fisioterapia dá contexto técnico e a rotina mostra como o movimento acontece fora da academia",
  },
  proximosPassos: {
    lacuna: "o mapa está claro, mas não há sinal novo desde junho; a volta pode começar com movimentos que ela já faz no próprio dia",
    pautas: [
      {
        titulo: "O movimento que eu faço depois de passar horas sentada",
        porque: "Leva a fisioterapia para uma situação comum e mostra a orientação dentro da rotina dela.",
      },
      {
        titulo: "Ganhei massa magra: o que mudou no meu treino — e o que não mudou",
        porque: "Retoma um post do fim de maio e acrescenta a leitura de quem trabalha com movimento.",
      },
      {
        titulo: "Meu aquecimento de três minutos antes da corrida",
        porque: "Usa a corrida que já apareceu no perfil e transforma conhecimento técnico em uma sequência fácil de acompanhar.",
      },
    ],
  },
});

replace((c: any) => c.handle === "@brunaarrudaoficial", {
  handle: "@riocomerebeber",
  nome: "Bruna Ramos",
  narrativaCentral: "Sinal histórico: descobertas gastronômicas e viagens contadas com preço, contexto e opinião",
  territorios: ["Gastronomia", "Rio de Janeiro", "Viagens"],
  semSinal: true,
  retomadaFonte: "historico",
  falaSugerida: "O Instagram está desconectado. A última leitura terminou em 23 de maio, quando o café da manhã no Pende teve 61 salvamentos e 98 compartilhamentos.",
  numeros: [
    { valor: "23/05", label: "último post disponível" },
    { valor: "208", label: "posts no histórico" },
  ],
  ganchoMarca: {
    categoria: "cafés e restaurantes que querem virar destino no Rio",
    exemplo: "Pende Café",
    porque: "preço, atendimento e o que pedir transformam a visita em uma recomendação que ajuda a decidir",
  },
  proximosPassos: {
    lacuna: "não há dados novos desde maio; a volta pode retomar o formato que combina descoberta, preço e opinião pessoal",
    pautas: [
      {
        titulo: "Café da manhã no Rio: o que eu pediria de novo e o que eu trocaria",
        porque: "Continua a visita ao Pende com uma opinião mais pessoal sobre cada escolha.",
      },
      {
        titulo: "Pende ou Nolitan: qual vale pelo prato e qual vale pelo atendimento",
        porque: "Cruza dois lugares do histórico e ajuda quem está escolhendo onde ir na Barra.",
      },
      {
        titulo: "São Miguel dos Milagres: três escolhas que mudam o orçamento da viagem",
        porque: "Retoma o guia que já foi salvo e acrescenta a decisão prática que faltava: onde vale gastar.",
      },
    ],
  },
});

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `${JSON.stringify(deck, null, 2)}\n`);
console.log(target);
