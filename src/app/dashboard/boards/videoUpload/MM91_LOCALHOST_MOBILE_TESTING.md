# MM91 Localhost Mobile Testing

Este roteiro libera a validacao manual e visual da experiencia mobile em localhost, sem abrir o beta para usuarios comuns e sem chamar Gemini, storage real ou Stripe real por acidente.

## Comandos

```bash
git checkout feat/mm91-closed-beta-activation-telemetry-smoke
npm install
npm run dev
```

Abra `http://localhost:3000`.

Sempre reinicie o `npm run dev` depois de alterar `NEXT_PUBLIC_*` no `.env.local`.

## `.env.local` para teste visual completo com mock

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<preencher com segredo local>
ALLOW_LOCAL_E2E_CREDENTIALS=1

NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED=1
MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED=1
NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1
MOBILE_STRATEGIC_PROFILE_SNAPSHOT_ENABLED=1
MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS=1

VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED=1
VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED=1
NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED=1
VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=false
VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER=local_mock
VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB=100
VIDEO_NARRATIVE_TEMP_UPLOAD_TTL_MINUTES=60
VIDEO_NARRATIVE_TEMP_SIGNED_URL_TTL_SECONDS=300

NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=0
VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=false
VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=false
```

`MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS=1` funciona apenas fora de producao e ainda exige usuario autenticado. Se preferir testar o gate real de admin/dev, remova essa flag e use uma conta local com `role: "admin"` ou `role: "dev"`.

## Login local

Use uma conta local normal ou o provider credentials existente. Para credentials E2E local:

```env
ALLOW_LOCAL_E2E_CREDENTIALS=1
E2E_EMAIL=<email pro local>
E2E_FREE_EMAIL=<email free local>
E2E_PASSWORD=<senha local>
```

Essas credenciais criam identidades locais do provider credentials. O usuario Pro recebe `planStatus: "active"` e o Free recebe `planStatus: "inactive"`. Elas nao tornam o usuario admin/dev; para preview interno, use a flag local acima ou ajuste `role` no banco local.

## URLs principais

- Perfil mobile real: `/dashboard/boards/mobile-strategic-profile`
- Preview interno e smoke harness: `/dashboard/boards/mobile-strategic-profile-preview`
- Comunidade canonica mobile: `/planning/discover`
- Billing success para testar follow-through visual: `/billing/success?session_id=local-smoke`

## Smoke states

- Free sem leitura: `/dashboard/boards/mobile-strategic-profile-preview?state=account_only`
- Free com leitura usada: `/dashboard/boards/mobile-strategic-profile-preview?state=first_reading_free`
- Pro sem Instagram: `/dashboard/boards/mobile-strategic-profile-preview?state=premium_without_instagram`
- Pro com Instagram: `/dashboard/boards/mobile-strategic-profile-preview?state=instagram_optimized`
- Pro 10/10: `/dashboard/boards/mobile-strategic-profile-preview?state=instagram_optimized&smoke=pro_quota_reached`
- Pagamento pendente: `/dashboard/boards/mobile-strategic-profile-preview?state=account_only&smoke=payment_pending`
- Acao de pagamento: `/dashboard/boards/mobile-strategic-profile-preview?state=account_only&smoke=payment_action_needed`
- Mídia Kit disponivel: `/dashboard/boards/mobile-strategic-profile-preview?state=media_kit_available`
- Mídia Kit pede Instagram: `/dashboard/boards/mobile-strategic-profile-preview?state=premium_without_instagram`
- Endpoint real bloqueado: `/dashboard/boards/mobile-strategic-profile-preview?state=narrative_map_chapters&smoke=real_endpoint_blocked_for_common_user`
- Endpoint allowlist fixture: `/dashboard/boards/mobile-strategic-profile-preview?state=narrative_map_chapters&smoke=real_endpoint_allowlist_success`
- Pos-checkout Instagram: `/dashboard/boards/mobile-strategic-profile-preview?state=premium_without_instagram&postCheckoutIntent=connect_instagram`
- Pos-checkout Comunidade: `/planning/discover?postCheckoutIntent=join_community`

## Simular `postCheckoutIntent` sem Stripe real

No DevTools, antes de abrir `/billing/success?session_id=local-smoke`, rode:

```js
sessionStorage.setItem("d2c.paywall.return", JSON.stringify({
  context: "narrative_map",
  returnTo: "/dashboard/boards/mobile-strategic-profile",
  postCheckoutIntent: "connect_instagram"
}));
```

Para Comunidade:

```js
sessionStorage.setItem("d2c.paywall.return", JSON.stringify({
  context: "mentoria",
  returnTo: "/planning/discover",
  postCheckoutIntent: "join_community"
}));
```

O `returnTo` aceito precisa comecar com `/` e nao pode comecar com `//`.

## O que o mock cobre

- Perfil mobile real carregando com flag.
- Preview interno sem moldura real, smoke harness e estados de acesso.
- Status Card, tabs `Mapa | Leituras | Oportunidades`, Mídia Kit em Oportunidades.
- Nova leitura estrategica, selecao de video, pergunta aberta, contexto rapido, processamento e confirmacao.
- Upload local final-like: o navegador faz `PUT` do arquivo escolhido para uma rota dev-only em `localhost`, que conta os bytes e descarta o stream sem salvar video, thumbnail, raw response ou transcript.
- Comunidade como marketplace com banner compacto.
- Paywall contextual e armazenamento de `postCheckoutIntent` seguro.

## O que exige infraestrutura real

O fluxo real `video -> storage -> Gemini -> leitura salva` exige secrets reais e conta allowlist/admin-dev:

```env
VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=true
VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=1
VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS=<email permitido>
VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER=r2
VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET=<bucket real>
VIDEO_NARRATIVE_TEMP_STORAGE_REGION=<regiao real>
VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT=<endpoint real>
NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=1
VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED=1
VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true
VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=1
VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS=<email permitido>
GEMINI_API_KEY=<chave real>
VIDEO_NARRATIVE_GEMINI_MODEL=gemini-2.5-flash
```

Nao invente valores para esses secrets. Nesta versao, o signer server-side de URL assinada ainda retorna `null`; portanto o teste real completo com R2/Gemini pode ficar bloqueado em `signed_url_signer_not_configured`. O teste local seguro recomendado para UX e operacao beta e o modo `local_mock`.

## Checklist visual

1. Abrir Perfil real e confirmar que nao da 404.
2. Confirmar bottom nav com apenas `Perfil | Comunidade`.
3. Confirmar Status Card correto para o estado atual.
4. Abrir Nova leitura pelo Perfil.
5. Validar etapas: intro, video, pergunta, contexto rapido, processamento, leitura pronta.
6. Confirmar que a UI nao mostra `mock`, `objectKey`, `signedUrl`, `uploadUrl`, transcript ou raw response.
7. Confirmar tabs internas `Mapa | Leituras | Oportunidades`.
8. Em Oportunidades, confirmar Mídia Kit com `Copiar link`, `Ver como marca`, `Abrir Mídia Kit` ou CTA de Instagram.
9. Abrir Comunidade em `/planning/discover`.
10. Confirmar marketplace/lista de creators e banner compacto.
11. Abrir preview interno e usar o `MM91 smoke harness`.
12. Simular `postCheckoutIntent` no `sessionStorage` e abrir `/billing/success?session_id=local-smoke`.
