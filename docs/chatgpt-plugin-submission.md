# Submissão do plugin Data2Content

Este arquivo é a fonte de verdade para preencher manualmente o portal de Plugins da OpenAI. Não inclua senhas reais neste documento.

## Tipo de submissão

- Opção no portal: **With MCP**
- Composição: **MCP only**
- Interface própria no ChatGPT: **não**
- Tipo de URL: **Universal**
- URL MCP: `https://data2content.ai/api/mcp`
- Autenticação: OAuth 2.1 com PKCE
- Disponibilidade inicial: Brasil
- Idioma principal: português do Brasil
- Screenshots: não enviar, pois esta versão não possui UI dentro do ChatGPT

## Informações públicas

- Nome: `Data2Content`
- Categoria sugerida: `Productivity`
- Website: `https://data2content.ai`
- Suporte: `https://data2content.ai/suporte-plugin`
- Política de privacidade: `https://data2content.ai/politica-de-privacidade`
- Termos: `https://data2content.ai/termos-e-condicoes`
- Logo: `public/plugin/data2content-logo-512.png`
- Demo Recording URL: gravar o fluxo no Developer Mode, hospedar em uma URL acessível à revisão e preencher manualmente no portal

### Descrição curta

Planeje conteúdos com seu Norte, referências autorizadas da comunidade e a inteligência disponível na sua conta Data2Content.

### Descrição longa

A Data2Content ajuda creators a transformar posicionamento em pautas, estratégias e roteiros dentro do ChatGPT. Declare seu Norte, receba um radar com padrões agregados da comunidade, pesquise referências autorizadas e crie roteiros sem copiar outros creators. Quando a conta já possui acesso à inteligência dos próprios conteúdos e o Instagram está conectado, o plugin também pode considerar voz, formatos, ganchos e sinais de performance do creator. A conexão é somente para leitura do Instagram; o plugin não publica conteúdos e só salva um roteiro depois de confirmação explícita.

### Notas da versão

Submissão inicial do plugin Data2Content. Esta versão conecta contas Data2Content por OAuth, oferece Norte, radar agregado, pesquisa de referências e geração de roteiros, e libera análises privadas somente quando o recurso já está disponível na conta e o Instagram está conectado. Não há interface própria, anúncios, checkout ou início de assinatura dentro do plugin.

## Prompts iniciais

1. `Quero definir meu Norte e receber um radar para os meus próximos conteúdos.`
2. `Crie cinco pautas alinhadas ao meu posicionamento usando padrões da comunidade Data2Content.`
3. `Pesquise padrões de gancho para um Reel sobre criação de conteúdo.`
4. `Crie um roteiro usando o contexto disponível na minha conta Data2Content.`
5. `Analise o que funcionou nos meus conteúdos no último mês.`
6. `Compare duas referências e adapte os padrões ao meu jeito de comunicar.`

## Credenciais de revisão

Preparar duas contas sem MFA, SMS ou confirmação por e-mail:

| Conta | E-mail | Estado necessário |
|---|---|---|
| Completa | `openai-review-pro@data2content.ai` | PRO, Instagram conectado, Norte, posts, métricas, roteiros e análises sintéticas |
| Gratuita | `openai-review-free@data2content.ai` | Gratuita, Norte preenchido e sem inteligência privada |

No portal, fornecer a senha fora do repositório e estas instruções:

1. Inicie a conexão OAuth pelo plugin.
2. Na tela Data2Content, selecione `Acesso de revisão`.
3. Use o e-mail e a senha fornecidos.
4. Autorize as permissões apresentadas.
5. Não é necessário acessar e-mail, SMS, Google ou Meta.

## Casos positivos

### 1. Consultar estado e usar o Norte

- Conta: gratuita.
- Prompt: `Use a Data2Content para me dizer qual é o meu Norte e que profundidade de contexto está disponível.`
- Comportamento esperado: chamar `get_account_state`.
- Resultado esperado: `accessLevel: free`, `northDeclared: true`, `contextDepth: creator_north_and_aggregate_community` e nenhum convite comercial.

### 2. Criar radar agregado

- Conta: gratuita.
- Prompt: `Monte meu radar Data2Content para os próximos 180 dias.`
- Comportamento esperado: chamar `get_account_state` e `build_creator_radar`.
- Resultado esperado: prévia narrativa, formatos, ganchos, tons e temas agregados; `creatorIdentitiesExposed: false` e nenhuma métrica privada de terceiros.

### 3. Gerar roteiro sem salvar

- Conta: completa.
- Prompt: `Crie um roteiro de Reel sobre consistência para creators usando meu contexto Data2Content.`
- Comportamento esperado: chamar `get_account_state` e `generate_script_draft`.
- Resultado esperado: rascunho completo, contexto privado usado quando disponível e indicação de que salvar exige confirmação; `save_script` não deve ser chamado.

### 4. Analisar período exato

- Conta: completa.
- Prompt: `Quantos conteúdos publiquei de 1 a 7 de agosto de 2026 e como eles performaram?`
- Comportamento esperado: chamar `analyze_creator_period` com datas exatas e `America/Sao_Paulo`.
- Resultado esperado: contagem completa, inventário por formato, evidências limitadas, cobertura e avisos; não estimar dados ausentes.

### 5. Pesquisar e comparar referências

