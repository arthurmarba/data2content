# MM90 — Mobile UX Simplification Pass

Issue: #877

## Goal

Optimize the real mobile app experience before telemetry and final beta hardening.

The product should feel like a mobile app for strategic direction, not a dashboard, landing page, preview, or generic video AI.

Core flow:

`Perfil → Nova leitura → Upload de vídeo → Pergunta/objetivo → Contexto rápido → Leitura pronta → Perfil atualizado`

## Product principle

Interface enxuta. Texto suficiente. Diagnóstico profundo.

The user should open the Perfil, understand what D2C has already read, know the next step, generate a new reading, and share the Media Kit without hunting for it.

## Mobile-only scope

This milestone should touch only the real mobile experience for:

- Perfil
- Mapa Narrativo
- Status Card
- New reading flow
- Media Kit entry inside Oportunidades
- Mobile Community entry/banner

Out of scope:

- telemetry
- beta activation
- billing core
- Stripe
- NextAuth
- desktop DashboardShell/BoardShell/sidebar
- public MediaKitView
- AI engine/prompt/parser/schema changes
- real brand matching
- campaign CRM

## Implementation order

1. Separate real mobile app surface from internal preview/device frame.
2. Consolidate the real mobile Perfil experience.
3. Simplify the mobile Status Card for access/quota/Instagram/payment states.
4. Rework the new reading flow around video, creator question, quick context, and Perfil update.
5. Ensure `creatorGoal` and `quickAnswers` come from real user input, not hardcoded values.
6. Place Media Kit actions at the top of Oportunidades.
7. Keep Community as marketplace/list with a compact consulting banner.
8. Update tests and run typecheck, tests, and build.

## Key UX rules

- Global mobile navigation: `Perfil | Comunidade` only.
- Perfil tabs: `Mapa | Leituras | Oportunidades`.
- New reading never appears as global navigation.
- Card equals summary.
- Modal/bottom sheet/detail equals complete diagnosis.
- Buttons must be short but specific.
- Avoid technical language in real UI: mock, preview, upload session, objectKey, signed URL, raw response, raw transcript, storage path.

## Validation

Expected validation before PR is ready:

```bash
npm run typecheck
npm test -- --runInBand
npm run build
```

See issue #877 for the full implementation brief and acceptance criteria.
