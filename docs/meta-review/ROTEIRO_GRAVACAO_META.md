# Roteiro de gravações de tela para a revisão da Meta

Grave em 1080p, com o cursor visível e sem música. Use a conta de teste; mas oculte senhas, e-mails pessoais, tokens, códigos de sessão e qualquer dado de terceiros. Três vídeos curtos e objetivos são melhores do que um vídeo longo.

Antes de gravar, execute o fluxo completo com uma conta Meta que possua função no app, como administrador, desenvolvedor ou testador. Durante uma reavaliação, uma conta comum pode receber **“O Login do Facebook está indisponível para este app no momento”** porque o acesso avançado foi suspenso até a conclusão da análise. Nesse caso, registre essa condição nas instruções do analista; ela não deve ser apresentada como falha do Data2Content.

## 01 — `01-login-e-autorizacao-instagram.mp4` (2 a 3 min)

**Objetivo:** provar como a pessoa chega à autorização e quais permissões são usadas.

1. Comece em `https://data2content.ai/login?review=1&callbackUrl=%2Fdashboard`.
2. Mostre a tela **“Acesso de revisão”**, informe as credenciais de teste sem deixar a senha visível e clique em **“Entrar na conta de teste”**.
3. Confirme que o login abre o painel sem CAPTCHA, código de segundo fator ou pagamento.
4. No painel atual, mostre rapidamente as áreas **“Seu Mapa”**, **“Collabs”**, **“Campanhas”** e **“Comunidade”**.
5. Clique no avatar do usuário, no canto inferior do menu lateral, e escolha **“Conexão”**.
6. Na página **“Conexões”**, mostre a seção **“Instagram profissional”**, o estado **“Não conectado”** e clique em **“Revisar e conectar com a Meta”**.
7. Na tela **“Conecte seu Instagram”**, mostre **“Somente leitura”** e **“Não publicamos nada”**. Expanda **“Requisitos e permissões”**, percorra os requisitos e finalidades exibidos e clique em **“Conectar Instagram”**.
8. No diálogo da Meta, mostre as permissões solicitadas e selecione a Página de teste, o Business/Portfólio Empresarial correspondente (quando exibido) e a conta Instagram profissional de teste.
9. Após voltar ao Data2Content, grave a tela **“Conectando Instagram…”** e suas quatro etapas: **“Preparar”**, **“Autorizar”**, **“Escolher conta”** e **“Concluir”**.
10. Se houver mais de uma conta, selecione a conta de teste. Se houver apenas uma, mostre que a conclusão acontece automaticamente.
11. Termine mostrando **“Conta conectada com sucesso”** e, em **“Conexões”**, o perfil conectado com o estado **“Sincronização Ativa”**.

**Narração sugerida:** “O Data2Content pede autorização da Meta apenas para ler a conta profissional do Instagram e suas métricas. Não publicamos, alteramos ou moderamos conteúdo. A Página e os ativos Business são usados apenas para localizar a conta Instagram autorizada.”

## 02 — `02-dados-e-resultado-no-produto.mp4` (2 a 3 min)

**Objetivo:** conectar cada dado lido a um benefício visível no produto.

1. Comece em `https://data2content.ai/dashboard/instagram-connection` e, na página **“Conexões”**, mostre o @username e **“Sincronização Ativa”**.
2. No menu lateral, clique em **“Análise de Perfil”**.
3. Mostre o título **“Análise de Perfil”** e as abas **“O que postar”**, **“Hora/Tempo”**, **“Meus Conteúdos”** e **“Próximo passo”**.
4. Abra **“Meus Conteúdos”** e mostre o ranking de posts, **“Alcance x resposta”** e **“Evolução”**. Deixe visíveis valores reais de alcance/interações da conta de teste.
5. Se disponível, altere o período e a métrica-base entre **“Engajamento”** e **“Alcance”**.
6. Abra **“Seu Mapa”** pelo menu lateral e mostre uma leitura/recomendação formada a partir dos posts e legendas do perfil.
7. Volte a **“Conexões”** e mostre a ação **“Desconectar conta”**, sem executá-la durante o vídeo.

**Narração sugerida:** “Após o consentimento, usamos `instagram_basic` para identificar o perfil e as mídias, e `instagram_manage_insights` para analisar métricas agregadas como alcance, visualizações e interações. A conexão pode ser revogada pelo usuário a qualquer momento.”

## 03 — `03-vinculo-whatsapp-e-alertas.mp4` (1 a 2 min)

**Objetivo:** explicar o vínculo por opt-in e as mensagens enviadas pelo serviço.

1. Com o plano ativo e o Instagram conectado, abra `https://data2content.ai/dashboard/instagram-connection#whatsapp`.
2. Na página **“Conexões”**, mostre a seção **“Alertas no WhatsApp”** e leia o texto que diferencia alertas no WhatsApp de conversas com IA no Chat AI.
3. Mostre o código temporário de seis caracteres e clique em **“Abrir WhatsApp”**.
4. No WhatsApp, mostre a mensagem pré-preenchida **“Olá, data2content! Meu código de verificação é: XXXXXX”** e envie sem alterar o código.
5. Mostre a confirmação recebida: o número foi vinculado para receber alertas e a mensagem oferece um link para abrir o Chat AI.
6. Volte à seção **“Alertas no WhatsApp”** e mostre o estado conectado e a ação **“Desvincular”**, sem executá-la durante a gravação.
7. Clique em **“Abrir Chat AI”** e mostre rapidamente que as conversas com IA acontecem dentro da plataforma.

**Narração sugerida:** “O vínculo do WhatsApp acontece quando a pessoa envia voluntariamente o código. Depois disso, usamos a API do WhatsApp para confirmar o vínculo e entregar alertas e notificações. As conversas com IA permanecem dentro do Chat AI da plataforma.”

## Checklist final de cada vídeo

- [ ] O domínio `data2content.ai` aparece na gravação.
- [ ] A gravação mostra o fluxo real de produção, não um protótipo.
- [ ] O ativo Instagram mostrado é Profissional e é o mesmo da conta de teste.
- [ ] Não há senha, token, código de backup, telefone privado ou dado de outro cliente.
- [ ] A gravação usa a interface atual de conexão, que informa leitura/somente leitura.
- [ ] O vídeo do WhatsApp não afirma que existe conversa com IA pelo WhatsApp; essa conversa ocorre no Chat AI da plataforma.
- [ ] Depois de gravar o fluxo de autorização, a conta de teste foi deixada no estado apropriado para o revisor repetir a conexão.
- [ ] O início do OAuth usa exatamente `public_profile`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights` e `business_management`.
- [ ] Se o acesso estiver suspenso pela reavaliação, essa condição foi explicada nas instruções do analista e o vídeo foi gravado com uma conta que possui função no app, quando disponível.
- [ ] O vídeo está em `.mp4` ou `.mov`, abre normalmente e tem menos de 2 GB.
