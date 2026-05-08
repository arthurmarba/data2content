# Brand Narrative MVP - Release Readiness

## Resumo executivo

Este MVP permite que a D2C sugira marcas observadas externamente a partir da pauta escolhida no funil e gere um relatório público compartilhável para o creator enviar manualmente. As marcas não são parceiras, não estão cadastradas e não representam campanhas ativas. O relatório deve ser tratado como material exploratório de match narrativo, sem promessa de aceite, validação ou relacionamento comercial com a marca.

## 1. O que foi implementado

- Base inicial de marcas observadas externamente, com perfis narrativos curados via seed.
- Motor backend de match narrativo entre pauta, sinais de conteúdo e marcas observadas.
- Endpoint privado de match em `POST /api/brand-narratives/match`.
- Painel de marcas sugeridas integrado na etapa final do funil de criação.
- Modelo e endpoint privado para gerar relatórios públicos de match narrativo.
- Endpoint público em `GET /api/brand-narratives/reports/[slug]`.
- Página pública compartilhável em `/brand-report/[slug]`.
- Proteções de MVP: `noindex/nofollow`, remoção de dados sensíveis, loading por marca, proteção contra duplo clique e fallback para popup bloqueado.

## 2. O que não foi implementado

- PDF.
- Envio automático para marca.
- Cadastro público de marca.
- Ação comercial ativa.
- Parceria com marcas.
- Tela admin.
- Aceite da marca.
- Validação da marca sobre o relatório.
- Tracking de abertura do relatório pela marca.
- Privacidade forte por autenticação no relatório público.
- Curadoria admin visual.

## 3. Variáveis de ambiente

- `NEXT_PUBLIC_APP_URL`: recomendada em produção. Deve apontar para a URL pública do app para gerar links corretos em `/brand-report/[slug]`.
- `APP_URL`: fallback server-side, se usado no ambiente.
- `NEXTAUTH_URL`: fallback para URL base quando `NEXT_PUBLIC_APP_URL` e `APP_URL` não estiverem definidos.
- `NEXT_PUBLIC_POST_CREATION_BRAND_MATCHES_ENABLED`: use `0` para desligar o painel de marcas sugeridas no funil.

Em produção, configure `NEXT_PUBLIC_APP_URL` explicitamente. Sem ela, os links públicos podem herdar outro fallback de URL e ficar incorretos.

## 4. Comandos de produção

```bash
npm run typecheck
npm run ensure-indexes
npm run seed:brand-narratives:dry-run
npm run seed:brand-narratives
npm run smoke:brand-narratives -- --skip-report
```

Para diagnóstico com criação explícita de relatório:

```bash
BRAND_NARRATIVE_SMOKE_USER_ID=<user_id> npm run smoke:brand-narratives
```

## 5. Ordem segura de deploy

1. Garantir envs.
2. Rodar `npm run typecheck`.
3. Rodar `npm run ensure-indexes`.
4. Rodar `npm run seed:brand-narratives:dry-run`.
5. Avaliar resultado do dry-run.
6. Só rodar `npm run seed:brand-narratives` se houver intenção explícita de criar ou atualizar a base.
7. Rodar `npm run smoke:brand-narratives -- --skip-report`.
8. Validar UI do funil.
9. Gerar relatório em usuário de teste.
10. Validar página `/brand-report/[slug]`.
11. Liberar feature flag.

## 6. Quando NÃO rodar o seed real

- Se a base já foi curada manualmente.
- Se o dry-run mostra muitas atualizações inesperadas.
- Se há dúvidas sobre sobrescrever campos narrativos.
- Em produção, preferir dry-run primeiro e revisar o diff ou a contagem.
- O seed real pode atualizar marcas `manual_seed`; usar com cuidado.

## 7. Feature flag e rollback rápido

- `NEXT_PUBLIC_POST_CREATION_BRAND_MATCHES_ENABLED=0` desliga o painel de marcas sugeridas no funil.
- Desligar a flag não remove relatórios já criados.
- Relatórios públicos existentes continuam acessíveis por link direto.
- Para bloquear relatório específico, será necessário alterar o status para `archived` no banco.
- Se houver problema grave, desligar a flag, investigar logs e arquivar relatórios problemáticos.

## 8. Validação manual obrigatória

- Entrar com usuário creator.
- Avançar funil até pauta.
- Confirmar bloco de marcas sugeridas.
- Confirmar disclaimer.
- Clicar em Abrir relatório.
- Confirmar abertura em nova aba.
- Confirmar que a página pública não mostra `userId`, IDs internos ou dados sensíveis.
- Confirmar `noindex/nofollow`.
- Confirmar copy sem prometer parceria.
- Testar mobile.
- Testar sem evidências orgânicas suficientes.

## 9. Critérios de aceite de produção

- Painel carrega sem bloquear funil.
- Endpoint de match responde.
- Relatório é criado.
- Página pública abre.
- Link público correto usa `NEXT_PUBLIC_APP_URL`.
- Disclaimer aparece no painel e no relatório.
- Não há copy de parceria ou campanha ativa.
- `noindex/nofollow` ativo.
- Smoke passa.

## 10. Checklist de deploy

- Configurar `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` e demais envs de banco/autenticação.
- Confirmar se `NEXT_PUBLIC_POST_CREATION_BRAND_MATCHES_ENABLED` deve ficar ligado ou `0`.
- Seguir a ordem segura de deploy deste documento.
- Validar manualmente o funil na UI com o painel ligado.
- Gerar um relatório em ambiente controlado e validar `/brand-report/[slug]`.
- Validar que a página pública segue com `noindex/nofollow`.

## 11. Riscos e pontos de atenção

- O relatório público é acessível por link direto.
- Relatórios públicos podem ser encaminhados fora do controle do creator.
- `noindex/nofollow` reduz indexação, mas não é controle forte de privacidade.
- `noindex` não impede acesso por link.
- As marcas são observadas externamente, não parceiras comerciais.
- Marcas podem interpretar o relatório como abordagem comercial, então a copy precisa ser cuidadosa.
- Falsos positivos de match podem acontecer até haver curadoria admin.
- A seed deve passar por curadoria futura conforme o uso real trouxer falsos positivos ou lacunas.
- Necessário monitorar marcas sugeridas e relatórios gerados nas primeiras semanas.
- Testes antigos do repo podem falhar fora do escopo deste MVP; registrar separadamente quando isso acontecer.

## 12. Próximos passos recomendados

1. Painel admin de marcas observadas.
2. Curadoria humana dos territórios narrativos.
3. PDF do relatório.
4. Tracking de abertura ou cliques do relatório.
5. Opção de arquivar relatório pela interface.
6. Futuro cadastro de marcas.
