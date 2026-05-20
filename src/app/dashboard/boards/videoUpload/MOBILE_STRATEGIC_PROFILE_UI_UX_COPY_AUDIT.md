# Mobile Strategic Profile UI/UX + Copy Audit

Auditoria MM73 da página principal app-first/mobile da Data2Content: o Perfil Estratégico que se atualiza como diagnóstico vivo do creator.

Decisão central de produto:

> O Perfil da D2C é o diagnóstico vivo do creator. Cada vídeo analisado atualiza esse perfil.

## 1. Resumo executivo

O Perfil Estratégico já comunica a direção principal do produto: ele funciona como casa mobile, usa identidade de creator no topo, mantém Diagnóstico e Comercial como abas internas, preserva Mídia Kit como bridge/modal e deixa Comunidade como destino existente.

A experiência está mais perto de app do que de relatório técnico, mas ainda tinha alguns sinais de linguagem interna em componentes que podem aparecer na casca real:

- CTA recorrente ainda dizia apenas "Analisar vídeo", o que podia parecer upload pontual, não atualização do Perfil.
- Mensagem de sucesso dizia "simulação", inadequada para a rota real.
- Modal de Mídia Kit ainda mencionava "preview" e "não conecta Instagram de verdade".
- Loading sem upload real dizia "Atualizando seu Perfil Estratégico", mais pesado que o necessário.

Este PR aplica ajustes pequenos e seguros de copy nesses pontos, sem mudar layout estrutural, endpoint, persistência, Gemini, upload, storage, cleanup, usage limits, Mídia Kit real, Comunidade real, navegação global, LoginClient, NextAuth ou billing.

## 2. Estado atual da experiência

O estado atual é uma composição de:

- `MobileStrategicProfilePreview.tsx` como superfície visual compartilhada por preview e shell real;
- `MobileStrategicProfileRealShellClient.tsx` como casca real com hidratação e submissão;
- `MobileStrategicProfileAnalyzeFlow.tsx` como fluxo `+`;
- `MobileStrategicProfileMediaKitModal.tsx` como bridge/modal;
- `mobileStrategicProfileStateContract.ts` e `mobileStrategicProfileMapping.ts` como fonte de copy, estado e arquitetura de informação;
- `mobileStrategicProfileSnapshotMapping.ts` como ponte entre snapshot persistido e apresentação do Perfil.

O Perfil já evita galeria, player, thumbnail, histórico visual de vídeos e navegação global nova. A memória persistida continua sendo o diagnóstico/snapshot, não o arquivo de vídeo.

## 3. Pontos fortes

- O topo usa nome, handle, bio e status do diagnóstico, reforçando que é um Perfil, não um dashboard.
- O `+` aparece no header e na bottom nav como ação central.
- Diagnóstico e Comercial ficam dentro do Perfil, não viram tabs globais.
- Mídia Kit aparece como recurso existente, sem tocar em `MediaKitView`.
- Comunidade aparece como destino existente, sem recriar feed, chat ou comentários.
- A tela limita cards visíveis, reduzindo sensação de relatório longo.
- O fluxo de análise retorna ao Perfil e não cria página final nem recibo permanente.
- Os contratos já sanitizam termos proibidos como score, ranking, promessas e linguagem de performance garantida.

## 4. Riscos de UX/copy

| Prioridade | Risco | Impacto | Recomendação |
| --- | --- | --- | --- |
| P0 | Linguagem de preview/simulação na casca real | Quebra confiança no beta com creators reais | Remover de mensagens visíveis compartilhadas com shell real. |
| P0 | CTA "Analisar vídeo" como ação principal recorrente | Pode parecer biblioteca/upload, não atualização do Perfil | Usar "Atualizar meu Perfil" após primeira leitura. |
| P1 | Excesso de pills em estados premium/Instagram/Mídia Kit | Pode parecer dashboard ou checklist técnico | Manter no máximo 3-4 pills e priorizar estado vivo do diagnóstico. |
| P1 | Comercial aparecer cedo demais | Pode desviar antes de o creator entender a própria narrativa | Manter Comercial limitado/interno e abaixo do Diagnóstico. |
| P1 | Mensagens de erro herdarem termos técnicos do backend | Pode expor sensação de sistema interno | Garantir copy humana para beta access, limite, upload, storage, provider e cleanup. |
| P2 | Auth gate ainda depende de copy de "Google" | Pode ficar estreito se auth mudar depois | Revisar somente quando LoginClient mudar, fora deste PR. |
| P2 | Comunidade como texto sem CTA visual | Pode parecer card morto | Melhorar depois da decisão real de navegação app-first. |
| P3 | Personalizar bloco principal por creator | Aumentaria clareza, mas exige mais dados reais | Deixar para depois do beta de 3 a 5 creators. |

## 5. Inventário de estados

