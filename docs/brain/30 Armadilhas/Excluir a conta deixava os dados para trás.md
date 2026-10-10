---
tipo: armadilha
custo: dados de 48 contas excluídas guardados sem dono, contra o que a política de privacidade promete
---

# Excluir a conta deixava os dados para trás

## O sintoma

Na análise de uso do conector de 09/10/2026, uma das "contas conectadas" não existia mais.
Puxando o fio: `/api/account/delete` apagava só o documento `User`. Não há cascata no modelo.
Ficavam para trás posts, números, mapa, roteiros, conversas, mídia kit, propostas de marca,
collabs, a conexão do conector e os registros de uso, ligados a um id que não existe mais.

O ensaio de 09/10 achou 48 contas excluídas com dado no banco: 8.170 retratos diários de
posts, 1.688 posts, 1.608 dias de números da conta, 1.419 visitas ao mídia kit e mais umas
trinta coleções menores.

A política de privacidade diz que, ao excluir a conta, os dados pessoais são eliminados.

## O conserto (09/10/2026)

- **Na hora, na transação:** a conta, os dados do conector (`lib/mcp/accountDeletion.ts`) e o
  nome nos relatórios da comunidade já fechados (`highlightWinners` vira "Criador removido").
- **Na fila:** todo o resto, por `/api/worker/delete-account-data`, que chama
  `deleteAccountData` (`lib/account/accountDataDeletion.ts`). Uma conta antiga tem dezenas de
  milhares de retratos diários; não cabe na transação. O worker recusa conta que ainda existe.
- **O que já tinha ficado:** `scripts/accountDataOrphans.ts`, que só conta sem `--apply`.

## Três rasteiras no caminho

**O dono aparece de dois jeitos.** Algumas coleções guardam o id como ObjectId, outras como
texto (`contentideaquotas`, `gemini_operations`). O filtro procura os dois.

**Tem dado que só se acha pelo pai.** Retratos diários e estado de leitura são do post, não
da conta; mensagens são da conversa. Saem antes do pai, enquanto ainda dá para achá-los.
O estado de leitura usa o id do post como texto e tem duas chaves próprias da conta
(`dna:<id>`, `mapa:instagram:<id>`).

**O R2 não deixa listar a pasta.** A chave de acesso pode apagar, mas não listar. O nome de
cada capa de análise sai do `diagnosisId` das análises de vídeo, por isso as capas saem
antes das análises.

## A regra

Coleção nova com dono entra em `ACCOUNT_DATA_RULES` ou em `ACCOUNT_DATA_KEPT`.
`accountDataCoverage.test.ts` lê todos os modelos e falha se um campo que aponta para uma
conta ficar sem destino. Coleção sem modelo não aparece no teste: entra na lista à mão.

Ver [[Exclusão de conta apaga tudo que é só dela]] e [[MCP — ChatGPT e Claude]].
