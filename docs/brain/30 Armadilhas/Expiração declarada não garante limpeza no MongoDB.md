---
tipo: armadilha
área: banco de dados
---

# Expiração declarada não garante limpeza no MongoDB

Na auditoria de 07/09/2026, `MediaKitPdfCache` declarava TTL de `expiresAt`, mas o índice `expiresAt_1` existente no banco era comum, sem `expireAfterSeconds`. Resultado: 51 PDFs vencidos, 70,29 MB; a aplicação só os usa por 30 minutos. Havia PDFs vencidos desde fevereiro.

O modelo declarava `index: true` no campo e também um índice TTL para a mesma chave. Essa duplicidade é uma possível origem do conflito; a causa histórica não foi comprovada. **Confirme `listIndexes()` no ambiente real.** Um schema declarando TTL não comprova expiração em produção. Converter um índice existente para TTL dispara exclusões e deve fazer parte de uma limpeza autorizada.

Após a avaliação, Arthur autorizou a limpeza em 07/09/2026: os 51 PDFs vencidos foram apagados e `expiresAt_1` foi convertido com `collMod`, confirmando `expireAfterSeconds: 0` no banco real. A declaração simples duplicada foi removida no código local (sem publicação da aplicação nessa tarefa). A retenção de snapshots seguiu [[Histórico diário conserva oito meses e uma referência]].

O mesmo tipo de divergência foi observado em `StrategicReport` e `Thread`. O TTL de `Thread` é parcial: só conversas não favoritas, pela última atividade. O TTL de `PlannerRecCache` é opcional por variável, portanto sua ausência não comprova defeito.

Outro motivo para sobras: `/api/account/delete` apaga apenas `User`; `/api/auth/delete-user-data` apaga `Metric` antes de obter seus IDs para apagar snapshots. O serviço `deleteUserAccountAndAssociatedData` tem a ordem correta, mas cobre só parte dos modelos atuais. Não reutilizar essas rotas como ferramenta de limpeza em massa sem mapear relações e revisar as proteções financeiras.

Não confundir último acesso ausente com abandono: a cobertura de `lastActiveAt`/`lastLoginAt` é incompleta e `updatedAt` também muda por jobs. Não confundir `planStatus != active` com ausência de acesso ou de obrigações financeiras.

Detalhes e evidências: [auditoria de armazenamento](../../auditoria-mongodb-armazenamento-2026-09-07.md). Recomendações de retenção nessa avaliação são cenários, não uma política já adotada.
