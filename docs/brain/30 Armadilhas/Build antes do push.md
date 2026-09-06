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

## A pegadinha que existia até 06/09/2026

Pastas de trabalho como `tmp/` **não estavam no `.gitignore`** — e continham arquivos TypeScript soltos que entravam na conferência de tipos. Resultado: o build local quebrava por um arquivo que nem existe em produção, e você perdia tempo caçando um problema que não era seu.

**Resolvido:** `tmp/`, `tmp-home/`, `.playwright-cli/` e as saídas de compilação da raiz (`tsc_*.txt`, `build_output*.txt`, `fix_output*.json`) foram removidos do repositório e passaram a ser ignorados.

Se o build local voltar a falhar em algo dentro de uma pasta de trabalho, é sinal de que alguma coisa nova escapou do `.gitignore` — limpe antes de acreditar no erro.

## Ligações

[[11 Como rodar e verificar]]
