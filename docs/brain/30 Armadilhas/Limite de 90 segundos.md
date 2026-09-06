---
tipo: armadilha
tipo-real: decisão de produto
---

# Análise de vídeo vai até 90 segundos

Não é limitação técnica temporária: é **teto de produto**. Vídeo mais longo custa caro pra ler e não melhora a leitura.

- Constante: `VIDEO_NARRATIVE_MAX_DURATION_SECONDS = 90` em `src/app/dashboard/boards/videoUpload/videoNarrativeMediaProbe.ts`
- O bloqueio acontece **antes** do envio, no navegador — o criador não espera 300 MB subirem pra descobrir que não vale.
- Tamanho vai até 300 MB; o que corta é a duração.

Se alguém pedir "aceitar vídeos maiores", isso é conversa de produto e custo, não de configuração.

## Ligações

[[Upload de vídeo dá 403]] · [[Custo de IA é decisão de arquitetura]]