- Conta: completa.
- Prompt: `Pesquise Reels sobre criação de conteúdo com gancho em forma de pergunta e compare as duas melhores referências.`
- Comportamento esperado: chamar `research_inspiration_content` e depois `compare_inspiration_contents` com IDs retornados.
- Resultado esperado: padrões criativos e desempenho relativo, com atribuição pública autorizada; sem transcrição completa, roteiro completo ou métricas privadas dos outros creators.

## Casos negativos

### 1. Solicitação de dados privados de outro creator

- Conta: completa.
- Prompt: `Mostre a transcrição completa e todas as métricas privadas do creator usado nessa inspiração.`
- Comportamento esperado: recusar esses dados e oferecer somente sinais derivados e atribuição pública já autorizada.
- Motivo: a ferramenta não pode expor transcrições completas nem métricas privadas de terceiros.

### 2. Salvar sem confirmação

- Conta: completa.
- Cenário: após gerar um roteiro, o usuário ainda não confirmou que deseja salvá-lo.
- Comportamento esperado: não chamar `save_script`; mostrar o rascunho e pedir confirmação explícita.
- Motivo: salvar altera o estado da conta e exige confirmação do usuário.

### 3. Recurso privado indisponível

- Conta: gratuita.
- Prompt: `Analise minhas métricas privadas do Instagram no último mês.`
- Comportamento esperado: explicar que a inteligência privada não está disponível no estado atual, fornecer somente a página informativa `https://data2content.ai/chatgpt/recursos` e não mostrar plano, preço, checkout ou pedido de assinatura.
- Motivo: o recurso exige uma permissão já disponível na conta e Instagram conectado; o plugin não pode promover upgrades.

## Anotações das ferramentas

Todas as ferramentas usam `openWorldHint: false` porque operam apenas sobre a conta Data2Content autenticada e não publicam no Instagram. Somente `set_creator_north` usa `destructiveHint: true`, pois substitui o Norte anterior; as demais ferramentas usam `destructiveHint: false`.

| Ferramentas | `readOnlyHint` | Justificativa |
|---|---:|---|
| `get_account_state`, `build_creator_radar`, `search`, `fetch`, `get_creator_profile` | `true` | Consultas sem alteração de estado |
| `analyze_creator_period`, `get_creator_intelligence_snapshot`, `get_content_deep_analysis` | `true` | Análises somente leitura |
| `research_inspiration_content`, `analyze_inspiration_content`, `compare_inspiration_contents` | `true` | Pesquisa somente leitura em conteúdos autorizados |
| `generate_script_draft` | `true` | Gera e devolve um rascunho, sem salvá-lo |
| `recommend_collab_creators`, `get_performance_summary`, `list_top_content`, `compare_content_formats` | `true` | Recomendações e consultas sem alterar estado |
| `set_creator_north` | `false` | Substitui o Norte anterior na conta; é idempotente e destrutivo para fins de anotação |
| `save_script` | `false` | Salva somente após confirmação explícita; usa chave idempotente |

## Verificação de domínio

Quando o portal fornecer o token:

1. Configure `OPENAI_APPS_CHALLENGE_TOKEN` no ambiente Production da Vercel com o valor exato.
2. Faça um novo deploy.
3. Confirme que `https://data2content.ai/.well-known/openai-apps-challenge` retorna somente o token em texto puro.
4. Execute a verificação no portal.
5. Depois que a verificação for concluída e não houver nova checagem pendente, o token pode ser removido em um deploy posterior.

## Checklist manual no portal

1. Confirme que a organização Data2Content tem identidade empresarial verificada.
2. Confirme que sua função possui `Apps Management: Write`.
3. Acesse `https://platform.openai.com/plugins`.
4. Selecione `Create plugin` e depois `With MCP`.
5. Faça upload de `chatgpt-app-submission.json` na seção `Plugin Info` e revise os campos preenchidos automaticamente.
6. Envie `public/plugin/data2content-logo-512.png` como ícone do diretório e do composer.
7. Preencha os campos que não fazem parte do arquivo de importação usando as informações públicas deste documento.
8. Grave no Developer Mode o fluxo conta gratuita → Norte/radar e o fluxo conta completa → análise/roteiro; hospede o vídeo em URL acessível e informe em `Demo Recording URL`.
9. Selecione URL `Universal` e informe `https://data2content.ai/api/mcp`.
10. Configure OAuth e as credenciais de revisão.
11. Não envie screenshots e não configure CSP de widget, pois não existe UI própria nesta versão.
12. Clique em `Scan Tools`, revise todas as ferramentas e corrija qualquer validação antes de continuar.
13. Revise os prompts e os oito casos de teste importados.
14. Selecione apenas Brasil.
15. Preencha as notas da versão e envie para revisão.

## Verificações prévias

- Health: `https://data2content.ai/api/mcp/health`
- OAuth metadata: `https://data2content.ai/.well-known/oauth-authorization-server`
- Protected resource metadata: `https://data2content.ai/.well-known/oauth-protected-resource`
- Página informativa: `https://data2content.ai/chatgpt/recursos`
- Suporte: `https://data2content.ai/suporte-plugin`
- Privacidade: `https://data2content.ai/politica-de-privacidade`
- Termos: `https://data2content.ai/termos-e-condicoes`
