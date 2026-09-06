# MM76 — Video Reading Save Orchestrator Foundation

Este milestone cria a camada server-side que salva uma leitura documentada por video a partir de uma analise narrativa ja estruturada.

O orquestrador usa o mapper do MM75 para montar `CreatorVideoNarrativeDiagnosisInput`, passa novamente pelo sanitizer do MM74 e chama o service do MM74 para criar o documento persistente. A funcao e injetavel para testes e para uma integracao futura controlada.

Fora de escopo neste PR:

- nao chama Gemini;
- nao chama storage;
- nao cria upload session;
- nao faz cleanup;
- nao pluga endpoint real;
- nao pluga endpoint mock;
- nao altera UI;
- nao atualiza `CreatorStrategicProfileSnapshot`;
- nao altera o Perfil Estrategico geral.

O retorno do orquestrador e minimo e seguro: `ok`, `diagnosisId`, `documentId` quando seguro e um resumo de `profileContribution`. Em falhas, retorna apenas codigo e mensagem segura, sem stack trace, env, secrets, raw provider payload, raw model output ou referencias de storage.

O Perfil geral continua sendo responsabilidade de uma sintese/agregador futuro. Esta camada apenas prepara o caminho para salvar a leitura por video depois que uma analise ja estruturada existir.
