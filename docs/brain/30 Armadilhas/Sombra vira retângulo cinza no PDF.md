---
tipo: armadilha
contexto: Galileia e outros PDFs
---

# `box-shadow` grande vira um retângulo cinza no PDF

O Chromium, ao gerar PDF, não desenha sombra com desfoque grande: ele entrega um retângulo cinza chapado no lugar.

## O erro de conferência

Olhar o `capa.png` e achar que está tudo bem. **O screenshot não tem o problema — só o PDF tem.**

## Como conferir de verdade

```bash
pdftoppm -png -r 80 arquivo.pdf saida
```

Converta o **PDF real** em imagem e olhe. É a única checagem que vale.

## Ligações

[[Relatório Semanal]]
