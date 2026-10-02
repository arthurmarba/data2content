---
tipo: armadilha
---

# Carrossel some quando se pede o tipo dos itens

## O sintoma

Um criador perguntou se carrossel era lido. Na conta dele, a API dizia 178 posts
e o banco tinha 171: faltavam **todos os 7 carrosséis**, inclusive o da semana
anterior. Na base inteira havia **um** carrossel (02/10/2026), contra 1.872 fotos
e 36 mil Reels.

Nenhum erro em log. A sincronização terminava com sucesso.

## Por que acontecia

A listagem de mídias pedia, para os itens internos do carrossel,
`children{id,media_type,media_product_type,...}`. Com `media_product_type` dentro
de `children`, a Graph API (v22) **omite o carrossel inteiro da página** e devolve
o resto normalmente: 23 itens numa página de 25, nenhum carrossel. Tirando só esse
campo, os 25 voltam.

Desde 16/05/2025 (commit `6f03b863`) o campo estava lá — então todo carrossel de
todo criador ficou fora, e as telas e o conector diziam "100% Reels" com cara de
verdade.

## Como ficou

`CAROUSEL_CHILD_FIELDS` em `src/app/lib/instagram/api/fetchers.ts`, sem o campo,
usado nas duas listagens. Teste em `api/mediaListFields.test.ts`. A sincronização
periódica traz os carrosséis dos últimos 180 dias; o histórico da conexão
(`npm run backfill:instagram-history`) traz os mais antigos, sem IA.

## A regra que fica

Quando a contagem da API e a do banco não batem, compare **por tipo** antes de
procurar erro: campo pedido a mais pode apagar itens em silêncio. E "a conta só
publica Reels" é hipótese a conferir, não conclusão.

Ligações: [[Instagram e métricas]] · [[Cobertura que cobra o impossível]]
