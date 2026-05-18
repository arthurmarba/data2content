# Video Narrative Browser UX QA Checklist

## Objetivo

Esta checklist orienta a validação manual da preview interativa app-first no navegador antes de qualquer integração real. Ela ajuda a revisar clareza, progressão, hierarquia visual, sensação de produto e segurança da experiência.

## Escopo

Esta revisão cobre apenas a preview interna:

- preview interna/admin-dev;
- mock/local-state;
- sem upload real;
- sem provider real;
- sem persistência;
- sem BoardShell;
- sem Instagram real;
- sem billing;
- sem analytics real.

Ficam fora desta fase: endpoint real, storage real, banco/tabela, fluxo real do produto, navegação principal e qualquer integração externa.

## Ambiente

Antes de testar:

- usar a branch `feat/video-narrative-browser-ux-qa-checklist` ou o topo equivalente da stack;
- habilitar `NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED=1`;
- acessar `/dashboard/boards/video-narrative-app-preview?mode=interactive`;
- usar usuário com permissão admin/dev;
- não configurar Gemini;
- não configurar upload/storage;
- não configurar Instagram;
- não configurar Stripe.

## URLs de teste

1. Default:
`/dashboard/boards/video-narrative-app-preview?mode=interactive`

2. Brand/free:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=brand&access=free&instagram=disconnected`

3. Weak hook/free:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=weak-hook&access=free&instagram=disconnected`

4. Collab/premium:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=collab&access=premium&instagram=disconnected`

5. Instagram optimized:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=brand&access=instagram_optimized&instagram=connected`

6. Ad adaptation:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=ad-adaptation&access=premium&instagram=disconnected`

7. Unclear:
`/dashboard/boards/video-narrative-app-preview?mode=interactive&scenario=unclear&access=free&instagram=disconnected`

## Roteiro principal

- [ ] Tela inicial mostra promessa clara.
- [ ] CTA “Começar análise” é visível.
- [ ] Clique em começar leva para upload.
- [ ] Upload mostra botão central “Subir vídeo”.
- [ ] Upload explica que é simulado na preview.
- [ ] Clique em upload leva para loading de análise.
- [ ] Loading de análise mostra mensagens úteis.
- [ ] Continuar leva para pergunta central.
- [ ] Pergunta central é clara.
- [ ] Quick prompts funcionam.
- [ ] Campo de texto aceita objetivo.
- [ ] Continuar só habilita com texto.
- [ ] Loading da dúvida mostra mensagens úteis.
- [ ] Quiz aparece com 3 a 5 perguntas.
- [ ] Quiz mostra progresso.
- [ ] Opções são fáceis de tocar.
- [ ] Sinal “aprende:” aparece discreto.
- [ ] Quiz só conclui quando perguntas obrigatórias foram respondidas.
- [ ] Loading de diagnóstico aparece.
- [ ] Diagnóstico final aparece.
- [ ] Diagnóstico tem hierarquia clara.
- [ ] CTAs finais aparecem.
- [ ] Upgrade prompt funciona.
- [ ] Instagram prompt funciona.
- [ ] Reset/reinício funciona, se disponível.

## Critérios de qualidade por etapa

### Welcome

- promessa clara;
- pouca fricção;
- texto não técnico;
- CTA óbvio.

### Upload

- botão grande;
- sensação app-first;
- preview deixa claro que upload é simulado;
- sem parecer fluxo quebrado.

### Loading

- mensagens passam inteligência estratégica;
- sem parecer processamento genérico;
- sem prometer resultado.

### Pergunta central

- pergunta simples;
- quick prompts úteis;
- campo fácil de entender;
- objetivo escrito muda a sensação da experiência.

### Quiz

- perguntas parecem consultoria;
- não parece formulário burocrático;
- opções são claras;
- aprendizado aparece como detalhe, não como ruído;
- não excede esforço mental.

### Diagnóstico

Validar se o diagnóstico responde:

- qual narrativa aparece?
- o que o vídeo comunica?
- qual era a intenção do criador?
- qual é a leitura estratégica?
- qual é o ponto forte?
- qual é o ponto de atenção?
- o que ajustar?
- qual gancho sugerido?
- existe potencial comercial?
- qual blueprint sugerido?
- quais próximas ações?
- o que ficou bloqueado?
- o que melhora com Instagram?

### Upgrade

- aparece no momento certo;
- não bloqueia valor principal;
- explica o que assinante ganha;
- CTA claro.

### Instagram

- aparece como otimização, não obrigação;
- explica que melhora o diagnóstico;
- CTA claro.

## Cenários obrigatórios

### Brand

Validar:

- diagnóstico fala de potencial comercial;
- quiz pergunta sobre marca/publi;
- prompt de Instagram faz sentido;
- CTAs de marca aparecem.

### Weak hook

Validar:

- diagnóstico foca gancho;
- quiz pergunta sobre direção da abertura;
- gancho sugerido aparece com destaque;
- próxima ação de melhorar gancho faz sentido.

### Collab

Validar:

- diagnóstico menciona collab quando aplicável;
- quiz pergunta sobre colaboração;
- próxima ação faz sentido.

### Ad adaptation

Validar:

- diagnóstico fala de publi orgânica;
- brand integration style faz sentido;
- CTA de versão para publi aparece.

### Unclear

Validar:

- quiz pede contexto;
- diagnóstico não força conclusão;
- locked/needs more context aparecem de forma amigável.

## Acessos

### Free

- mostra valor;
- tem seções bloqueadas;
- upgrade aparece de forma natural.

### Premium

- reduz bloqueios premium;
- ainda pode sugerir Instagram se desconectado.

### Instagram optimized

- mostra comparação/otimização quando conectado;
- não força CTA de conectar Instagram.

## Mobile-first

Validar a experiência mobile-first:

- [ ] testar em viewport mobile;
- [ ] cards não ficam espremidos;
- [ ] botões são fáceis de tocar;
- [ ] diagnóstico é escaneável;
- [ ] controles internos não atrapalham a experiência;
- [ ] quiz é confortável no mobile;
- [ ] CTAs finais ficam claros.

## Segurança visual e dados

Validar:

- não aparece rawText;
- não aparece base64;
- não aparece API key;
- não aparece signedUrl;
- não aparece videoUrl;
- não aparece dados reais de Instagram;
- não aparece informação de billing real;
- não aparece menção a Gemini como dependência da experiência.

## Critérios para aprovar MM37

A checklist pode ser considerada aprovada quando:

- fluxo principal é compreensível sem explicação;
- diagnóstico final parece útil;
- quiz parece consultivo;
- upgrade não parece agressivo;
- Instagram aparece como otimização;
- experiência funciona em mobile;
- não há vazamento de dados sensíveis;
- não há dependência de integração real.

## Achados esperados

Use a tabela abaixo para registrar achados da revisão:

| Área | Achado | Severidade | Ação recomendada | Status |
| --- | --- | --- | --- | --- |
| copy |  |  |  |  |
| layout |  |  |  |  |
| quiz |  |  |  |  |
| diagnóstico |  |  |  |  |
| upgrade |  |  |  |  |
| Instagram |  |  |  |  |
| mobile |  |  |  |  |
| segurança |  |  |  |  |
| performance percebida |  |  |  |  |

## Próximas decisões após QA

Possíveis caminhos depois da revisão:

- refinar UX novamente;
- criar integração controlada com endpoint mock;
- preparar upload simulado mais realista;
- preparar paywall/credits contract;
- preparar BoardShell handoff;
- só depois upload/storage real.
