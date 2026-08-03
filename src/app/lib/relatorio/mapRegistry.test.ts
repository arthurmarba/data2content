import {
  canonicalAssetRoleById,
  currentAssetRoleId,
  normalizeMapLabel,
  resolveAssetLabel,
  resolveSubjectLabel,
  resolveTerritoryLabel,
  resolveToneLabel,
  splitToneField,
} from "./mapRegistry";

describe("normalizeMapLabel", () => {
  it("tira acento, parêntese e pontuação", () => {
    expect(normalizeMapLabel("A esposa (Lívia Linhares)")).toBe("a esposa");
    expect(normalizeMapLabel("Cabelo crespo/cacheado")).toBe("cabelo crespo cacheado");
  });
});

describe("resolveTerritoryLabel — território é domínio de vida", () => {
  it("consolida sinônimos no mesmo território", () => {
    for (const label of ["Culinária", "Gastronomia", "Culinária caseira", "Comida afetiva"]) {
      expect(resolveTerritoryLabel(label)).toMatchObject({ territoryId: "cozinha" });
    }
  });

  it("o mais específico ganha do mais genérico", () => {
    // "autocuidado materno" é maternidade, não autocuidado.
    expect(resolveTerritoryLabel("Autocuidado materno")).toMatchObject({
      territoryId: "maternidade",
    });
  });

  it("humor SOZINHO é tom no campo errado", () => {
    for (const label of ["Humor", "Comédia", "Humor e opiniões"]) {
      expect(resolveTerritoryLabel(label)).toMatchObject({ kind: "misplaced", belongsTo: "tom" });
    }
  });

  it("humor COM domínio de vida é território — o domínio ganha da palavra 'humor'", () => {
    // O criador está dizendo que atua em relações, ou na vida familiar, COM humor.
    // Descartar o rótulo por causa de "humor" jogaria o território fora junto.
    expect(resolveTerritoryLabel("Humor de casal")).toMatchObject({ territoryId: "relacoes" });
    expect(resolveTerritoryLabel("Humor familiar")).toMatchObject({ territoryId: "vida-familiar" });
    expect(resolveTerritoryLabel("Humor em família")).toMatchObject({ territoryId: "vida-familiar" });
  });

  it("desenvolvimento pessoal e vida familiar são territórios", () => {
    expect(resolveTerritoryLabel("Autoconhecimento")).toMatchObject({
      territoryId: "desenvolvimento",
    });
    expect(resolveTerritoryLabel("Superação pessoal")).toMatchObject({
      territoryId: "desenvolvimento",
    });
    expect(resolveTerritoryLabel("Vida familiar")).toMatchObject({ territoryId: "vida-familiar" });
    expect(resolveTerritoryLabel("Família")).toMatchObject({ territoryId: "vida-familiar" });
  });

  it("rótulo genérico demais não vira território", () => {
    for (const label of ["Estilo de vida", "Lifestyle", "Cotidiano", "Rotina"]) {
      expect(resolveTerritoryLabel(label)).toMatchObject({ kind: "misplaced", belongsTo: "tema" });
    }
  });

  it("valor de narrativa não vira território", () => {
    expect(resolveTerritoryLabel("Autenticidade na criação")).toMatchObject({
      kind: "misplaced",
      belongsTo: "valor",
    });
  });

  it("separa os três recortes de cuidado — a ordem é o mecanismo", () => {
    // Antes "Bem-estar" engolia os três e ficava com 29 dos 56 criadores.
    expect(resolveTerritoryLabel("Saúde mental")).toMatchObject({ territoryId: "saude-mental" });
    expect(resolveTerritoryLabel("Ansiedade")).toMatchObject({ territoryId: "saude-mental" });
    expect(resolveTerritoryLabel("Autocuidado")).toMatchObject({ territoryId: "autocuidado" });
    expect(resolveTerritoryLabel("Autocuidado feminino")).toMatchObject({
      territoryId: "autocuidado",
    });
    expect(resolveTerritoryLabel("Cuidados pessoais")).toMatchObject({
      territoryId: "autocuidado",
    });
    expect(resolveTerritoryLabel("Bem-estar")).toMatchObject({ territoryId: "bem-estar" });
    expect(resolveTerritoryLabel("Bem-estar físico")).toMatchObject({ territoryId: "bem-estar" });
  });

  it("rótulo composto vai para o recorte mais específico, não para o residual", () => {
    // "autocuidado e bem-estar" tem as duas palavras; autocuidado ganha porque vem antes.
    expect(resolveTerritoryLabel("Autocuidado e bem-estar")).toMatchObject({
      territoryId: "autocuidado",
    });
    // E maternidade ganha de autocuidado, porque é ainda mais específico.
    expect(resolveTerritoryLabel("Autocuidado materno")).toMatchObject({
      territoryId: "maternidade",
    });
  });

  it("keyword curta casa por PALAVRA, não por substring", () => {
    // O bug medido na auditoria: "fe" acendia Fé em 14 rótulos, quase todos falsos.
    expect(resolveTerritoryLabel("Fé")).toMatchObject({ territoryId: "fe" });
    expect(resolveTerritoryLabel("Fé e espiritualidade")).toMatchObject({ territoryId: "fe" });
    expect(resolveTerritoryLabel("Bem-estar feminino")).toMatchObject({ territoryId: "bem-estar" });
    expect(resolveTerritoryLabel("Confeitaria")).not.toMatchObject({ territoryId: "fe" });
  });

  it("keyword de 4+ letras ainda casa por prefixo", () => {
    expect(resolveTerritoryLabel("Relacionamentos")).toMatchObject({ territoryId: "relacoes" });
    expect(resolveTerritoryLabel("Viagens")).toMatchObject({ territoryId: "viagem" });
  });

  it("rótulo fora do registro devolve unmatched em vez de chutar", () => {
    expect(resolveTerritoryLabel("Mineiro x paulista x carioca")).toEqual({ kind: "unmatched" });
    expect(resolveTerritoryLabel("")).toEqual({ kind: "unmatched" });
  });
});

