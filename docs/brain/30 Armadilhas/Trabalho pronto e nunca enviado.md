---
tipo: armadilha
custo: dias de investigação inútil
---

# Código pronto que nunca chegou no repositório

## O sintoma

Um campo está vazio no banco. Uma funcionalidade "não existe". Você lê o código, não encontra, e conclui que nunca foi feito.

## A causa

**Foi feito — e ficou fora do `origin/main`.** Sessões paralelas de Codex já deixaram recursos inteiros parados numa branch que nunca foi integrada. O repositório tem dezenas de branches `*-codex/*` no remoto.

## O que fazer antes de investigar

```bash
git branch -r | grep -i <assunto>
git log --all --oneline --grep=<assunto>
```

Confira se o código existe em **alguma** branch antes de concluir que não existe. É mais rápido que ler o banco.

## Ligações

[[Produção nem sempre é o main]] · [[13 Como pedir pra IA]]