| Estado | O que entende em 5 segundos | CTA principal | CTA secundário | Informação mais importante | Sobra/risco | Sugestão de copy |
| --- | --- | --- | --- | --- | --- | --- |
| Anonymous / auth gate | Preciso entrar para criar meu Perfil | Entrar com Google | Nenhum | Perfil será salvo após login | Pode parecer landing, não app | "Entre para criar seu Perfil Estratégico." |
| Anonymous / analyze intent | Preciso entrar para analisar primeiro vídeo | Entrar e analisar vídeo | Nenhum | A análise salva primeira leitura | Pode prometer demais antes de login | "Entre para salvar essa primeira leitura." |
| Gmail only / account only | Tenho casa no app, mas falta primeira leitura | Analisar primeiro vídeo | Conectar Instagram | Perfil em construção | Card de Comercial pode aparecer cedo | "Seu Perfil começa com a primeira leitura." |
| Perfil em construção | A D2C ainda não sabe minha narrativa | Analisar primeiro vídeo | Ativar Mídia Kit se aplicável | Próximo passo claro | Pode parecer vazio | "Vamos criar sua primeira leitura." |
| Primeira leitura criada | Já existe diagnóstico inicial | Atualizar meu Perfil | Conectar Instagram | Direção narrativa inicial | CTA "Analisar vídeo" parecia pontual | Usar "Atualizar meu Perfil." |
| Premium sem Instagram | Diagnóstico tem mais profundidade | Atualizar meu Perfil | Conectar Instagram | Mais contexto de narrativa | Instagram pode parecer obrigatório | "Conectar Instagram deixa a leitura mais contextual." |
| Instagram optimized | Leitura mais precisa | Atualizar meu Perfil | Mídia Kit se disponível | Precisão adicional | Pode soar como performance prometida | "Leitura com mais contexto." |
| Mídia Kit disponível | Posso compartilhar recurso existente | Compartilhar Mídia Kit | Ver como marca | Link/recurso existente | Não misturar diagnóstico interno | "Use seu Mídia Kit existente." |
| Mídia Kit indisponível/conectar Instagram | Preciso ativar recurso existente | Ativar Mídia Kit | Conectar Instagram | Ponte para recurso existente | Não criar Mídia Kit novo | "Conectar Instagram ajuda a ativar o Mídia Kit existente." |
| Real analysis allowlist ready | Posso atualizar Perfil com vídeo real | Atualizar meu Perfil | Tentar depois se falhar | Consentimento + análise temporária | Não citar allowlist/Gemini/storage | "Vamos usar este vídeo só para gerar uma nova leitura." |
| Real analysis bloqueado por beta | Recurso ainda não está liberado para mim | Voltar ao Perfil | Nenhum | Público geral bloqueado | Não dizer beta flag/allowlist | "Essa análise ainda não está disponível para sua conta." |
| Usage limit reached | Não posso analisar mais agora | Voltar ao Perfil | Tentar depois | Limite do período | Não mencionar quota/provider | "Você atingiu o limite de análises deste período." |
| Upload error | Vídeo não pôde ser preparado | Escolher outro vídeo | Fechar | Perfil antigo preservado | Não citar storage/bucket | "Não conseguimos preparar este vídeo agora." |
| Gemini error | A leitura não saiu agora | Tentar novamente | Fechar | Perfil antigo preservado | Não citar Gemini/provider | "Não conseguimos gerar uma nova leitura agora." |
| Storage error | Vídeo não foi acessado com segurança | Escolher outro vídeo | Fechar | Perfil antigo preservado | Não citar storage/objectKey | "Não conseguimos abrir este vídeo para análise." |
| Cleanup warning | Análise pode concluir com aviso operacional | Voltar ao Perfil | Reportar internamente | Diagnóstico seguro | Não assustar creator | "A leitura foi salva; vamos concluir a limpeza em segundo plano." |
| Snapshot atualizado | Perfil mudou após análise | Voltar para meu Perfil | Atualizar de novo depois | Nova leitura no Perfil | Não falar snapshot | "Seu Perfil foi atualizado com a nova leitura." |
| Perfil antigo preservado após falha | Nada foi perdido | Tentar novamente | Fechar | Segurança do Perfil antigo | Não parecer erro fatal | "Seu Perfil anterior continua preservado." |

## 6. Tabela de copy atual -> recomendação

