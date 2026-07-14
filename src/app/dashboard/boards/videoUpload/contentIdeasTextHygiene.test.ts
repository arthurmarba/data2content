import {
  repairKnownPortugueseArtifacts,
  repairMangledAccents,
  repairSeparatedAccents,
  cleanIdeaText,
  stripIronicQuotes,
} from "./contentIdeasTextHygiene";

describe("repairMangledAccents", () => {
  it("conserta um acento mutilado no meio da palavra", () => {
    expect(repairMangledAccents("com a cabe00e7a no surf")).toBe("com a cabeça no surf");
  });

  it("conserta acentos em sequência (ç + õ encostados)", () => {
    expect(repairMangledAccents("imperfei00e700f5es")).toBe("imperfeições");
  });

  it("cobre a faixa de acentos do português (á ê ç ã ó)", () => {
    expect(repairMangledAccents("00e1gua")).toBe("água"); // á
    expect(repairMangledAccents("voc00ea")).toBe("você"); // ê
    expect(repairMangledAccents("cora00e700e3o")).toBe("coração"); // ç + ã encostados
    expect(repairMangledAccents("av00f3")).toBe("avó"); // ó
  });

  it("conserta maiúsculas acentuadas (À–Ý)", () => {
    expect(repairMangledAccents("00c1gua")).toBe("Água"); // Á
  });

  it("NÃO toca sequência isolada por espaços (sem letra adjacente)", () => {
    expect(repairMangledAccents("custa 00e7 reais")).toBe("custa 00e7 reais");
  });

  it("NÃO toca codepoints fora da faixa de letras (a0–bf: símbolos)", () => {
    // 00aa (ª) está fora de [c-f] → não decodifica
    expect(repairMangledAccents("1a00aa")).toBe("1a00aa");
  });

  it("string vazia/limpa passa intacta", () => {
    expect(repairMangledAccents("")).toBe("");
    expect(repairMangledAccents("texto sem acento mutilado")).toBe("texto sem acento mutilado");
  });
});

describe("cleanIdeaText", () => {
  it("conserta acento E remove aspas irônicas, na ordem certa", () => {
    expect(cleanIdeaText("a 'cabe00e7a' no jogo")).toBe("a cabeça no jogo");
  });

  it("conserta acentos separados por espaços sem colar palavras vizinhas", () => {
    expect(cleanIdeaText("Muitos acham que IA tira a alma da cria ç ão.")).toBe(
      "Muitos acham que IA tira a alma da criação.",
    );
    expect(cleanIdeaText("Eu aprendi que ela me d á mais liberdade.")).toBe(
      "Eu aprendi que ela me dá mais liberdade.",
    );
  });

  it("conserta quebras reais salvas no banco entre prefixo e acento", () => {
    expect(cleanIdeaText("Como a intelig\r\n\r\nência artificial me ajuda na cria\r\n\r\nç\r\n\r\não")).toBe(
      "Como a inteligência artificial me ajuda na criação",
    );
    expect(cleanIdeaText("Eu aprendi que ela me d\r\n\r\nm\r\n\r\ná mais liberdade.")).toBe(
      "Eu aprendi que ela me dá mais liberdade.",
    );
  });

  it("conserta artefato de título que troca ninguém por ninguR", () => {
    expect(cleanIdeaText("A verdade sobre gravar sem depender de ninguR")).toBe(
      "A verdade sobre gravar sem depender de ninguém",
    );
    expect(cleanIdeaText("A verdade sobre gravar sem depender de ningu R")).toBe(
      "A verdade sobre gravar sem depender de ninguém",
    );
  });

  it("é idempotente em texto já limpo", () => {
    const clean = "Como eu estudo medicina com a cabeça no surf";
    expect(cleanIdeaText(clean)).toBe(clean);
  });

  it("não junta palavras normais que terminam ou começam com acento", () => {
    expect(cleanIdeaText("será que é só fofura")).toBe("será que é só fofura");
    expect(cleanIdeaText("a verdade é que ela é meu maior filtro")).toBe(
      "a verdade é que ela é meu maior filtro",
    );
  });

  it("conserta o roteiro real visto em produção (espaço quebrando várias palavras)", () => {
    expect(
      cleanIdeaText(
        "Come ça mostrando voc ê no seu espa ço, como se estivesse pensando em voz alta",
      ),
    ).toBe("Começa mostrando você no seu espaço, como se estivesse pensando em voz alta");
    expect(cleanIdeaText("Compartilha um momento em que voc ê sentiu a press ão de criar algo que n ão era seu")).toBe(
      "Compartilha um momento em que você sentiu a pressão de criar algo que não era seu",
    );
    expect(
      cleanIdeaText("Termina com a sensa ção de al vio e satisfa ção ao perceber que a melhor ideia veio da sua pr ó pria vida"),
    ).toBe("Termina com a sensação de alívio e satisfação ao perceber que a melhor ideia veio da sua própria vida");
    expect(cleanIdeaText("pode virar o seu pr óximo v deo")).toBe("pode virar o seu próximo vídeo");
    expect(cleanIdeaText("sem depender de ningu ém")).toBe("sem depender de ninguém");
    expect(cleanIdeaText("o conte ú do nasce da vida")).toBe("o conteúdo nasce da vida");
  });
});

describe("repairSeparatedAccents", () => {
  it("recola acento no meio da palavra", () => {
    expect(repairSeparatedAccents("cria ç ão")).toBe("criação");
    expect(repairSeparatedAccents("intelig ê ncia")).toBe("inteligência");
  });

  it("não cola a próxima palavra depois de dá", () => {
    expect(repairSeparatedAccents("d á mais liberdade")).toBe("dá mais liberdade");
  });

  it("mantém frases normais com palavras acentuadas separadas", () => {
    expect(repairSeparatedAccents("será que é só fofura")).toBe("será que é só fofura");
    expect(repairSeparatedAccents("verdade é que ela é meu filtro")).toBe("verdade é que ela é meu filtro");
  });
});

describe("repairKnownPortugueseArtifacts", () => {
  it("repara apenas o artefato conhecido ninguR/ningu R", () => {
    expect(repairKnownPortugueseArtifacts("ninguR")).toBe("ninguém");
    expect(repairKnownPortugueseArtifacts("Ningu R")).toBe("Ninguém");
    expect(repairKnownPortugueseArtifacts("R$ 50")).toBe("R$ 50");
  });
});

describe("stripIronicQuotes (regressão)", () => {
  it("remove aspas em volta de uma palavra", () => {
    expect(stripIronicQuotes("o 'caos' do dia")).toBe("o caos do dia");
  });
});