describe("resolveAssetLabel — Regra 3: papel, nunca indivíduo", () => {
  it("nome próprio do mapa vira papel no relatório", () => {
    // Rótulos reais da base.
    expect(resolveAssetLabel("A esposa (Lívia Linhares)")).toMatchObject({
      roleId: "parceiro_em_cena",
      label: "Parceiro em cena",
    });
    expect(resolveAssetLabel("A filha (Liv)")).toMatchObject({ roleId: "filho_em_cena" });
    expect(resolveAssetLabel("Animais (cavalo)")).toMatchObject({ roleId: "animal_em_cena" });
  });

  it("nunca devolve o rótulo original como label", () => {
    const resolution = resolveAssetLabel("Animais (cavalo)");
    expect(resolution.kind).toBe("canonical");
    if (resolution.kind === "canonical") {
      expect(resolution.label).toBe("Animal em cena");
      expect(resolution.label.toLowerCase()).not.toContain("cavalo");
    }
  });

  it("gente ganha de lugar quando o rótulo tem os dois", () => {
    expect(resolveAssetLabel("A criadora e o marido")).toMatchObject({
      roleId: "parceiro_em_cena",
    });
    expect(resolveAssetLabel("A criadora e seus quatro filhos (dois pares de gêmeos)")).toMatchObject(
      { roleId: "filho_em_cena" },
    );
  });

  it("a criadora sozinha só cai em 'sozinho' quando não há outra pessoa", () => {
    expect(resolveAssetLabel("A própria criadora")).toMatchObject({ roleId: "sozinho_na_cena" });
    expect(resolveAssetLabel("A própria criadora em close-up")).toMatchObject({
      roleId: "sozinho_na_cena",
    });
  });

  it("consolida as variações de cenário doméstico", () => {
    for (const label of ["Casa", "Ambientes domésticos", "Sala", "Sofá", "Apartamento"]) {
      expect(resolveAssetLabel(label)).toMatchObject({ roleId: "casa", group: "cenario" });
    }
  });

  it("um casal não é uma parede — 'casal' não pode cair no cenário Casa", () => {
    // Rótulos reais da base. `casa` casa por prefixo com `casal`, e sem a palavra em
    // parceiro_em_cena os três viravam cenário doméstico.
    for (const label of ["O casal (Thaís e Alex)", "Casais em momentos de lazer", "looks de casal"]) {
      expect(resolveAssetLabel(label)).toMatchObject({ roleId: "parceiro_em_cena", group: "vida" });
    }
  });

  it("móvel é coisa que se mostra, não lugar onde se está", () => {
    for (const label of ["Móveis", "Colchões", "móveis DIY", "itens de organização doméstica"]) {
      expect(resolveAssetLabel(label)).toMatchObject({ roleId: "movel_em_cena", group: "objeto" });
    }
  });

  it("brinquedo sai do balde genérico", () => {
    for (const label of ["Bonecas e brinquedos infantis", "Brinquedos infantis", "brinquedoteca"]) {
      expect(resolveAssetLabel(label)).toMatchObject({ roleId: "brinquedo_em_cena" });
    }
    // O balde continua existindo para o que o mapa não soube nomear.
    expect(resolveAssetLabel("objetos do cotidiano")).toMatchObject({
      roleId: "objeto_do_cotidiano",
    });
  });

  it("classifica o grupo de leitura do card", () => {
    expect(resolveAssetLabel("Marido")).toMatchObject({ group: "vida" });
    expect(resolveAssetLabel("Cozinha")).toMatchObject({ group: "cenario" });
    expect(resolveAssetLabel("Microfones")).toMatchObject({ group: "objeto" });
  });
});

