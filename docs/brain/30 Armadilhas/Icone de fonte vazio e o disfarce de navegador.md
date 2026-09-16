---
título: Ícone de fonte vazio e o disfarce de navegador
data: 2026-09-16
---

# Ícone de fonte vazio e o disfarce de navegador

Metade das fontes do radar (22 de 47) aparecia sem imagem na lista de publis, e a
letra de reserva nunca entrava no lugar. Três causas somadas, nesta ordem de
importância:

## 1. A rota mentia dizendo que tinha achado

Quando não encontrava o ícone, `/api/radar/source-icon/[sourceId]` devolvia um
**pixel transparente com status 200**. Para o navegador a imagem carregou, então
o `onError` do `<img>` nunca disparava e a letra inicial da plataforma — que já
existia no código — jamais aparecia. O resultado era um selo vazio.

**Ícone ausente tem que responder 404.** É o único jeito de o app trocar a
imagem pela letra. Cachear o 404 evita refazer a busca a cada abertura.

## 2. `/favicon.ico` não é mais onde o ícone mora

A busca tentava só três caminhos fixos no domínio da fonte. A maioria dos sites
hoje declara o ícone no HTML (`<link rel="icon">`) e serve de um CDN de terceiros
(jsdelivr, cloudfront, website-files, framerusercontent). Ler o HTML da home e
seguir os endereços declarados — o de maior `sizes` primeiro, que é o que fica
nítido no selo de 44px — levou a cobertura de 25 para 40 de 47.

Cuidado com dois venenos nessa leitura:

- **Site que devolve a própria página no lugar do ícone.** Confira o
  `content-type` começando com `image/`, senão o selo recebe HTML.
- **Ícone genérico de plataforma de terceiros.** Chamada hospedada no Google
  Forms declara o logo do Firebase (`gstatic.com`): serviria a MESMA imagem para
  fontes diferentes. Preferir a letra a um ícone que engana.

## 3. O disfarce de navegador tem dois lados

Parte das plataformas responde **403 para quem não parece navegador** (Skeepers,
Brandlovrs). Mas o **WhatsApp faz o contrário**: devolve 400 para o `user-agent`
de Chrome e 200 para o pedido simples. Fixar o disfarce consertou um grupo e
quebrou uma fonte que funcionava.

**Duas tentativas, sem disfarce primeiro e com disfarce só se a primeira
falhar.** Assim os dois grupos são atendidos.

## O que não tem conserto por aqui

Sobram 7 fontes com a letra, e cada uma por um motivo honesto: dois formulários
do Google (sem marca própria), 403 mesmo com disfarce, home fora do ar (404/406)
e site que não declara ícone nenhum. A letra é a resposta certa nesses casos.

Ver também [[Radar: fontes vivas e mortas]] e a decisão de redesenho em
`40 Decisões/Redesenho da jornada e mockup do app.md`.
