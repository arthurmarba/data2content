---
tipo: fundação
---

# 13 — Como pedir pra IA neste projeto

Este projeto tem 2 mil arquivos de código e 419 endereços de API. Nenhuma IA lê isso tudo. O que separa uma sessão boa de uma ruim é **quanto contexto certo ela recebe nos primeiros trinta segundos**.

## O que já acontece sozinho

O `CLAUDE.md` e o `AGENTS.md` na raiz do projeto são lidos automaticamente no começo de cada sessão — pelo Claude e pelo Codex. Eles apontam pra cá. Você não precisa colar nada.

## O que ainda vale você dizer

**Nomeie o domínio.** "Mexa no Collabs" já vale muito mais que "mexa no app", porque manda a IA abrir a nota certa antes de sair procurando.

**Diga se é leitura ou escrita.** "Entenda como X funciona" e "mude X" pedem posturas diferentes. A segunda exige build antes do push.

**Passe o sintoma, não o diagnóstico.** "O card Sua Audiência trava em Processando" é melhor que "acho que o QStash caiu" — o diagnóstico errado leva a IA pro lugar errado com confiança.

## O que costuma dar errado aqui

- **Trabalho pronto e nunca enviado.** Sessões paralelas de Codex já deixaram funcionalidades inteiras fora do `origin/main`. Antes de investigar "por que esse campo está vazio no banco", confira se o código que preenche ele chegou a ser enviado. Ver [[Trabalho pronto e nunca enviado]].
- **Achar que produção é o `main`.** Já houve período em que os deploys saíam de outra branch. Ver [[Produção nem sempre é o main]].
- **Duas soluções paralelas pro mesmo problema.** O projeto tem sistemas irmãos vivendo lado a lado (dois caminhos de mapa, dois de landing). Antes de criar o terceiro, procure o segundo.

## Quando terminar

Se aprendeu algo que vai valer daqui a três meses, escreva no cérebro:

- Rasteira que custou tempo → `30 Armadilhas`
- Decisão de produto → `40 Decisões`
- Área que mudou de forma → a nota do domínio em `20 Domínios`

Se criou rota, modelo ou comando novo, rode `npm run brain`.

## Ligações

[[00 Comece por aqui]] · [[11 Como rodar e verificar]]
