---
tipo: armadilha
tipo-real: restrição de projeto
---

# O fluxo de vídeo no celular não guarda nada no navegador

`MobileStrategicProfileAnalyzeFlow` **proíbe** `localStorage` e `sessionStorage`. Isso é intencional, não esquecimento.

## Por quê

O fluxo é longo, o celular mata aba com facilidade, e estado meio-salvo no navegador produz o pior dos mundos: o criador volta e encontra um envio pela metade que não existe no servidor.

## O que fazer no lugar

Persista **no servidor**. Existem serviços prontos pra isso: `mobileStrategicProfileUploadSessionClient.ts` e `mobileStrategicProfileSnapshotService.ts`.

Se você se pegar escrevendo `localStorage.setItem` nesse fluxo, o desenho está errado — não o código.

## Ligações

[[Seu Mapa]] · [[10 Mapa do sistema]]
