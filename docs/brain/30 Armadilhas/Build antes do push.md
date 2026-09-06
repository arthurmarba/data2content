---
tipo: armadilha
custo: horas de deploy quebrado
---

# Rode o build antes de empurrar

## O que acontece

A suíte de testes passa inteira, você empurra, e a Vercel quebra.

## Por quê

**`npm test` não confere tipo.** O Jest roda o código; ele não roda o TypeScript. Um tipo errado passa batido por toda a suíte e só aparece no `next build`.

## O que fazer

```bash
npm run build
```

Antes de empurrar. Sempre. É a única conferência local que se parece com a de produção.

## A pegadinha dentro da pegadinha

Pastas de trabalho como `tmp/` **não estão no `.gitignore`** — mas também não vão pra Vercel. Resultado: o build local quebra por causa de um arquivo solto que não existe em produção, e você perde tempo caçando um problema que não é seu. Se o build local falhar em algo dentro de `tmp/`, `output/` ou similar, limpe antes de acreditar no erro.

## Ligações

[[11 Como rodar e verificar]]
