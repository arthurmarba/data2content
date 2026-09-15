---
tipo: armadilha
custo: leitura paga repetida e padrões do criador inflados
estado: conhecido, não resolvido (14/09/2026)
---

# Reel repostado é lido e contado de novo

## O sintoma

Criadores repostam o mesmo vídeo várias vezes como "reels de teste" (entregues só a
não seguidores) para dar vida longa a um conteúdo que viraliza. Cada repostagem é um
post novo para o Instagram: a leitura de cena paga outra vez e o relatório semanal
conta o mesmo vídeo como conteúdos diferentes.

Em set/2026, 384 de 3.272 reels dos últimos 90 dias (12%) tinham outro reel do mesmo
criador com a mesma duração (±0,1s), em 57 criadores; em alguns, 40% dos vídeos.

## O que não funciona

- A API não diz se é reel de teste. `is_shared_to_feed` veio igual em todas as
  postagens de um grupo repetido, com alcance normal ou zero. Posts antigos do grupo
  costumam devolver `Unsupported get request` (apagados).
- Hash do arquivo: o Instagram recodifica cada envio, os bytes mudam.
- Legenda sozinha: só 53 das 384 repetem a legenda; legenda genérica ("." ou "1")
  casaria vídeos diferentes.

## Caminho esboçado (não implementado)

Candidato = mesmo criador + duração ±0,2s. Confirma por legenda não genérica ou pela
fala/áudio dos primeiros 10s, comparados no vídeo que já é baixado antes da leitura;
imagem desempata vídeo só com música em alta. Copiar a leitura, manter as métricas por
post. Antes de construir, medir a precisão cruzando `openingLine` já salva entre
gêmeos de duração. Nenhum grupo foi confirmado assistindo aos vídeos.

## Ligações

[[Relatório Semanal]] · [[Leitura de cena em loop relida a cada repescagem]] · [[Filas e rotinas]]
