---
tipo: armadilha
custo: semanas
resolvido: sim
---

# Legenda da Meta vem sem @

## O sintoma

A busca de publis do MCP admin (`find_creator_publis`) nunca apontava "publi sem marcação" quando não
se informava marca, mesmo em perfil cheio de cupom e chamada de compra.

## A causa

A Graph API devolve a legenda com o nome da conta mencionada, mas sem o "@": "aqui comemos a
selectbymonello", não "@selectbymonello". Das 6.403 legendas dos 15 perfis de outubro, só 8 tinham
um "@". O filtro só marcava campanha quando havia menção com "@", então esse caminho nunca disparava.

No mesmo filtro, "publi" solto no fim da legenda ("💖 publi") também escapava, porque a regra
exigia pontuação depois da palavra: 102 de 472 publis marcadas ficavam de fora.

## A correção

#937: campanha sem marcação não depende mais de "@", "publi" solto conta como marcação, e o post sem
marcação passa por uma segunda leitura do Jev (`src/app/lib/ai/jev.ts`). Ao procurar marca ou menção
em legenda vinda da Meta, compare o nome sem "@" (como faz `brandKey` em `marketplacePublis.ts`).
