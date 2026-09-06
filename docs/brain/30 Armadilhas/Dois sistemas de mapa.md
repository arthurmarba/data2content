---
tipo: armadilha
tipo-real: dívida de arquitetura
---

# Existem dois caminhos de mapa vivendo lado a lado

## O que são

1. **Síntese do vídeo enviado** — vivo, é o que roda no fluxo do celular.
2. **`MapaSeed` alimentado pelo Instagram** — esteve **adormecido em produção**; o enriquecimento por Gemini a partir do Instagram não estava rodando.

A decisão tomada foi **acordar o `MapaSeed`**, não abandoná-lo.

## Por que isso te morde

Você lê o código de um caminho, conclui como o mapa funciona, e o comportamento em produção vem do outro. Ou pior: conserta o caminho que não está no ar.

## O que fazer

Antes de mexer em qualquer coisa de mapa, descubra **qual dos dois está ligado** naquele ambiente — pelas chaves `*_ENABLED` e pelo que o dado no banco mostra (`npm run` → `inspectMapaSeedState`).

## Ligações

[[Seu Mapa]] · [[Variável só no .env.local]]
