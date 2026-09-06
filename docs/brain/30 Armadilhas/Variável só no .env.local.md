---
tipo: armadilha
custo: funcionalidade invisível em produção
---

# A variável existe só na sua máquina

## O que acontece

Funciona perfeitamente no seu computador. Em produção, a funcionalidade some — ou responde **403**, ou mostra uma tela vazia sem explicação.

## Por quê

O `.env.local` não vai pro repositório. Toda variável nova precisa ser cadastrada **também na Vercel**. As que ligam funcionalidade (`*_ENABLED`) são as que mais somem, porque o código simplesmente as trata como "desligado" quando não existem.

O caso clássico foi o envio de vídeo: as chaves `VIDEO_NARRATIVE_*`, do R2 e do Gemini viviam só no `.env.local`, e produção respondia 403.

## O que fazer

Ao criar variável nova, cadastre nos dois lugares **no mesmo dia**. Antes de dizer "está quebrado em produção", confira se a chave existe lá.

O inventário [[Variáveis de ambiente]] lista as que o código lê hoje.

## Ligações

[[11 Como rodar e verificar]] · [[Upload de vídeo dá 403]]
