# Auditoria de fontes do Radar de Oportunidades

Data da passagem: 1º de setembro de 2026.

Este documento é uma auditoria operacional das páginas e termos públicos encontrados. Não substitui
parecer jurídico. O princípio adotado para o plugin/MCP é simples: conteúdo visível na internet não
equivale a autorização para coleta e redistribuição automatizadas.

## Decisão por fonte pública

| Fonte | Situação no plugin | Evidência consultada | Próxima ação |
| --- | --- | --- | --- |
| Influencer Brasil | Bloqueada | Os Termos de Uso limitam a licença a consulta pessoal e não comercial, exigem autorização escrita para redistribuição/uso comercial e proíbem coleta automatizada sem autorização. | Obter autorização escrita antes de qualquer exposição pelo MCP. |
| Creator Ads | Bloqueada na origem atual | A vitrine usada pelo coletor está no Linktree. Os termos do Linktree proíbem scripts, bots e scraping para acessar, extrair, agregar ou coletar conteúdo de perfis. | Pedir à Creator Ads uma API, feed ou página própria autorizada. Não coletar o perfil do Linktree. |
| Animextreme | Bloqueada na origem atual | A chamada específica usada pelo coletor está no Linktree e recebe a mesma proibição. O evento possui site e contato oficiais, mas isso não autoriza redistribuição. | Solicitar autorização a `contato@afarprodutora.com.br` e pedir uma origem própria estável. |
| Squid | Pendente | A Squid publica chamadas e aponta para o termo oficial da plataforma, mas a consulta pública não demonstrou licença de redistribuição automatizada. | Solicitar autorização escrita ou integração oficial. |
| PlayNest / Play9 | Pendente | A PlayNest publica programas e possui termo oficial, porém não foi encontrada autorização expressa para redistribuição pelo MCP. | Solicitar autorização escrita ou API oficial. |
| 99Freelas | Pendente | Os termos públicos consultados descrevem o uso do marketplace, mas não concedem autorização para coletar e republicar projetos automaticamente. | Solicitar autorização escrita ou API oficial. |
| Up!ABC | Pendente | O briefing, os critérios e a candidatura são públicos; não foi encontrada licença de redistribuição automatizada. | Solicitar autorização escrita pelo canal oficial. |
| Tijuca Geek Festival | Pendente | O site publica briefing, benefícios e candidatura; não foi encontrada licença de redistribuição automatizada. | Solicitar autorização escrita à coordenação. |

Fontes autenticadas, convites privados e inventários selecionados por perfil permanecem bloqueados,
independentemente do estado das fontes acima.

## Regra de liberação

Uma fonte só pode mudar para `approved` em `sourceRegistry.ts` quando houver:

1. base de autorização identificada: termo expresso, permissão escrita ou API oficial;
2. evidência arquivada em local estável;
3. data e responsável pela revisão;
4. respeito ao `robots.txt`, sem tratá-lo como licença de redistribuição;
5. escopo mínimo de dados: título factual, marca, prazo, remuneração confirmada, requisitos e link;
6. atribuição clara e link para a origem;
7. canal de correção ou remoção.

O comando abaixo valida a consistência do registro sem acessar a rede ou gravar no banco:

```bash
npm run campaign-radar:audit-plugin-sources
```

Antes de ativar o recurso, use o modo de bloqueio de release:

```bash
npm run campaign-radar:audit-plugin-sources -- --require-release-ready
```

Ele termina com erro enquanto não houver ao menos uma fonte aprovada ou ainda existir alguma fonte
pendente. Fontes bloqueadas podem permanecer no registro e ficam fora do catálogo; não precisam ser
artificialmente aprovadas para o lançamento. Essa falha é esperada no estado atual.

Esta classificação controla a distribuição pelo plugin/MCP. Ela não é uma autorização separada
para o PDF público: uma proibição expressa de coleta ou republicação também deve ser respeitada no
fluxo do relatório, ou validada por assessoria jurídica.

## Modelo de pedido de autorização

**Assunto:** Autorização para exibir chamadas públicas na Data2Content

Olá, equipe [NOME].

A Data2Content ajuda criadores a encontrar oportunidades compatíveis com seu perfil. Gostaríamos de
pedir autorização expressa para consultar de forma automatizada as chamadas públicas de creators
publicadas por vocês e mostrar um resumo dentro da Data2Content e de suas integrações com assistentes
como ChatGPT e Claude.

Pretendemos exibir somente informações factuais e necessárias — nome da oportunidade, marca quando
pública, prazo, remuneração confirmada, requisitos e link para a página original — sempre com
atribuição à [NOME]. Não copiaremos imagens, textos integrais, áreas autenticadas nem dados pessoais,
e a candidatura continuará acontecendo no canal oficial de vocês.

Vocês autorizam essa consulta automatizada e a exibição desses resumos? Caso prefiram, podemos usar
uma API, feed ou página específica fornecida por vocês. Também manteremos um canal para correção ou
remoção imediata.

Obrigado,

Equipe Data2Content

## Como arquivar uma autorização

- Salvar o e-mail ou contrato integral em repositório interno com acesso controlado.
- Registrar no código apenas uma referência não sensível, nunca o conteúdo privado do e-mail.
- Confirmar que a autorização cobre coleta automatizada e redistribuição dentro da plataforma,
  ChatGPT e Claude.
- Registrar limites: frequência, campos permitidos, atribuição, validade e revogação.
- Revalidar a autorização se os termos da fonte ou a integração mudarem.
