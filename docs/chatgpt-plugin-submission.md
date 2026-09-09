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
- Subtítulo importável: `Planeje conteúdos e roteiros` (o schema limita este campo a 30 caracteres)
- Categoria sugerida: `Productivity`
- Website: `https://data2content.ai`
- Suporte: `https://data2content.ai/suporte-plugin`
- Política de privacidade: `https://data2content.ai/politica-de-privacidade`
- Termos: `https://data2content.ai/termos-e-condicoes`
- Logo: `public/plugin/data2content-logo-512.png`
- Demo Recording URL: `https://data2content.ai/plugin/data2content-chatgpt-demo-v2.mp4` — gravação de tela da conversa real no ChatGPT com a conexão privada Data2Content Revisão (1min52, sem áudio). O arquivo anterior segue publicado em `data2content-chatgpt-demo.mp4` e não é mais o vídeo da submissão.

### Descrição curta

Planeje conteúdos com seu Norte, referências autorizadas da comunidade e a inteligência disponível na sua conta Data2Content.

### Descrição longa

A Data2Content ajuda criadores a planejar conteúdos e escrever roteiros com o contexto disponível na sua conta. Consulte seu mapa narrativo, territórios, pautas e padrões de voz; analise seus posts e a variação de seguidores com datas, métricas e limites de cobertura. Prepare referências dos seus próprios conteúdos para escrever no ChatGPT ou peça um rascunho ao motor Data2Content. Revise o roteiro contra suas evidências, salve após confirmação e registre suas preferências quando desejar. Também é possível pesquisar referências autorizadas da comunidade, comparar padrões, encontrar possíveis parceiros de collab e consultar oportunidades de publicidade previamente revisadas. O acesso depende das permissões e dos recursos da conta; contas gratuitas usam o Norte declarado e padrões agregados. A preparação pode guardar evidências e rascunhos privados por sete dias; isso não adiciona automaticamente um roteiro à biblioteca. O plugin não publica no Instagram, não envia mensagens nem candidaturas e não garante desempenho ou contratação.

### Notas da atualização

Atualização da submissão existente 1.0.0: catálogo ampliado de 18 para 26 ferramentas, incluindo mapa, pautas, DNA, evidências, crítica, preferências, seguidores e oportunidades. As anotações distinguem consultas, sessões temporárias e gravações confirmadas. Corrigidos o contrato de cobertura da análise de período e o primeiro registro de preferências em roteiros novos.

## Prompts iniciais

O portal permite três prompts com até 128 caracteres cada. Estes são os textos preenchidos:

1. `Consulte meu mapa e minhas pautas. Sugira qual desenvolver, distinguindo declaração de evidência.`
2. `Use minhas referências para escrever e revisar um roteiro aqui. Só salve depois da minha confirmação.`
3. `Analise meus conteúdos da última semana: formatos, desempenho e seguidores. Informe as lacunas dos dados.`

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

## Casos de teste importáveis

`chatgpt-app-submission.json` é a fonte dos cinco casos positivos e três negativos. Todos usam a conta completa fornecida no portal. Os testes abaixo usam somente dados fictícios; textos planejados não são transcrições observadas. A conta gratuita continua disponível para validação complementar, mas não é pré-requisito dos oito casos importados.

### Casos positivos

1. **Conta de demonstração completa: consultar posicionamento e pautas existentes; o mapa é apenas declarativo.**

   Pedido: Use a Data2Content para consultar meu mapa e sugerir qual das minhas pautas existentes devo desenvolver. Explique o que é declaração e o que tem evidência.

   Esperado: Retorna o mapa fictício, territórios e três pautas de demonstração; distingue narrativa declarada de diagnóstico e não inventa leituras de vídeo.

2. **Conta completa: preparar referências e revisar; depois de exibir o roteiro, testar salvamento e avaliação em mensagens separadas.**

   Pedido: Consulte meu DNA e prepare referências próprias de agosto de 2026 para escrever aqui um roteiro sobre clareza na criação de conteúdo. Revise contra as mesmas referências. Não use o gerador interno e não salve ainda.

   Esperado: Retorna referências fictícias como roteiros planejados, sem tratá-las como falas observadas; cria uma sessão temporária e apresenta o roteiro com limitações. Não chama save_script inicialmente. Depois envie "Sim, salve o roteiro que você acabou de mostrar"; após salvar, envie "Registre minha preferência por frases curtas neste roteiro". Salva uma vez e registra somente a preferência solicitada.

3. **Conta completa: usar explicitamente o motor de geração da Data2Content sem adicionar à biblioteca.**

   Pedido: Use o motor interno da Data2Content para gerar um roteiro de 40 segundos sobre clareza na criação de conteúdo, com minhas referências de agosto de 2026. Não salve na biblioteca.

   Esperado: Devolve rascunho completo, duração estimada e limites das evidências; informa eventual indisponibilidade do provedor ou uso de fallback. Pode guardar a sessão privada temporária; não chama save_script.

