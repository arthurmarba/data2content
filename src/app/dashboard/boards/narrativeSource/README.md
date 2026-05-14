# Narrative Source Engine

NSE representa fontes criativas como contratos narrativos puros. Nesta primeira fase, vídeo é apenas uma possível `NarrativeSource`, sem upload real, endpoint, banco, OpenAI ou UI.

## NSE1

Esta fase define:

- Tipos de fonte narrativa.
- Intenções possíveis por trás da fonte.
- Assets narrativos extraídos futuramente.
- Sinais que podem enriquecer o perfil narrativo depois.
- Diagnóstico narrativo básico.

Os contratos vivem em `narrativeSourceTypes.ts`. A fase não implementa extração, roteamento, adapters para Adaptive V2 ou persistência.

## NSE2

Esta fase adiciona `detectNarrativeSourceIntent(source)`, um roteador heurístico e determinístico para identificar a intenção estratégica da fonte narrativa. Ele usa apenas texto local da `NarrativeSource` e continua sem UI, endpoint, banco, upload, OpenAI ou integração com o fluxo real.
