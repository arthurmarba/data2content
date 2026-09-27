---
tipo: armadilha
custo: horas
resolvido: contornado
---

# Screencast da análise da Meta não anexa pela automação

## O sintoma

No formulário de "Uso permitido" da análise do app, o arquivo sobe até "100%", o texto e a declaração salvam, mas o item "Carregue o screencast" continua sem o visto. Reabrindo o formulário, a área de vídeo volta vazia ("Arraste e solte seu arquivo"). Sem vídeo, o painel não deixa avançar para "Tratamento de dados".

## A causa (o que se sabe)

O envio do vídeo tem três passos: `vupload-edge.facebook.com/ajax/video/upload/requests/start/` (responde 200 com `video_id`), um GET no `rupload-*.up.facebook.com/fb_video/...` (200, `offset: 0`) e o POST com o arquivo. **O POST volta 400 com `NotAuthorizedError: User not authorized to perform this request`**, e o formulário tenta de novo em silêncio. A barra de 100% é só o navegador terminando de mandar os bytes.

Não é o arquivo: tamanho, tipo e cabeçalhos iguais aos de um envio normal, com `withCredentials`. Em 27/09/2026 falhou com o arquivo anexado pela extensão do Claude no Chrome; em 11/09 a mesma automação tinha funcionado. Suspeitas não confirmadas: sessão do Facebook pedindo reautenticação para essa ação, ou alguma extensão de privacidade do Chrome cortando o cookie nos pedidos a `*.up.facebook.com`.

## O que fazer

- Não confie no "100%" nem no `read_network_requests` (ele só mostrou o OPTIONS). Para ver a resposta real, envolva `XMLHttpRequest.prototype.send` na página e leia o `responseText` do POST em `rupload`.
- Peça ao Arthur para anexar à mão. Em 27/09 a primeira tentativa dele também não pegou; funcionou depois de refazer (a orientação era janela anônima). Confira sempre reabrindo o formulário: tem de aparecer "Visualizar screencast carregado", e a duração do vídeo aberto confirma se é o arquivo certo.
- Os vídeos prontos e os brutos ficam em `output/meta-review/`; os textos do pedido, em `docs/meta-review/JUSTIFICATIVAS_REENVIO.md`.

## Gravação e edição que funcionaram

- Gravar com `ffmpeg -f avfoundation -capture_cursor 0 -i "4:none"` e deixar a aba certa na frente com AppleScript (`set active tab index`), porque a aba controlada pela extensão fica escondida no grupo.
- O Chrome desenha um contorno laranja de ~14 px ("Claude ativo") em volta da página; corte a borda.
- No Login do Facebook aparecem Páginas, empresas e contas do Instagram de clientes do Arthur: desfoque a lista inteira menos a linha marcada (fundo azul). O script está em `output/meta-review/montar.py`.

## Rasteira vizinha: a conta de revisão precisa de liberação

`/creator-research` mostra a descoberta de criadores só para administrador ou para quem tem registro em
`creator_research_review_grants`. A conta citada nas instruções para o analista não tinha — o analista
entrava e não via a seção. Ao trocar ou reaproveitar conta de revisão, confira o registro.
