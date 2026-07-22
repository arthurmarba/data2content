# Relatório de revisão — Meta / Data2Content

**Aplicação:** Data2Content  
**URL de produção:** https://data2content.ai  
**Plataforma:** Web  
**Objetivo desta submissão:** demonstrar a conexão opcional de uma conta profissional do Instagram, a leitura de dados autorizados pela API oficial da Meta e o vínculo opcional do WhatsApp para entrega de confirmações e alertas.

> Antes de colar este texto no Meta for Developers, substitua os dois campos de credencial pelos dados da conta de teste ativa. Não salve senhas em documentos versionados nem nos anexos públicos.

## Texto para “Onde podemos encontrar o app?”

`https://data2content.ai`

O Data2Content é uma aplicação web responsiva. O revisor pode acessá-la em navegadores desktop ou mobile, sem restrição geográfica.

## Texto para “Como acessar o app?”

### Conta de teste

**Login direto da conta de revisão**

- E-mail: `<E-MAIL-DE-TESTE>`
- Senha: `<SENHA-DE-TESTE>`
- URL de login: `https://data2content.ai/login?review=1&callbackUrl=%2Fdashboard`

**Conta Meta/Facebook usada para vincular o Instagram de teste**

- E-mail: `<E-MAIL-META-DE-TESTE>`
- Senha: `<SENHA-META-DE-TESTE>`
- Página de teste: `<NOME-DA-PAGINA-DE-TESTE>`
- Conta profissional do Instagram de teste: `@<USUARIO-IG-DE-TESTE>`

A conta de teste tem acesso ativo a todos os recursos necessários para a análise. Não é necessário pagamento, assinatura ou cartão.

### Fluxo 1 — Login e conexão de Instagram

**Permissões demonstradas:** `public_profile`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights` e `business_management`.

1. Acesse `https://data2content.ai/login?review=1&callbackUrl=%2Fdashboard`.
2. Na tela **“Acesso de revisão”**, informe o e-mail e a senha de teste e clique em **“Entrar na conta de teste”**. Esse acesso direto evita verificações adicionais do Google e leva ao mesmo usuário de teste.
3. Ao retornar ao painel, clique na foto/avatar do usuário, no canto inferior do menu lateral, para abrir o menu da conta.
4. No menu da conta, clique em **“Conexão”**. Será aberta a página **“Conexões”** em `https://data2content.ai/dashboard/instagram-connection`.
5. Na seção **“Instagram profissional”**, confirme o estado **“Não conectado”** e clique em **“Revisar e conectar com a Meta”**.
6. Na tela **“Conecte seu Instagram”**, confira os avisos **“Somente leitura”** e **“Não publicamos nada”**. Expanda **“Requisitos e permissões”** para ver os requisitos da conta e as finalidades de leitura. Depois clique em **“Conectar Instagram”**.
7. O aplicativo abre o diálogo de autorização da Meta/Facebook. Entre com a conta Facebook de teste, caso necessário, e conceda as permissões solicitadas.
8. Na Meta, selecione a Página de teste administrada pela conta Facebook. Quando a Meta apresentar um Portfólio Empresarial/Business, selecione aquele que contém essa Página e a conta Instagram profissional de teste. Essa descoberta usa `pages_show_list` e, quando necessário, `business_management`.
9. Conclua a autorização. O Data2Content abrirá a tela **“Conectando Instagram…”**, com as etapas **“Preparar”**, **“Autorizar”**, **“Escolher conta”** e **“Concluir”**.
10. Se apenas uma conta Instagram válida for encontrada, ela será conectada automaticamente. Se houver mais de uma, selecione `@<USUARIO-IG-DE-TESTE>` na etapa **“Escolha da conta Instagram”**.
11. Aguarde a mensagem **“Conta conectada com sucesso. Redirecionando…”**.
12. Ao retornar a **“Conexões”**, confirme o nome/@username do perfil e o estado **“Sincronização Ativa”**. A mesma seção oferece a ação **“Desconectar conta”**.

### Fluxo 2 — Uso dos dados do Instagram