4. **Conta completa: contar posts em datas fixas e tratar ausência de leituras de seguidores sem inventar saldo.**

   Pedido: Quantos conteúdos publiquei de 1 a 7 de agosto de 2026? Mostre o desempenho e o saldo de seguidores nesse período, no fuso America/Sao_Paulo.

   Esperado: Conta três posts fictícios no período: dois Reels e um carrossel. Retorna métricas disponíveis; quando não há leituras suficientes de seguidores, informa a lacuna e não converte ausência em zero.

5. **Conta completa: pesquisar referências autorizadas, comparar quando houver duas, sugerir collabs e consultar publicidades revisadas.**

   Pedido: Pesquise referências da comunidade sobre criação de conteúdo, compare duas se houver e sugira possíveis parceiros de collab. Consulte também oportunidades de publicidade relevantes; não entre em contato nem envie candidatura.

   Esperado: Usa apenas referências autorizadas e IDs retornados; compara somente se houver duas, informa ausência quando necessário, não expõe transcrições ou métricas privadas de terceiros e não garante desempenho, cachê ou contratação. Não envia mensagens nem candidaturas.

### Casos negativos

1. **Não usar a Data2Content para publicar diretamente em redes sociais.**

   Pedido: Publique este texto agora no meu Instagram e marque todos os meus seguidores.

   Esperado: O plugin não deve ser invocado para publicar ou enviar mensagens porque suas ferramentas apenas analisam, planejam e salvam roteiros privados.

2. **Não usar a Data2Content para consultar agenda ou compromissos.**

   Pedido: Quais reuniões eu tenho amanhã e que horas começa a primeira?

   Esperado: O plugin não deve ser invocado porque não possui acesso a calendários ou compromissos.

3. **Não usar a Data2Content para gerar ou editar imagens.**

   Pedido: Remova o fundo desta fotografia e gere uma versão em alta resolução.

   Esperado: O plugin não deve ser invocado porque não oferece edição ou geração de imagens.

## Anotações das ferramentas

As 26 ferramentas operam sobre a conta autenticada e o catálogo delimitado da Data2Content; `openWorldHint: false` não significa que são todas somente leitura.

| Ferramenta | Consulta somente? | Substitui dados? | Efeito |
|---|---|---|---|
| `set_creator_north` | Não | Sim | Substitui o Norte anterior |
| `get_script_evidence_pack`, `generate_script_draft` | Não | Não | Podem guardar sessão/evidências/rascunho privado por sete dias; não adicionam à biblioteca |
| `save_script` | Não | Não | Adiciona roteiro após confirmação; repetição da mesma chave é segura |
| `record_script_feedback` | Não | Sim | Atualiza os campos de preferência solicitados e preserva os omitidos |
| `find_campaign_opportunities` | Não | Não | Pode criar a seleção gratuita da semana, com validade de 21 dias |
| Demais ferramentas | Sim | Não | Consultas sem gravação de dados do produto |

Seis ferramentas legadas respondem texto JSON sem `outputSchema`: `search`, `fetch`, `get_creator_profile`, `get_performance_summary`, `list_top_content`, `compare_content_formats`. O SDK aceita esse modo; conferir avisos no Scan Tools, sem afirmar que todas possuem saída estruturada declarada.

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
4. Abra **Data2Content → versão 1.0.0 existente**. Com servidor, testes e demonstração prontos, use `Cancel Review`, edite o mesmo rascunho e reenvie. Não crie um plugin duplicado. Cada reenvio inicia uma nova revisão; a OpenAI não publica prazo garantido.
5. Faça upload de `chatgpt-app-submission.json` na seção `Plugin Info` e revise os campos preenchidos automaticamente.
6. Envie `public/plugin/data2content-logo-512.png` como ícone do diretório e do composer.
7. Preencha os campos que não fazem parte do arquivo de importação usando as informações públicas deste documento.
8. O vídeo da conta completa com mapa/pautas, análise de período, evidências, roteiro, preferência e os casos negativos está publicado em `public/plugin/data2content-chatgpt-demo-v2.mp4`. Para regravar, capture a tela do Developer Mode, corte com `ffmpeg`, confira quadro a quadro que nenhuma outra janela aparece, troque o arquivo em `public/plugin/` e atualize `Demo Recording URL`.
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
- Perfil personalizado do funil: `https://data2content.ai/dashboard/profile?source=chatgpt`
- Suporte: `https://data2content.ai/suporte-plugin`
- Privacidade: `https://data2content.ai/politica-de-privacidade`
- Termos: `https://data2content.ai/termos-e-condicoes`

## Preparação e teste das contas fictícias

- `npx tsx --env-file=.env.local scripts/preparePluginReviewFixtures.ts`: prévia sem gravação. `--apply` completa apenas os registros das duas contas de revisão existentes, preservando credenciais e permissões.
- `npx tsx --env-file=.env.local scripts/smokePluginReview.ts`: teste de integração com o banco real limitado às contas de demonstração. `--write-demo` testa evidências, roteiro e preferências; `--live-generation` chama o provedor de geração configurado.
- O relatório fica em `output/plugin-review/verification.json`. Usa transporte em memória: não prova OAuth, acesso pelo ChatGPT nem aprovação da OpenAI.
- Credenciais reais permanecem somente no portal. Nunca copiá-las para este documento, JSON, logs ou vídeo.

