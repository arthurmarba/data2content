import { fallbackIconPaths, parseIconLinks, sourceIconOrigin } from "./sourceIcon";

describe("sourceIconOrigin", () => {
  it("usa a porta do criador da fonte registrada", () => {
    expect(sourceIconOrigin("achapubli-public-feed")).toMatch(/^https:\/\//);
  });

  it("devolve nulo para fonte que não existe", () => {
    expect(sourceIconOrigin("fonte-inventada")).toBeNull();
  });
});

describe("parseIconLinks", () => {
  it("resolve endereço relativo contra a página e mantém o de outro domínio", () => {
    const html = `
      <link rel="icon" href="/img/favicon.png">
      <link rel="apple-touch-icon" href="https://cdn.exemplo.com/icone.png">
    `;
    expect(parseIconLinks(html, "https://marca.com.br/")).toEqual([
      "https://cdn.exemplo.com/icone.png",
      "https://marca.com.br/img/favicon.png",
    ]);
  });

  it("prefere o ícone de maior lado declarado", () => {
    const html = `
      <link rel="icon" sizes="16x16" href="/p.png">
      <link rel="icon" sizes="192x192" href="/g.png">
      <link rel="icon" sizes="32x32" href="/m.png">
    `;
    expect(parseIconLinks(html, "https://marca.com.br/")).toEqual([
      "https://marca.com.br/g.png",
      "https://marca.com.br/m.png",
      "https://marca.com.br/p.png",
    ]);
  });

  it("não repete o mesmo endereço declarado duas vezes", () => {
    const html = `
      <link rel="icon" href="/favicon.png">
      <link rel="shortcut icon" href="/favicon.png">
    `;
    expect(parseIconLinks(html, "https://marca.com.br/")).toEqual([
      "https://marca.com.br/favicon.png",
    ]);
  });

  it("descarta ícone genérico de plataforma de terceiros", () => {
    // Chamada hospedada em formulário do Google declara o logo do Firebase:
    // serviria a mesma imagem para fontes diferentes.
    const html = `<link rel="icon" href="https://www.gstatic.com/mobilesdk/firebase_64dp.png">`;
    expect(parseIconLinks(html, "https://forms.gle/abc")).toEqual([]);
  });

  it("ignora link que não é de ícone e href sem endereço", () => {
    const html = `
      <link rel="stylesheet" href="/estilo.css">
      <link rel="icon">
      <link rel="icon" href="">
    `;
    expect(parseIconLinks(html, "https://marca.com.br/")).toEqual([]);
  });
});

describe("fallbackIconPaths", () => {
  it("tenta o ícone grande antes do favicon pequeno", () => {
    expect(fallbackIconPaths("https://marca.com.br")).toEqual([
      "https://marca.com.br/apple-touch-icon.png",
      "https://marca.com.br/favicon.png",
      "https://marca.com.br/favicon.ico",
    ]);
  });
});
