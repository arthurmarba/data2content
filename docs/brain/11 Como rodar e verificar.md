---
tipo: fundação
---

# 11 — Como rodar e verificar

## O básico

```bash
npm run dev
```

Sobe em `http://localhost:3000` (ou o que estiver em `PORT`). O projeto exige **Node 22** — existe um `scripts/with-preferred-node.sh` que tenta acertar isso sozinho.

| Comando | Para quê |
| --- | --- |
| `npm run dev` | Desenvolver |
| `npm run build` | O teste de verdade antes de publicar |
| `npm test` | Testes unitários (Jest) |
| `npm run lint` | ESLint em `src` |
| `npm run typecheck` | Conferência de tipos (`tsconfig.smoke.json`) |
| `npm run test:e2e` | Playwright, navegador de verdade |
| `npm run brain` | Atualiza o inventário deste cérebro |

Lista completa: [[Comandos npm]].

## A regra que dói quando se esquece

> **Rode `npm run build` antes de empurrar.**

O `npm test` **não confere tipo**. Dá pra ter a suíte inteira verde e o build da Vercel quebrar por um tipo errado. O build local é a única conferência que se parece com a de produção. Ver [[Build antes do push]].

## Segredos e chaves

Tudo vive no `.env.local`, que não vai pro repositório. **Variável que existe só na sua máquina não existe em produção** — a funcionalidade simplesmente some lá, geralmente com erro 403 ou uma tela vazia. Ao criar uma variável nova, repita ela na Vercel no mesmo dia. Ver [[Variável só no .env.local]].

O inventário [[Variáveis de ambiente]] lista as 400+ que o código lê hoje, agrupadas por família.

## Chaves que ligam e desligam funcionalidade

O projeto usa muito o padrão `ALGUMA_COISA_ENABLED`. Elas existem pra publicar código pela metade sem expor pro criador. Antes de dizer que "a funcionalidade não funciona", confira se a chave está ligada nos dois lugares (máquina e Vercel).

As mais presentes: `NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED`, `NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED`, `NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED`, `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED`, `MCP_ADMIN_ENABLED`, `MCP_CAMPAIGN_RADAR_ENABLED`.

## Scripts que mexem no banco de verdade

Qualquer comando com `--env-file=.env.local` está falando com o **banco real**, não com um de mentira. Isso inclui as migrações, os backfills e as auditorias. Leia o arquivo antes de rodar, e prefira a versão `--dry-run` quando existir.

## Testar no navegador

A configuração do preview está em `.claude/launch.json` (nome `d2c-frontend`, porta 3001). Quem estiver desenvolvendo com IA deve abrir o preview e conferir sozinho — console, rede, tela — em vez de pedir pro usuário olhar.

## Ligações

[[10 Mapa do sistema]] · [[Build antes do push]] · [[Comandos npm]]
