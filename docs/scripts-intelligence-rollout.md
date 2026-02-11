# Rollout da Flag `scripts_intelligence_v2`

A inteligência v2 do roteirista pode ser ativada por ambiente sem breaking changes.

## Comando rápido (via script)

```bash
npm run flag:scripts-intelligence:v2 -- --env=staging --enabled=true
```

## Comandos úteis

Ativar em `development`:

```bash
npm run flag:scripts-intelligence:v2 -- --env=development --enabled=true
```

Ativar em `staging`:

```bash
npm run flag:scripts-intelligence:v2 -- --env=staging --enabled=true
```

Desativar em `production`:

```bash
npm run flag:scripts-intelligence:v2 -- --env=production --enabled=false
```

Ajustar valor default global (fallback quando ambiente não estiver definido):

```bash
npm run flag:scripts-intelligence:v2 -- --default=false
```

## Alternativa via API interna

Endpoint: `PATCH /api/feature-flags`

Payload exemplo:

```json
{
  "key": "scripts_intelligence_v2",
  "env": "staging",
  "enabled": true,
  "description": "Rollout do roteirista inteligente por narrativa + DNA do criador"
}
```

Requer sessão com role `admin`, `internal` ou `staff`.
