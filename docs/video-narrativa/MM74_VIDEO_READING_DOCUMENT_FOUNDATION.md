# MM74 — Video Reading Document Foundation

Cada vídeo enviado pelo creator deve gerar uma leitura estratégica documentada. O Perfil Estratégico geral continua sendo uma síntese acumulada das leituras e não deve ser sobrescrito pelo diagnóstico direto de um único upload.

Este PR cria apenas a fundação documental da leitura por vídeo por meio de `CreatorVideoNarrativeDiagnosis`. Um vídeo isolado não atualiza diretamente a narrativa principal do Perfil; ele registra uma contribuição documentada em `profileContribution`, que poderá alimentar um agregador em milestone posterior.

Guardrails desta fundação:

- o vídeo não é salvo;
- thumbnail não é salva;
- signed URL não é salva;
- upload URL não é salva;
- objectKey não é salvo;
- raw Gemini response não é salva;
- transcrição longa não é salva;
- referências de storage, tokens, secrets e base64 grande são bloqueados ou redigidos antes da persistência.

Fora de escopo neste PR:

- agregador do Perfil;
- split completo do prompt Gemini;
- integração com Gemini schema;
- mudança no endpoint real de análise;
- mudança no endpoint mock;
- UI final de Perfil, Leituras ou Oportunidades;
- modais de capítulos;
- matches reais;
- integração com Media Kit real.