describe("resolveToneLabel", () => {
  it("consolida as variações de humor", () => {
    for (const label of ["Humor leve", "Bem-humorado", "Humor irônico", "Casual e divertido"]) {
      expect(resolveToneLabel(label)).toMatchObject({ toneId: "humor" });
    }
  });

  it("consolida o resto dos chips mais comuns", () => {
    expect(resolveToneLabel("Casual e direto")).toMatchObject({ toneId: "direto" });
    expect(resolveToneLabel("Informal e acolhedor")).toMatchObject({ toneId: "acolhedor" });
    expect(resolveToneLabel("Pessoal e reflexivo")).toMatchObject({ toneId: "reflexivo" });
    expect(resolveToneLabel("Com um toque de vulnerabilidade")).toMatchObject({
      toneId: "vulneravel",
    });
  });
});

describe("splitToneField", () => {
  it("quebra o campo escalar como a UI do card faz", () => {
    expect(splitToneField("humor leve, casual e direto; reflexivo")).toEqual([
      "humor leve",
      "casual e direto",
      "reflexivo",
    ]);
  });

  it("campo vazio devolve lista vazia", () => {
    expect(splitToneField(null)).toEqual([]);
    expect(splitToneField("")).toEqual([]);
  });
});

describe("resolveSubjectLabel — assunto é o que se fala, não a intenção", () => {
  it("agrupa as frases reais do card em assuntos compartilhados", () => {
    // Rótulos reais de mapa.temas.
    // "Sair do trabalho a tempo de viver a vida familiar" é sobre a FAMÍLIA — o
    // trabalho aparece como o obstáculo, não como o assunto.
    expect(
      resolveSubjectLabel("Sair do trabalho a tempo de viver a vida familiar"),
    ).toMatchObject({ subjectId: "vida_em_familia" });
    expect(
      resolveSubjectLabel("Estratégias para atrair anunciantes"),
    ).toMatchObject({ subjectId: "trabalho_e_renda" });
    expect(
      resolveSubjectLabel("Celebrar a beleza do cabelo crespo em cada fase da transição"),
    ).toMatchObject({ subjectId: "beleza_e_cabelo" });
    expect(
      resolveSubjectLabel("Experimentar na cozinha e criar receitas caseiras"),
    ).toMatchObject({ subjectId: "cozinhar" });
    expect(
      resolveSubjectLabel("Compartilhar a rotina do casal com leveza e humor"),
    ).toMatchObject({ subjectId: "vida_a_dois" });
    expect(
      resolveSubjectLabel("Encontrar o propósito em meio aos desafios da paternidade"),
    ).toMatchObject({ subjectId: "criacao_dos_filhos" });
  });

  it("frases diferentes de criadores diferentes caem no MESMO assunto", () => {
    const a = resolveSubjectLabel("Compartilhar o processo de reforma e decoração de ambientes");
    const b = resolveSubjectLabel("Transformar a casa com projetos criativos e acessíveis");
    expect(a.kind).toBe("canonical");
    expect(b.kind).toBe("canonical");
    if (a.kind === "canonical" && b.kind === "canonical") {
      expect(a.subjectId).toBe(b.subjectId);
      expect(a.label).toBe("Rotina da casa");
    }
  });

  it("frase fora do registro devolve unmatched — não vira assunto inventado", () => {
    expect(resolveSubjectLabel("Desmistificar o uso de X para Y")).toBeDefined();
    expect(resolveSubjectLabel("")).toEqual({ kind: "unmatched" });
  });
});

describe("renomeações pedidas", () => {
  it("Gastronomia, não Cozinha", () => {
    expect(resolveTerritoryLabel("Culinária")).toMatchObject({ label: "Gastronomia" });
  });

  it("mãe e pai no mesmo território", () => {
    const mae = resolveTerritoryLabel("Maternidade");
    const pai = resolveTerritoryLabel("Paternidade");
    expect(mae).toMatchObject({ territoryId: "maternidade", label: "Maternidade/Paternidade" });
    expect(pai).toMatchObject({ territoryId: "maternidade", label: "Maternidade/Paternidade" });
  });

  it("'Look montado' não é 'estar vestido' — são os rótulos de moda do mapa", () => {
    for (const label of ["Roupas da Farm", "looks do dia", "bolsas e acessórios"]) {
      expect(resolveAssetLabel(label)).toMatchObject({
        roleId: "look_montado",
        label: "Look montado",
      });
    }
  });
});

describe("chaves renomeadas", () => {
  it("chave antiga gravada no banco continua resolvendo — Regra 3 não vaza", () => {
    // ~800 registros foram gravados com `roupa_em_cena` antes da renomeação.
    expect(canonicalAssetRoleById("roupa_em_cena")).toMatchObject({ label: "Look montado" });
    expect(currentAssetRoleId("roupa_em_cena")).toBe("look_montado");
  });

  it("chave atual passa direto", () => {
    expect(currentAssetRoleId("filho_em_cena")).toBe("filho_em_cena");
  });
});