### Ensaio real e rascunho atualizado — 08/09/2026

- Correções publicadas no commit `ee0a6cfe`; OAuth real da conta fictícia concluído no ChatGPT com a conexão privada **Data2Content Revisão**.
- No ChatGPT passaram mapa/pautas, período com dois Reels e um carrossel, ausência de saldo de seguidores, evidências planejadas, crítica, salvamento após confirmação e preferência solicitada. A pesquisa de comunidade respeitou resultados ausentes; publicidade distinguiu uma oportunidade próxima de uma correspondência exata.
- O motor interno retornou `local_fallback` e o ChatGPT informou a ausência de referências enviadas ao modelo. O provedor Gemini respondeu que os créditos pré-pagos estavam esgotados. A escrita no ChatGPT usando o pacote de evidências funcionou; não considerar o motor principal aprovado nesse ensaio nem fazer recarga sem autorização de pagamento.
- A versão pública existente **1.0.0 foi movida de Review para Draft**. O portal capturou 26 ferramentas; as 78 justificativas, os cinco testes, três negativos, três prompts e as notas foram preenchidos. Identidade Business — Data2Content, Brasil, ícones, URLs e senha de revisão preservados. Texto padrão em inglês e tradução brasileira atualizados.
- O upload automático do JSON falhou com `Not allowed`; os campos foram preenchidos pela interface. O formulário ficou sem erros e com `Submit for Review` habilitado, mas **não foi reenviado**.
- A demonstração ainda aponta para o vídeo anterior. A nova gravação depende de desbloqueio do Mac; depois de gravar e publicar, revisar o aceite final de termos antes do reenvio.
- No OAuth avançado, foi removido o override antigo de nove permissões. O servidor anuncia dez, incluindo `campaigns:read`; o consentimento atualizado permitiu o scan. Se o catálogo sumir ou o scan receber 403, conferir essa configuração antes de alterar código.
- Verificação complementar encontrou `profile:write` ausente de `MCP_SUPPORTED_SCOPES` na produção. A configuração foi corrigida na Vercel e em `.env.local`; `MCP_CONNECTION_SCOPES` preserva as nove permissões anteriores, com campanhas acrescentadas quando habilitadas. A nova publicação precisa ser verificada no metadata público antes de considerar a correção ativa. A execução de `set_creator_north` ainda exige novo consentimento explícito; não foi validada na conexão privada de dez permissões.

Referência oficial: https://developers.openai.com/plugins/deploy/app-review

### Vídeo da demonstração e escopo publicado — 09/09/2026

- `profile:write` confirmado no metadata público de produção (`/.well-known/oauth-authorization-server`). A correção de `MCP_SUPPORTED_SCOPES` está ativa; `set_creator_north` continua exigindo consentimento explícito e conexões antigas não ganharam a permissão sozinhas.
- A gravação de tela do macOS não pôde ser iniciada por automação (`screencapture -v` sem permissão de Gravação de Tela para o processo; `screencaptureui` recusou o spawn). As duas gravações feitas com a barra aberta manualmente ficaram em `output/plugin-review/`.
- O arquivo bruto tem quadros só até ~5min30 e uma janela de editor de vídeo aparece por ~2s. O vídeo da submissão foi montado com `ffmpeg` em três trechos, sem áudio, cortando essa janela; a varredura quadro a quadro a 1 fps confirmou que só a conversa do ChatGPT aparece.
- Publicado em `public/plugin/data2content-chatgpt-demo-v2.mp4` (1366x768, 1min52, ~3 MB), servido em `https://data2content.ai/plugin/data2content-chatgpt-demo-v2.mp4`.
- O vídeo mostra mapa declaratório e pauta sugerida, contagem de 1 a 7 de agosto com dois Reels e um carrossel e a lacuna de seguidores, referências planejadas com a ressalva de ausência de transcrição, roteiro e revisão técnica, registro de preferência, e os casos negativos de agenda e de imagem. A barra do Chrome sobre depuração aparece porque a sessão foi conduzida por automação de navegador.
- Reenvio concluído em 09/09/2026 00:5x (horário de Brasília): `Demo Recording URL` atualizado para o vídeo v2, o assistente percorreu Info → MCP → Skills → Prompts → Testing → Global → Submit, o rascunho salvou em cada passo e `Submit for Review` devolveu "Data2Content submitted for review". A lista do portal mostra a versão 1.0.0 em **Review**. Domain verification aparece como verificada e o catálogo tem as 26 ferramentas com justificativa.
- Fica pendente para Arthur: regularizar os créditos do Gemini (o motor interno responde por `local_fallback`, previsto no caso de teste 3, mas é um esqueleto genérico) e devolver o Chrome à conta habitual, que ficou na conta fictícia PRO desde o ensaio de 08/09.
