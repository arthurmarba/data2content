# Índice de `docs/`

São 122 documentos acumulados ao longo de dois anos. Sem um mapa, isso é um sótão: ninguém sabe o que está valendo e o que é história. Este arquivo é o mapa.

## Antes de mais nada: `docs/` não é o cérebro

| | `docs/brain/` | o resto de `docs/` |
| --- | --- | --- |
| Responde | **como o sistema é hoje** | **como chegamos aqui**, e o que se planejou |
| Serve para | trabalhar agora | consultar o histórico e a intenção original |
| Mantido | sim, ativamente | não — é registro |

**Para entender o sistema, comece por [`brain/00 Comece por aqui.md`](brain/00%20Comece%20por%20aqui.md).** Volte aqui quando precisar saber *por que* alguma coisa foi feita daquele jeito.

> A data ao lado de cada documento é a do último commit que o tocou. Recente não quer dizer certo — quer dizer que alguém olhou faz pouco tempo. É o melhor sinal disponível, não uma garantia.

---

## O que está quente (mexido desde agosto de 2026)

| Documento | Data | Sobre |
| --- | --- | --- |
| `brain/40 Decisões/Histórico diário conserva oito meses e uma referência.md` | 09/2026 | Retenção aprovada de snapshots, preservação de conteúdo e expiração de PDFs |
| `auditoria-mongodb-armazenamento-2026-09-07.md` · `brain/30 Armadilhas/Expiração declarada não garante limpeza no MongoDB.md` | 09/2026 | Volume real do Atlas, PDFs vencidos, dados órfãos e cenários de retenção; avaliação sem exclusões |
| `radar-coleta-gratuita-operacao.md` | 09/2026 | Implementação, operação administrativa, coleta sem APIs pagas e próximos passos |
| `radar-varredura-2026-09-07.md` | 09/2026 | Varredura manual de 07/09: o que está aberto hoje, squads de marca e origens novas |
| `radar-fontes-verificadas.md` | 09/2026 | Catálogo das origens já conferidas: o que rende, o que é vitrine, eventos e falsos positivos |
| `plano-roteiros-baseados-em-conteudos-vencedores.md` | 09/2026 | Auditoria e plano: seleção de vencedores, fala real, geração no MCP, qualidade e custo |
| `plano-gerador-gancho-video.md` | 09/2026 | Gerador de gancho para vídeo |
| `plano-ajuste-inteligente-roteiro-video.md` | 09/2026 | Ajuste de roteiro a partir do vídeo |
| `mcp-data2content.md` | 09/2026 | O MCP — a referência principal |
| `chatgpt-plugin-v1.md` · `-submission.md` · `-funnel-release-checklist.md` | 09/2026 | O plugin do ChatGPT e a submissão |
| `campaign-radar-report-mvp.md` · `-source-compliance-audit.md` | 09/2026 | Radar de campanhas e a conformidade das fontes |
| `mcp-admin-delivery-scope.md` | 08/2026 | O MCP administrativo, só leitura |
| `script-intelligence-v3.md` | 09/2026 | Evidência compartilhada, escrita no cliente/interna e operação; publicação deve ser confirmada |
| `plano-topo-relatorio-enxuto.md` | 08/2026 | Enxugamento do topo do relatório |
| `plano-perfil-padroes-na-capa.md` | 08/2026 | Padrões por evidência na capa do perfil |
| `plano-oferta-pos-narrativa.md` | 08/2026 | A oferta depois da narrativa |

---

## Por assunto

### Produto e jornada do criador
`product-jornada-criador.md` (06/26) · `user-journey-criador.md` (05/26) · `dev-roadmap-jornada-criador.md` (06/26) · `qa-jornada-criador.md` (05/26) · `audience-asset-resultado.md` (05/26) · `content-potential-scan.md` (07/26)

### Landing, oferta e paywall
`landing-fase-0-oferta.md` · `landing-fase-1-narrativa.md` · `landing-fase-2-reuniao.md` (07/26) · `funil-reuniao.md` (07/26) · `fase-b-paywall-implementation.md` (05/26) · `plano-oferta-pos-narrativa.md` (08/26)

> A landing foi reescrita várias vezes desde então. Para a que está no ar, veja `brain/20 Domínios/Landing e conversão.md`.

### Cobrança, afiliados e preço
`pricing-migration-2026.md` (07/26) · `stripe-multimoeda-release.md` (07/26) · `billing-checklist.md` (12/25) · `qa-payments-affiliates.md` (07/26) · `affiliates.md` (07/26) · `affiliates-observability-runbook.md` (08/25) · `cpm-lifecycle.md` (11/25)

### MCP, ChatGPT e Claude
`mcp-data2content.md` (09/26) · `mcp-admin-delivery-scope.md` (08/26) · `chatgpt-plugin-v1.md` · `chatgpt-plugin-submission.md` · `chatgpt-plugin-funnel-release-checklist.md` (09/26)

