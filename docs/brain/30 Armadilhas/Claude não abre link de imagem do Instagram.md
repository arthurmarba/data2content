---
tipo: armadilha
---

# Claude não abre link de imagem do Instagram

**Sintoma:** no Claude, usando o MCP da D2C, pedir a foto ou as capas de um criador dá
`host_not_allowed`, e o Claude conclui que "a base não guarda as thumbs".

**Por quê:** o ambiente do Claude só baixa de uma lista fechada de domínios, e o CDN do
Instagram (`fbcdn.net`, `cdninstagram.com`) não está nela. E o contrato textual do MCP
esconde `thumbnailUrl`/`coverUrl`, então o Claude nem vê que a capa existe — está em
`Metric.coverUrl` para quase todos os posts.

**Saída:** `get_creator_images` — o servidor baixa e entrega a imagem dentro da resposta.
Não resolver liberando domínio no cliente: a URL vence em dias e cada usuário teria que
configurar. Ver [[MCP — ChatGPT e Claude]].
