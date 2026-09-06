# MM79 — Narrative Map Reading Preview QA Polish

Este milestone revisa a experiencia visual e textual do preview interno criado no MM78.

## O que foi revisado

- Topo compacto do creator.
- Hero do mapa narrativo.
- Hierarquia dos CTAs.
- Cards de capitulos.
- Bottom sheet de capitulo.
- Painel de diagnostico completo.
- Estados de primeira leitura, Instagram conectado e oportunidades.
- Testes de regressao textual e de guardrails.

## Decisoes de UX

- A tela principal mostra o espelho: nome, status, metricas curtas, hero e cards.
- O card fechado precisa entregar valor sem exigir abertura.
- O modal aprofunda a leitura com texto, evidencias e acao pratica.
- O diagnostico completo fica secundario e organizado em sequencia.
- Instagram aparece como camada de precisao, nao como aba.
- Oportunidades continuam como territorio e fit narrativo em formacao.

## Checklist de QA visual

- Topo nao domina a tela.
- Hero comunica a leitura em poucos segundos.
- Card fechado ja entrega valor.
- Modal aprofunda sem virar PDF.
- Diagnostico completo e opcional.
- Instagram aparece como camada de precisao.
- Oportunidades nao prometem match real.
- A linguagem soa humana, nao tecnica.
- A experiencia segue espelho, evidencia e movimento.

## Checklist de microcopy

- Usar "Seu mapa narrativo".
- Usar "Nova leitura" como CTA principal.
- Usar "Ler diagnostico completo" como CTA secundario.
- Usar "Onde isso aparece" para evidencias.
- Usar "Como usar agora" para acao pratica.
- Usar primeira leitura como hipotese, nao conclusao.
- Evitar linguagem tecnica, mística ou de promessa comercial.

## Guardrails mantidos

Este PR nao:

- altera endpoint real ou endpoint mock;
- chama Gemini;
- chama storage;
- salva documento;
- altera upload ou cleanup;
- altera `CreatorStrategicProfileSnapshot`;
- cria agregador do Perfil;
- altera UI real do Perfil;
- altera `MediaKitView`, Comunidade, billing, Stripe, NextAuth, shells, sidebar ou navegacao real.

Termos como object key, signed URL, storage, raw response e Gemini seguem fora da UI. Eles podem aparecer apenas em testes ou documentacao de guardrail.

## Fora do escopo

- Integrar endpoint real.
- Integrar endpoint mock.
- Salvar leitura por video.
- Criar UI final de Perfil, Leituras e Oportunidades.
- Criar agregador do Perfil.
- Criar matches reais.

## Proximo passo sugerido

O proximo PR pode criar uma camada de adapter para escolher, em ambiente interno, qual leitura documentada alimenta o preview sem ainda plugar endpoint real ou persistencia nova.
