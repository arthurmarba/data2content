# Data2Content — instruções do projeto

Leia isto antes de mexer em qualquer coisa. Este arquivo é curto de propósito; o conhecimento de verdade está no cérebro.

## O cérebro do projeto

`docs/brain/` — notas escritas à mão sobre como o sistema funciona, o que já deu errado e o que já foi decidido.

**Comece por `docs/brain/00 Comece por aqui.md`.** Antes de mexer numa área, abra a nota dela em `docs/brain/20 Domínios/`. Antes de investigar um bug estranho, dê uma olhada em `docs/brain/30 Armadilhas/` — a resposta pode já estar lá.

`docs/brain/90 Inventário/` é gerado por script (`npm run brain`): rotas, modelos, comandos, variáveis de ambiente, trabalhos em fundo. Não edite à mão.

## O que é este projeto

Next.js 15 (App Router) + React 18 + TypeScript + MongoDB (Mongoose) + NextAuth + Stripe, publicado na Vercel. Front e back no mesmo repositório: cada `src/app/api/**/route.ts` é um endereço da API.

Quatro superfícies sobre o mesmo banco: **site público** (`src/app/landing/`), **aplicativo no computador** (`src/app/dashboard/boards/`), **aplicativo no celular** (`boards/mobile-strategic-profile/`, para onde o middleware redireciona) e **MCP** (`src/app/lib/mcp/`, a Data2Content dentro do ChatGPT e do Claude).

Idioma: **tudo em português** — código de interface, texto, commits, comentários.

## Regras da casa

1. **`npm run build` antes de empurrar.** `npm test` não confere tipo; dá pra ter a suíte verde e a Vercel quebrada.
2. **Rota de API não pensa.** Ela confere o usuário, chama um serviço em `src/app/lib/` e devolve. Regra de negócio dentro de `route.ts` é dívida, não padrão.
3. **Se demora, vai pra fila.** Trabalho pesado é `/api/worker/*` (QStash) ou `/api/cron/*` (relógio) — nunca dentro da requisição do usuário.
4. **Variável nova entra no `.env.local` e na Vercel no mesmo dia.** Senão a funcionalidade some em produção, geralmente com 403.
5. **Comando com `--env-file=.env.local` fala com o banco real.** Leia o arquivo antes; prefira `--dry-run` quando existir.
6. **Prompt não se muda no escuro.** Para roteiros, `npm run check:scripts-quality` roda testes e benchmark.
7. **Antes de concluir que algo não existe**, procure em outras branches — já houve funcionalidade pronta parada fora do `main`.

## Onde colocar coisa nova

O projeto tem casas duplicadas por motivos históricos. Estas são as vivas — use-as e não alimente as outras:

| O que | Vai em | Não vai em |
| --- | --- | --- |
| Modelo de banco | `src/app/models/` (78 lá) | `src/server/db/models/` (só 3, legado) |
| Serviço, regra de negócio | `src/app/lib/<domínio>/` (120 lá) | `src/lib/` (24, legado) |
| Script de linha de comando | `scripts/` na raiz (95 lá) | `src/scripts/` (2, legado) |
| Rota de API | `src/app/api/<grupo>/route.ts` | dentro de pasta de tela |
| Documento de planejamento | `docs/` | **nunca** junto do código |

Duas observações sobre pastas que confundem:

- **`src/app/(dashboard)/`** não é um painel paralelo: são cascas finas que dão um endereço curto (`/media-kit`, `/campaigns`) conferindo a sessão e renderizando a tela real, implementada em `src/app/dashboard/`. Tela nova se implementa em `dashboard/`; a casca é opcional.
- **`src/app/dashboard/boards/videoUpload/`** é uma gaveta de bagunça de 169 arquivos: guarda collabs, pautas e audiência além de vídeo. Procure lá quando não achar. Código novo desses assuntos não precisa ir pra lá só porque os vizinhos estão. Ver `docs/brain/30 Armadilhas/A pasta videoUpload é uma gaveta de bagunça.md`.

Antes de criar documento em `docs/`, acrescente uma linha no `docs/README.md` — é o índice dos 122 que já existem.

## Vocabulário que não se troca

**asset → território → narrativa → pauta.** Asset é elemento de vida, não credencial. Território é substantivo. Narrativa é tensão ou missão. Pauta só nasce de narrativa + território — audiência sozinha não libera. Detalhes em `docs/brain/12 Glossário do produto.md`.

## Ao terminar uma tarefa

Se aprendeu algo que vale daqui a três meses, escreva no cérebro: rasteira em `30 Armadilhas`, decisão de produto em `40 Decisões`, mudança de forma na nota do domínio. Se criou rota, modelo ou comando, rode `npm run brain`.

## Como falar com o Arthur

Plano e resumo em **linguagem de leigo**; detalhe técnico em seção separada, quando for necessário. Piada não se explica.
