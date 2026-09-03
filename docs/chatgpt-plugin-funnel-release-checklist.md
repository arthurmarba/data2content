# Checklist de liberação — funil ChatGPT → Data2Content

Este documento separa o que já pode ser validado localmente do que só deve acontecer depois da aprovação do plugin.

## Estados esperados no ChatGPT

- Conta sem Norte: perguntar quem é o creator, sobre o que deseja falar e qual transformação quer gerar.
- Conta gratuita: responder com Norte e padrões agregados e encerrar cada resposta com uma linha curta para o perfil personalizado.
- PRO sem Instagram: continuar com o contexto disponível e indicar a conexão somente quando a análise dos conteúdos próprios fizer diferença.
- PRO com Instagram: usar a inteligência particular e não mostrar lembrete comercial.
- PRO com convite pendente: mostrar o acesso à comunidade no máximo uma vez por conversa.
- Convite já aberto: não repetir o link da comunidade.

## Validação local

- `npm run typecheck`
- `npm run typecheck:mcp`
- `npm run test:mcp -- --silent`
- `npm run test:chatgpt-funnel`
- Testar login Google novo e existente com retorno para `/mcp/authorize`.
- Testar perfil com `source=chatgpt` e cupom manual `d2cVIP`.
- Testar checkout mensal e anual, com e sem `sessionStorage`, incluindo status ativo, pendente e indisponível.
- Confirmar que o status pendente é verificado automaticamente e que “Verificar novamente” retoma o fluxo sem duplicar a conversão.
- Testar Instagram conectado, ignorado e com erro.
- Testar retorno para o plugin e consumo único do convite da comunidade.
- Confirmar nos eventos `chatgpt_funnel_event` se falhas de OAuth do Instagram e ausência da URL pública de retorno estão visíveis.

## Configuração de mensuração

- `NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID`: Pixel no navegador.
- `OPENAI_ADS_PIXEL_ID`: Pixel usado pela Conversions API.
- `OPENAI_ADS_CONVERSIONS_API_KEY`: segredo exclusivamente server-side.
- `OPENAI_ADS_CAPI_VALIDATE_ONLY=1`: validar eventos sem salvá-los durante o primeiro teste.
- Depois da validação, trocar `OPENAI_ADS_CAPI_VALIDATE_ONLY` para `0`.

A Conversions API só é chamada quando `cookie_consent=granted`. Quando `oppref` chega na URL, ele é preservado sem alteração em cookie próprio: pelo middleware se o consentimento já existe, ou no clique em “Aceitar” quando é a primeira visita. Recusar apaga `__oppref` e `__obref`. Antes do envio, um Checkout precisa estar `complete` e sua assinatura precisa estar `active` ou `trialing`; uma assinatura enviada diretamente também precisa estar `active` ou `trialing`. O mesmo ID é usado no pixel e no servidor para deduplicação.

## Depois da aprovação

- Preencher `NEXT_PUBLIC_CHATGPT_PLUGIN_URL` com a URL pública específica do plugin; a home genérica do ChatGPT é rejeitada.
- Atualizar a versão publicada com as mensagens por estado.
- Configurar as credenciais de mensuração.
- Fazer deploy em staging e executar o fluxo completo com uma conta nova.
- Validar a abertura do plugin a partir do anúncio.
- Confirmar em um anúncio real se `oppref` chega ao domínio Data2Content depois da passagem anúncio → plugin → OAuth/site.
- Publicar somente depois do teste em Developer Mode com o endpoint de produção.
