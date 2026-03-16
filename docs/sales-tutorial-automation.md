# Sales tutorial automation

Este fluxo gera um pacote de video comercial da plataforma com:

- gravacao automatica da tela via Playwright
- roteiro comercial em markdown
- legendas em VTT
- narracao em MP3 via OpenAI TTS quando `OPENAI_API_KEY` estiver disponivel
- MP4 final com audio se `ffmpeg` estiver instalado

## Comando

```bash
npm run sales:tutorial
```

Saida padrao:

```text
tmp/sales-tutorials/<timestamp>/
```

Arquivos gerados:

- `screen-recording.webm`
- `tutorial-script.md`
- `captions.vtt`
- `tutorial-manifest.json`
- `narration.mp3` quando TTS estiver habilitado
- `sales-tutorial.mp4` quando TTS e `ffmpeg` estiverem disponiveis

## Modos

### 1. Landing publica

```bash
npm run sales:tutorial -- --mode=landing
```

Grava so a home publica e funciona sem login.

### 2. Plataforma autenticada

```bash
npm run sales:tutorial -- --mode=platform --storage-state=playwright/.auth/user.json
```

Mostra dashboard, midia kit, radar comercial, planner e calculadora.
Se o `storageState` nao existir, o comando falha para evitar um video errado.

### 3. Video comercial completo

```bash
npm run sales:tutorial -- --mode=sales --storage-state=playwright/.auth/user.json
```

Combina landing publica com tour do produto autenticado. Se o `storageState` nao existir, o fluxo cai automaticamente para `landing`.

## Flags uteis

```bash
npm run sales:tutorial -- --start-server
npm run sales:tutorial -- --voice=ash
npm run sales:tutorial -- --skip-tts
npm run sales:tutorial -- --skip-merge
npm run sales:tutorial -- --headed
```

## Pre requisitos

- Aplicacao rodando localmente em `http://127.0.0.1:3000`, ou use `--start-server`
- Chromium do Playwright instalado
- `OPENAI_API_KEY` para gerar narracao
- `ffmpeg` para entregar um unico MP4 narrado

## Sessao autenticada

Para gravar telas reais da plataforma, gere o storage state antes:

```bash
npx playwright codegen http://127.0.0.1:3000 --save-storage=playwright/.auth/user.json
```

Depois disso, faca o login manual na janela do Playwright e feche o navegador.

### Geracao automatica de storage states

Tambem existe um script proprio para gerar as sessoes usadas no tutorial:

```bash
npm run sales:tutorial:auth -- --profile=user
npm run sales:tutorial:auth -- --profile=admin
npm run sales:tutorial:auth -- --profile=livia
```

Ou para gerar admin e Livia em uma passada:

```bash
npm run sales:tutorial:auth -- --all
```

Arquivos esperados:

- `playwright/.auth/user.json`
- `playwright/.auth/admin.json`
- `playwright/.auth/livia-linhares.json`

Variaveis usadas pelo script:

- `E2E_EMAIL` / `E2E_PASSWORD` para `user`
- `TUTORIAL_ADMIN_EMAIL` / `TUTORIAL_ADMIN_PASSWORD` para `admin`
- `TUTORIAL_LIVIA_EMAIL` / `TUTORIAL_LIVIA_PASSWORD` para `livia`

Se preferir, voce tambem pode passar credenciais manualmente:

```bash
npm run sales:tutorial:auth -- \
  --profile=custom \
  --email=criador@exemplo.com \
  --password='senha-aqui' \
  --output=playwright/.auth/criador.json
```

### Sessoes dedicadas por etapa

O tutorial comercial agora aceita sessao dedicada para campanhas e publis:

```bash
npm run sales:tutorial -- \
  --mode=sales \
  --storage-state=playwright/.auth/user.json \
  --campaigns-storage-state=playwright/.auth/admin.json \
  --publis-storage-state=playwright/.auth/livia-linhares.json
```

## Ajuste do roteiro

O storyboard fica em:

- `scripts/salesTutorial/storyboard.ts`

Se quiser deixar o video mais vendedor, ajuste apenas:

- `title`
- `narration`
- `scrollY`
- `focusText`
- `focusSelector`

Assim voce muda a historia comercial sem reescrever o mecanismo.