> Análise administrativa de toda a base de criadores: `brain/20 Domínios/MCP — ChatGPT e Claude.md`. Saldo de seguidores por dia e por conteúdo: `brain/20 Domínios/Seguidores.md`. Script `tsx` que morre antes de rodar: `brain/30 Armadilhas/Script com tsx não enxerga import nomeado do mongoose.md`. Cobertura que cobra dado impossível: `brain/30 Armadilhas/Cobertura que cobra o impossível.md`.

### Roteiros, pautas e ganchos
`script-intelligence-v3.md` (08/26) · `scripts-intelligence-rollout.md` (02/26) · `plano-gerador-gancho-video.md` · `plano-ajuste-inteligente-roteiro-video.md` (09/26) · `plano-perfil-padroes-na-capa.md` (08/26) · `post-creation/` (funil de criação de post)

### Relatórios e narrativa de marca
`plano-topo-relatorio-enxuto.md` (08/26) · `strategic-report-mvp.md` · `strategic-report-integration.md` (09/25) · `brand-narrative-mvp-release.md` (05/26)

### Classificação e taxonomia
`plano-taxonomia-categorias-v2.md` · `plano-taxonomia-categorias-v2-5.md` · `plano-implementacao-taxonomia-v2-5.md` (03/26) · `classification-canonical-rollout.md` · `classification-canonical-pr-deploy-checklist.md` (03/26)

> As três versões da taxonomia convivem no código. Ver `brain/20 Domínios/Classificação de conteúdo.md`.

### Campanhas, publis e propostas
`campaign-radar-report-mvp.md` · `campaign-radar-source-compliance-audit.md` (09/26) · `campaign-briefing.md` (11/25) · `proposals-playbook.md` (07/26) · `ranking-expansion.md` (07/25) · `qa-ranking-table.md` (08/25)

### Instagram
`instagram-map-enrichment-audit.md` (06/26) · `instagram-reconnect-rollout-checklist.md` (02/26)

### IA: provedor e custo
`llm-provider-migration-plan.md` (06/26) · `plano-de-otimizacao-estrategica-v3.md` · `-v4.md` (07/25)

> Falha de saldo do Gemini e recuperação das leituras: `brain/30 Armadilhas/Crédito do Gemini paralisa a leitura publicada.md`.

### Interface e design
`mobile-design-system.md` (07/26) · `design-tokens.md` (11/25) · `dashboard/plano-boards-ui-v2.md` (04/26) · `dashboard/etapa2|5|6-checklist.md` (11/25) · `navigation/etapa1-*.md` (11–12/25) · `home-tutorial-playbook.md` (11/25) · `MM90_MOBILE_UX_SIMPLIFICATION_PASS.md` (05/26) · `mobile-strategic-profile-performance-report.md` (07/26)

### Collabs
`brief-collabs-gamificada-fable.md` · `brief-collab-justificativa-remoto-fable.md` (07/26)

### Operação e infraestrutura
`cron-management.md` (11/25) · `monitoring-observability.md` (07/25) · `plan-guard.md` (08/25) · `state-transitions.md` (07/25) · `next-15-controlled-upgrade.md` (07/26) · `sales-tutorial-automation.md` (03/26) · `whatsapp-weekly-templates.md` (05/26)

### Medição
`analytics/event-catalog.md` · `analytics/stage-0-qa.md` (07/26) · `analytics/alerts.md` · `analytics/feature-flags.md` · `analytics/lgpd-checklist.md` (11/25) · `google-analytics-measurement-plan.md` (07/26)

---

## Pastas

| Pasta | O que é |
| --- | --- |
| `brain/` | **O cérebro do projeto.** Como o sistema é hoje. Comece por aqui. |
| `video-narrativa/` | O arco de leitura de vídeo e perfil no celular (série `MM74`–`MM91`). Veio de dentro do código em 09/2026. |
| `post-creation/` | O funil de criação de post. Veio de dentro do código em 09/2026. |
| `agent-skills/` | Direção de produto e de interface para agentes |
| `analytics/` | Catálogo de eventos, alertas, LGPD |
| `dashboard/` · `navigation/` | Etapas de construção da interface (2025–abr/2026) |
| `meta-review/` | Material para a revisão da Meta |
| `prototipos/` | Protótipo em HTML do perfil no celular (v9) |
| `trading/` | **Nada a ver com a Data2Content** — scripts de backtest de cripto em Pine Script. Um projeto pessoal que acabou morando aqui. |

---

## Regra daqui pra frente

Documento de planejamento mora em `docs/`, **nunca junto do código**. A única exceção são os doze contratos em `boards/videoUpload/` que os testes leem — esses são contrato executável, não planejamento.

Ao criar documento novo, acrescente uma linha aqui. Um sótão só continua sendo arquivo enquanto alguém escreve no índice.
