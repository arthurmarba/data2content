---
tipo: armadilha
custo: dias
resolvido: sim
---

# Upload de vídeo respondendo 403 no R2

## O sintoma

O botão "+" falha com "Não foi possível enviar". O envio pro armazenamento da Cloudflare devolve **403**, sem explicação útil.

## A causa

A partir da versão 3.729, o SDK da AWS passou a injetar uma soma de verificação (CRC32) automaticamente em toda requisição. O R2 não espera isso numa URL assinada, e a assinatura deixa de bater.

Não é permissão, não é chave errada, não é CORS — é o SDK mudando o pedido depois que ele foi assinado.

## A correção

```ts
requestChecksumCalculation: "WHEN_REQUIRED"
```

Já aplicada em:
- `src/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider.ts`
- `src/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage.ts`

**Ao criar um cliente S3/R2 novo, repita essa opção.** Sem ela, o mesmo 403 volta.

## O outro 403

Existe um 403 de causa completamente diferente: variável de ambiente faltando na Vercel. Ver [[Variável só no .env.local]]. Descartar esse primeiro é mais rápido.

## Ligações

[[Seu Mapa]] · [[Limite de 90 segundos]]
