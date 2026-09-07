---
tipo: armadilha
---

# Script com `tsx` não enxerga import nomeado do mongoose

## O sintoma

Você escreve um script em `scripts/`, importa qualquer coisa do núcleo do
aplicativo, roda com `tsx --env-file=.env.local` e o Node morre antes da primeira
linha do seu código:

```
SyntaxError: The requested module 'mongoose' does not provide an export named 'models'
```

O arquivo culpado nunca é o seu — é um modelo em `src/app/models/` que você nem
sabia que estava na corrente de imports.

## Por que acontece

O `package.json` declara `"type": "module"`, então tudo que o `tsx` roda é ESM. O
mongoose é CommonJS. Para deixar `import { X } from "mongoose"` funcionar, o Node
tenta adivinhar os nomes exportados lendo o código do pacote — e acerta uns
(`Schema`, `Types`, `model`, `STATES`) e erra outros (`models`, `ConnectionStates`).

No Next isso nunca aparece: o webpack resolve CJS por conta própria. O erro só
existe fora do build — ou seja, exatamente nos scripts.

Note a ironia: `model` passa e `models` não. Um `s` separa o script que roda do
script que nem carrega.

## O que fazer

Nos modelos, sempre pela raiz:

```ts
import mongoose, { Schema, type Document } from "mongoose";
const Foo = (mongoose.models.Foo || mongoose.model<IFoo>("Foo", FooSchema)) as mongoose.Model<IFoo>;
```

Tipo puro (`PipelineStage`, `FilterQuery`, `HydratedDocument`) pode ficar no import
nomeado, desde que marcado com `type` — assim o esbuild apaga antes de o Node ver.

Em 07/09/2026 os 19 modelos que ainda usavam `import { models }` e o
`dataService/connection.ts` (que usava `ConnectionStates`) foram convertidos. Se
alguém criar um modelo novo copiando um antigo de outro projeto, a rasteira volta.

## Como conferir sem esperar quebrar

Qualquer script que importe o núcleo serve de canário. O mais barato hoje é
`npm run smoke:mcp-admin-portfolio`, que puxa `catalog.ts` inteiro e, por tabela,
metade do `dataService`.

Ligações: [[Build antes do push]] · [[Import que arrasta o servidor pro cliente]]
