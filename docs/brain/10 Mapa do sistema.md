---
tipo: fundação
---

# 10 — Mapa do sistema

## Em uma frase

Um único projeto Next.js que é, ao mesmo tempo, o site público, o aplicativo do criador, o painel de administração e a API — com MongoDB atrás e trabalho pesado empurrado pra fila.

## A pilha

| Peça | Versão | Papel |
| --- | --- | --- |
| Next.js (App Router) | 15.5 | Telas **e** back-end no mesmo repositório |
| React | 18.3 | Interface |
| TypeScript | 5.8 | Tipagem |
| Tailwind | 3.4 | Estilo |
| Mongoose / MongoDB | 7.6 | Banco de dados |
| NextAuth | 4.24 | Login (Google + Facebook/Instagram) |
| Stripe | 18.4 | Assinaturas e repasse de afiliados |
| QStash (Upstash) | — | Fila de trabalhos pesados |
| Node | 22.x | Exigido pelo `engines` do projeto |

Publicado na **Vercel**. Arquivos grandes (vídeo, capa) vão pro **R2 da Cloudflare**.

## As quatro superfícies

O mesmo banco de dados aparece de quatro jeitos diferentes. Confundi-los é a causa mais comum de retrabalho.

### 1. Site público
Mora em `src/app/page.tsx`, que renderiza `NarrativeLandingPage` (`src/app/landing/`). É a landing de verdade — qualquer componente de landing fora dessa pasta é código morto. Ver [[Landing e conversão]].

### 2. Aplicativo no computador — os *boards*
`src/app/dashboard/` e `src/app/(dashboard)/`. A home é um mural de blocos que o criador prende e desprende; o cadastro deles está em `src/app/dashboard/boards/boardRegistry.ts` (Seu Mapa, Collabs, Campanhas, Reuniões gravadas, Descobrir, Perfil, Mídia Kit, Afiliados, Criação de post).

### 3. Aplicativo no celular — a casca única
`src/app/dashboard/boards/mobile-strategic-profile/`. O `src/middleware.ts` detecta celular pelo navegador e redireciona `/dashboard` pra essa rota. É uma experiência separada, não uma versão estreita da de computador — e ela **proíbe guardar coisas no navegador** por design (ver [[Vídeo não pode guardar nada no navegador]]).

### 4. Dentro de outros chats — o MCP
`src/app/lib/mcp/` + `/api/mcp`. Permite que o ChatGPT e o Claude conversem com a inteligência da Data2Content. Ver [[MCP — ChatGPT e Claude]].

## As camadas do código

```
src/app/**/page.tsx        telas
src/app/**/components      pedaços de tela
src/app/api/**/route.ts    a API (419 endereços)
src/app/lib/**             a inteligência: regras, IA, integrações
src/app/models/**          o banco (80 modelos Mongoose)
src/app/dashboard/boards/  o coração do produto no computador
scripts/**                 tarefas de linha de comando e migrações
docs/brain/                este cérebro
```

Regra que se repete: **a rota de API não pensa**. Ela confere quem é o usuário, chama um serviço em `lib/` e devolve. Quem pensa é o serviço. Quando encontrar regra de negócio dentro de um `route.ts`, isso é dívida, não padrão.

## Onde a IA acontece

- `src/app/lib/llm/` — o núcleo que não sabe de quem é o modelo. Escolhe o provedor por variável de ambiente (`LLM_PROVIDER_<ESCOPO>`, senão `LLM_PROVIDER`) e cai no outro se o primeiro falhar.
- Alguns escopos já nascem no Gemini por serem mais baratos: `MAPA`, `SCRIPTS`, `COMMUNITY`, `CLASSIFICATION`. O resto continua no OpenAI.
- `src/app/lib/ai/`, `aiOrchestrator.ts`, `classification*.ts` — os usos concretos.

Antes de trocar modelo ou prompt, leia [[Custo de IA é decisão de arquitetura]].

## O que sai da requisição

Nada pesado roda enquanto o usuário espera:

- **Fila (QStash)** → `/api/worker/*` — classificar conteúdo, enriquecer o mapa com vídeo, atualizar dados do Instagram.
- **Relógio (cron)** → `/api/cron/*` — fechar a semana, mandar WhatsApp, expirar teste grátis, amadurecer comissão de afiliado.

Lista completa e sempre atual: [[Trabalhos em fundo]].

## Ligações

[[11 Como rodar e verificar]] · [[12 Glossário do produto]] · [[Retrato do projeto]]