**Permissões demonstradas:** `instagram_basic` e `instagram_manage_insights`.

1. Com o Instagram conectado, use o menu lateral e clique em **“Análise de Perfil”**, ou acesse diretamente `https://data2content.ai/planning/graficos`.
2. A página **“Análise de Perfil”** organiza os resultados nas abas **“O que postar”**, **“Hora/Tempo”**, **“Meus Conteúdos”** e **“Próximo passo”**.
3. Abra **“Meus Conteúdos”**. A tela mostra o ranking dos posts do período e leituras como **“Alcance x resposta”** e **“Evolução”**, construídas com as métricas autorizadas do Instagram.
4. Use o seletor de período e, quando disponível, alterne a métrica-base entre **“Engajamento”** e **“Alcance”** para demonstrar que a análise usa dados reais da conta conectada.
5. Volte ao menu lateral e abra **“Seu Mapa”** para mostrar como os posts, legendas e sinais do perfil alimentam a leitura estratégica e as recomendações do produto.
6. Os dados usados incluem informações básicas da conta profissional (ID, nome de usuário, foto, número de seguidores e contagem de mídias) e métricas agregadas de desempenho, como alcance, visualizações, interações, curtidas, comentários, compartilhamentos, salvamentos, visitas ao perfil, seguidores e, quando a Meta disponibiliza, dados demográficos agregados.
7. A integração é de **somente leitura**: o produto não cria, altera, agenda ou publica posts, Reels, Stories ou comentários no Instagram/Facebook.

### Fluxo 3 — Vínculo opcional do WhatsApp

**Permissões/produto demonstrados:** `whatsapp_business_messaging` e `whatsapp_business_management`.

1. Com o plano ativo e o Instagram conectado, abra **“Conexão”** no menu da conta ou acesse `https://data2content.ai/dashboard/instagram-connection#whatsapp`.
2. Na página **“Conexões”**, localize a seção **“Alertas no WhatsApp”**. O texto explica que o WhatsApp recebe confirmações e alertas, enquanto as conversas com IA ficam no Chat AI.
3. O aplicativo gera um código temporário de seis caracteres e apresenta o botão **“Abrir WhatsApp”**.
4. Clique em **“Abrir WhatsApp”**. O WhatsApp abre uma conversa com o número comercial do Data2Content e uma mensagem pré-preenchida no formato: **“Olá, data2content! Meu código de verificação é: XXXXXX”**.
5. Envie a mensagem sem alterar o código.
6. O serviço valida o código, vincula o número que enviou a mensagem à conta Data2Content e responde com a confirmação de que o número será usado para alertas, incluindo um link para abrir o Chat AI.
7. Volte à seção **“Alertas no WhatsApp”** e confirme que o número aparece como conectado. A ação **“Desvincular”** permite interromper os alertas e remover o vínculo dentro da própria plataforma.
8. Clique em **“Abrir Chat AI”** para demonstrar que as conversas com o assistente acontecem dentro da plataforma.

O WhatsApp é usado para confirmações de vínculo e alertas/notificações proativas. As dúvidas e conversas com IA ficam centralizadas no **Chat AI dentro da plataforma**, e não no WhatsApp.

O WhatsApp é opcional e não é necessário para concluir a conexão do Instagram.
O usuário também pode enviar **“SAIR”** pelo WhatsApp para interromper mensagens, além de usar **“Desvincular”** na plataforma.

### Informações adicionais para o revisor