| Superfície | Copy anterior | Recomendação | Status |
| --- | --- | --- | --- |
| CTA principal após primeira leitura | "Analisar vídeo" | "Atualizar meu Perfil" | Aplicado |
| Header `+` aria-label | "Analisar vídeo" | "Atualizar meu Perfil" | Aplicado |
| Sucesso pós-fluxo | "Seu Perfil foi atualizado nesta simulação." | "Seu Perfil foi atualizado com a nova leitura." | Aplicado |
| Modal Mídia Kit sem link | "ainda não está disponível nesta preview" | "ainda não está disponível por aqui" | Aplicado |
| Modal Mídia Kit sem Instagram | "Esta preview não conecta Instagram de verdade..." | "Conectar Instagram acontece no recurso existente..." | Aplicado |
| Loading sem upload real | "Atualizando seu Perfil Estratégico" | "Atualizando seu Perfil" | Aplicado |
| Etapa do fluxo | "Analisar vídeo" | "Atualizar Perfil" | Aplicado |
| Usuário bloqueado por beta | Pode vir do backend | Não citar allowlist, beta flag, Gemini ou storage | Recomendado P0 |
| Limite atingido | Pode vir do backend | "Você atingiu o limite de análises deste período." | Recomendado P0 |
| Cleanup warning | Pode vir do backend | "A leitura foi salva; vamos concluir a limpeza em segundo plano." | Recomendado P1 |

## 7. Informações que devem aparecer no Perfil

Diagnóstico:

- narrativa principal;
- ponto forte;
- ponto de atenção;
- ajuste recomendado;
- próximo passo;
- sinais do conteúdo quando forem úteis para ação.

Comercial:

- potencial comercial;
- territórios de marca;
- possíveis formatos de publi;
- bridge para Mídia Kit existente;
- linguagem de possibilidade, nunca promessa.

Topo:

- nome, handle e avatar/iniciais;
- status vivo do diagnóstico;
- última leitura ou estado do Perfil;
- ação para atualizar o Perfil.

## 8. Informações que devem sair/ficar escondidas

Não devem aparecer na UI final do Perfil:

- score, nota, pontos, ranking, gabarito ou percentual;
- promessas como garantido, certeza, comprovado, viralizar garantido, marca garantida ou patrocínio garantido;
- termos técnicos como objectKey, signed URL, Gemini, storage, bucket, endpoint, raw response, snapshot, provider, allowlist ou beta flag;
- histórico visual de vídeos, galeria, player, thumbnail ou vídeos salvos;
- diagnóstico interno dentro do Mídia Kit;
- feed/chat/comments de Comunidade dentro do Perfil;
- mensagens de preview, simulação ou teste interno na casca real.

Esses termos podem existir em docs, testes e contratos internos, mas não devem aparecer para o creator no Perfil.

## 9. Recomendações prioritárias

### P0: antes do beta

- Manter "Atualizar meu Perfil" como CTA principal após primeira leitura.
- Bloquear linguagem técnica em mensagens de beta access, limite, upload, storage, provider e cleanup.
- Garantir que falhas preservem Perfil antigo com copy explícita quando possível.
- Validar em dispositivo mobile real se topo + bloco principal respondem: quem sou, qual meu status, o que a D2C entendeu e o que faço agora.

### P1: ideal antes de 3-5 creators

- Revisar os status pills por estado e manter só os mais úteis.
- Tornar o bloco principal mais opinativo: leitura estratégica, ponto forte, ponto de atenção e próximo ajuste.
- Evitar que Comercial apareça como promessa de marca; sempre posicionar como tradução estratégica.
- Melhorar card de Comunidade para parecer destino existente com próximo passo claro, sem criar superfície social nova.

### P2: pode esperar

- Criar variações de copy por creator com base em mais sinais reais.
- Testar ordem dos cards por uso real dos creators.
- Ajustar microinterações do `+` depois de observar o beta.
- Revisar auth copy se o LoginClient mudar.

### P3: ideia futura

- Histórico conceitual de evolução do diagnóstico sem histórico visual de vídeos.
- Checklist interno de evolução do Perfil, sem widget flutuante.
- Personalização por nicho depois de dados suficientes.

## 10. Recomendações para depois do beta

- Usar feedback de 3 a 5 creators para decidir se "Diagnóstico" e "Comercial" são nomes finais ou se precisam ser mais humanos.
- Medir se creators entendem Mídia Kit como recurso existente ou confundem com nova feature.
- Testar se "Atualizar meu Perfil" é mais claro que "Analisar novo vídeo" para ação recorrente.
- Avaliar se a Comunidade deve aparecer na primeira dobra ou apenas na bottom nav.
- Revisitar densidade visual depois de snapshots reais suficientes.

## 11. Guardrails de produto

- Perfil continua sendo a página principal do app mobile.
- O `+` é ação central de atualizar o Perfil, não aba e não biblioteca de upload.
- Diagnóstico e Comercial são partes internas do Perfil.
- Mídia Kit é bridge/modal para recurso existente, sem alterar `MediaKitView`.
- Comunidade é destino existente, sem recriar feed, chat, comentários ou creators públicos.
- Não criar histórico visual de vídeos, galeria, player ou thumbnail.
- Não mudar Gemini, upload, storage, cleanup, usage limits ou endpoints neste tipo de PR.
- Não mudar DashboardShell, BoardShell, sidebar, LoginClient, NextAuth, billing ou Stripe.
- Não commitar `.env.local`, secrets, vídeos, raw responses, signed URLs ou object keys reais.
