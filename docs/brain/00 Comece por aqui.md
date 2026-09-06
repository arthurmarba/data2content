---
tipo: índice
---

# 00 — Comece por aqui

Este é o **cérebro do código da Data2Content**: o que uma pessoa (ou uma IA) precisa saber antes de mexer em qualquer coisa, num projeto que tem 2 mil arquivos e não cabe na cabeça de ninguém.

Os arquivos moram no repositório, em `d2c-frontend/docs/brain/`. Você lê e escreve pelo Obsidian; o Claude e o Codex leem direto da pasta do projeto, sem você precisar colar nada. Quando o código muda, a correção da nota entra no mesmo commit.

## Como usar

- **Vai mexer numa área?** Abra a nota do domínio em `20 Domínios` antes. Ela diz onde as coisas ficam e o que não se toca.
- **Vai começar uma sessão com IA?** O Claude e o Codex já leem isso sozinhos pelo `CLAUDE.md` e `AGENTS.md` da raiz. Se a tarefa for de uma área só, mande o nome da nota junto.
- **Levou uma rasteira?** Escreva em `30 Armadilhas`. É a pasta que mais economiza tempo com o passar dos meses.
- **Decidiu algo de produto?** `40 Decisões`. Serve pra IA não sugerir aquilo que você já descartou.

## O caminho curto

| Quero… | Vá para |
| --- | --- |
| Entender como o sistema é montado | [[10 Mapa do sistema]] |
| Rodar, testar, publicar sem quebrar | [[11 Como rodar e verificar]] |
| Saber o que as palavras do produto significam | [[12 Glossário do produto]] |
| Pedir bem uma tarefa pro Claude ou pro Codex | [[13 Como pedir pra IA]] |
| Ver todas as rotas, modelos, comandos | [[Retrato do projeto]] |

## Domínios

O produto tem oito áreas vivas. Cada uma tem dono no código:

- [[Seu Mapa]] — a leitura do criador; a raiz de quase tudo
- [[Pautas e Roteiros]] — o que o criador grava
- [[Collabs]] — o encontro entre criadores
- [[Relatório Semanal]] — a consultoria virando documento
- [[Classificação de conteúdo]] — como cada post ganha rótulo
- [[Instagram e métricas]] — de onde vêm os números
- [[Landing e conversão]] — a porta de entrada e a cobrança
- [[MCP — ChatGPT e Claude]] — a Data2Content dentro de outros chats
- [[Mídia Kit e Publis]] — a monetização
- [[Filas e rotinas]] — o que roda sem ninguém olhando

## Manutenção

A pasta `90 Inventário` é **gerada por script**. Nunca edite à mão:

```bash
npm run brain
```

Rode isso quando criar rota, modelo, comando ou variável de ambiente nova. Leva menos de dez segundos e evita que o cérebro comece a mentir.