- No momento desta submissão, o acesso do Facebook Login e/ou das permissões avançadas pode aparecer como indisponível para contas comuns porque a análise regular deste app está pendente. Essa é a razão desta nova submissão, e não uma restrição implementada pelo Data2Content. O login da conta de revisão e todo o percurso interno permanecem acessíveis. Solicitamos que a equipe da Meta utilize o acesso próprio de revisão para abrir o diálogo OAuth e avaliar as permissões solicitadas.
- A conta de Instagram de teste deve permanecer como **Profissional (Criador ou Comercial)**, vinculada à Página de teste e administrada pela conta Facebook de teste durante todo o período de análise.
- Mantenha posts de exemplo publicados na conta de teste para que existam mídias e métricas para leitura.
- Caso uma autorização anterior esteja expirada, abra novamente `https://data2content.ai/dashboard/instagram/connect` e refaça o Fluxo 1.
- Privacidade: https://data2content.ai/politica-de-privacidade
- Termos: https://data2content.ai/termos-e-condicoes
- Exclusão de dados/conta: após o login, acesse `https://data2content.ai/dashboard/settings`.
- A aplicação e seus recursos não possuem bloqueio geográfico.

## Texto para “Códigos de acesso / assinatura”

Use a conta de teste informada nas instruções pelo acesso direto `https://data2content.ai/login?review=1&callbackUrl=%2Fdashboard`. Ela já possui acesso ativo aos recursos necessários para a análise; não há pagamento, compra no app ou código promocional necessário.

## Resposta para “O Facebook Login está integrado nesta plataforma?”

**Resposta:** Sim.

O acesso inicial ao Data2Content é feito pela conta de revisão, mas o Facebook Login/OAuth está integrado ao fluxo **“Revisar e conectar com a Meta”** para autorizar a Página e a conta profissional do Instagram. Esse fluxo é demonstrado no primeiro vídeo.

## Textos para “Tratamento de dados”

### Operadores de dados / provedores de serviço

**Resposta:** Sim.

**Texto para a lista de operadores:**

`Mobi Media Produtores de Conteúdo LTDA (controladora e operadora da plataforma); Vercel, Inc. (hospedagem e execução da aplicação); MongoDB, Inc. / MongoDB Atlas (banco de dados); Upstash, Inc. (cache e filas de tarefas); OpenAI, L.L.C. (processamento de IA para análises, quando habilitado); Google LLC / Google Gemini API (processamento de IA para análises, quando habilitado).`

Inclua OpenAI e Google somente se as respectivas APIs estiverem habilitadas em produção e receberem dados originados da Meta. A razão para listá-las é que as análises podem processar legendas e, em determinados fluxos, imagens/capas de posts do Instagram.

### Responsável pelos Dados da Plataforma

**Entidade:** `Mobi Media Produtores de Conteúdo LTDA`  
**País:** Brasil

Use a grafia exata constante no CNPJ e nos instrumentos societários; não use uma variação de marca se ela divergir da razão social.

### Pedidos de autoridades públicas

Mantenha **“Não”** em compartilhamento por solicitações de segurança nacional somente se isso continua verdadeiro nos últimos 12 meses.

Na pergunta sobre processos/políticas aplicados a pedidos de autoridades públicas, não marque controles que não estejam formalmente implementados. Se não houver procedimento documentado que corresponda às opções, a resposta correta é **“Nenhuma das opções acima”**.

## Matriz de permissões e finalidade

| Permissão / produto | Finalidade demonstrada ao revisor |
| --- | --- |
| `public_profile` | Reconhecer a conta Facebook autorizada e associar com segurança a conexão Meta à conta Data2Content já autenticada. |
| `pages_show_list` | Listar as Páginas que a pessoa administra e localizar a Página vinculada ao Instagram profissional. |
| `business_management` | Localizar ativos de negócios quando a conta estiver administrada pelo Meta Business Manager. |
| `instagram_basic` | Ler o perfil profissional e as mídias usadas nas análises. |
| `instagram_manage_insights` | Ler métricas agregadas de conta e mídias para gerar leituras, recomendações e relatórios. |
| `whatsapp_business_messaging` | Receber a mensagem de vínculo e enviar a confirmação, alertas e notificações após o opt-in. |
| `whatsapp_business_management` | Gerenciar a configuração técnica do número e modelos de mensagem usados pelo serviço. |

## Anexos recomendados

Anexe os três vídeos definidos em `ROTEIRO_GRAVACAO_META.md`, nomeados conforme o roteiro. Eles devem ser gravados novamente: as capturas antigas mostram uma interface de conexão que não corresponde mais à tela atual.
