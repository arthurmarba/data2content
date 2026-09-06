# MM75 — Video Reading Mapper Foundation

Este milestone adiciona um mapper puro para transformar camadas narrativas ja estruturadas em `CreatorVideoNarrativeDiagnosisInput`.

O mapper consome apenas contratos internos ja normalizados, como diagnostico estrategico, diagnostico evolutivo, presentation model, seed e metadados seguros. Ele nao recebe raw Gemini response como fonte de verdade, nao chama Gemini, nao usa SDK de storage, nao persiste nada sozinho e nao atualiza o Perfil Estrategico geral.

O papel desta camada e preparar o caminho para um PR futuro em que a leitura por video possa ser salva depois da analise, mantendo a separacao de produto:

- diagnostico do video vira leitura documentada do video;
- Perfil Estrategico geral continua sendo sintese acumulada;
- um video isolado gera `profileContribution`, mas nao sobrescreve a narrativa principal do Perfil.

Guardrails preservados:

- sem raw model output;
- sem video salvo;
- sem thumbnail persistida;
- sem signed URL;
- sem upload URL;
- sem objectKey;
- sem storage provider path;
- sem localPath;
- sem transcricao longa;
- sem atualizacao de `CreatorStrategicProfileSnapshot`.

O `profileContribution` e deterministico e conservador: primeira leitura vira hipotese ou necessidade de mais amostras, recorrencia compativel pode confirmar padrao existente, e oportunidades comerciais viram apenas `commercial_signal` sem promessa de match real ou publi garantida.
