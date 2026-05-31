# WhatsApp — Templates da Newsletter Semanal

> Spec de templates Meta WABA usados pelo cron `weekly-whatsapp-message` (Fase D2).
> **Esses templates precisam ser submetidos e aprovados na Meta antes do D2 entrar em produção.**
> Versão: 1.0 — Fase D1

---

## Contexto

A Data2Content envia 1 mensagem por semana para criadores Pro via WhatsApp Cloud API.
Como o envio é **proativo** (fora da janela de 24h de conversa), a Meta exige que o
conteúdo siga um **template pré-aprovado**.

A IA (Gemini 2.5 Flash) gera o **corpo da newsletter** que vai no parâmetro `{{2}}`.
Os outros parâmetros (`{{1}}` = nome, `{{3}}` = CTA com link) são montados pelo serviço.

---

## Template 1 — `d2c_weekly_seed_v1`

**Para:** criadores cuja narrativa OU territórios ainda não foram confirmados.

**Categoria Meta:** `UTILITY` (mensagem informativa sobre uso do serviço — não promocional).

**Idioma:** `pt_BR`.

### Estrutura

| Componente | Conteúdo |
|---|---|
| Header | _(nenhum)_ |
| Body | Veja abaixo |
| Footer | _Data2Content_ |
| Buttons | _(nenhum — link vai no body)_ |

### Body

```
{{1}}, seu mapa está tomando forma.

{{2}}

→ {{3}}
```

### Parâmetros

| Var | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Primeiro nome do criador | `Lucas` |
| `{{2}}` | Corpo gerado pela IA (≤ 280 chars, 2 frases) | `Detectamos que sua narrativa está girando em torno de "rotina criativa". Confirme essa direção no seu perfil para liberar suas pautas da semana.` |
| `{{3}}` | CTA com URL | `Confirme sua narrativa: https://data2content.com.br/perfil` |

### Exemplo de exemplo (para a submissão Meta)

> Lucas, seu mapa está tomando forma.
>
> Detectamos que sua narrativa está girando em torno de "rotina criativa". Confirme essa direção no seu perfil para liberar suas pautas da semana.
>
> → Confirme sua narrativa: https://data2content.com.br/perfil

---

## Template 2 — `d2c_weekly_newsletter_v1`

**Para:** criadores com narrativa **E** territórios confirmados (tiers `growing` e `mature`).

**Categoria Meta:** `UTILITY`.

**Idioma:** `pt_BR`.

### Estrutura

| Componente | Conteúdo |
|---|---|
| Header | _(nenhum)_ |
| Body | Veja abaixo |
| Footer | _Data2Content_ |
| Buttons | _(nenhum — link vai no body)_ |

### Body

```
{{1}}, seu mapa essa semana:

{{2}}

→ {{3}}
```

### Parâmetros

| Var | Descrição | Exemplo |
|---|---|---|
| `{{1}}` | Primeiro nome do criador | `Lucas` |
| `{{2}}` | Corpo gerado pela IA (≤ 460 chars) | _ver abaixo_ |
| `{{3}}` | CTA com URL | `Ver suas pautas: https://data2content.com.br/perfil` |

### Exemplo de `{{2}}` (gerado pela IA)

```
✍️ Pautas — do seu território de rotina criativa:
→ "Por que minha melhor ideia veio de uma caminhada sem objetivo" (Reels)
→ "O que aprendi tentando criar todo dia por 30 dias" (Carrossel)
(+ 1 disponível no seu perfil)

🔍 Descoberta — "academia" apareceu em 4 leituras recentes. É um asset recorrente da sua vida?
```

### Exemplo de exemplo (para a submissão Meta)

> Lucas, seu mapa essa semana:
>
> ✍️ Pautas — do seu território de rotina criativa:
> → "Por que minha melhor ideia veio de uma caminhada sem objetivo" (Reels)
> → "O que aprendi tentando criar todo dia por 30 dias" (Carrossel)
> (+ 1 disponível no seu perfil)
>
> 🔍 Descoberta — "academia" apareceu em 4 leituras recentes. É um asset recorrente da sua vida?
>
> → Ver suas pautas: https://data2content.com.br/perfil

---

## Tiers e quando cada template é usado

Determinado pela função `determineTier()` em `weeklyWhatsAppMessageService.ts`:

| Tier | Critério | Template | Pautas no preview |
|---|---|---|---|
| `seed` | `narrative.state !== "confirmed"` OU `territories.state !== "confirmed"` | `d2c_weekly_seed_v1` | 0 (convite a confirmar) |
| `growing` | Ambas confirmadas, `analyzedReadingsCount < 6` | `d2c_weekly_newsletter_v1` | 2 |
| `mature` | Ambas confirmadas, `analyzedReadingsCount >= 6` | `d2c_weekly_newsletter_v1` | 3 |

---

## Como invocar `sendTemplateMessage` (referência para D2)

```typescript
import { sendTemplateMessage } from "@/app/lib/whatsappService";

const result = await generateWeeklyWhatsAppMessageForUser(userId);
if (!result.ok || !result.payload) return;

const { templateName, bodyParams, whatsappPhone } = result.payload;

await sendTemplateMessage(
  whatsappPhone,
  templateName,
  [
    {
      type: "body",
      parameters: bodyParams.map((text) => ({ type: "text", text })),
    },
  ],
  "pt_BR",
);

// On success, write throttle stamp
await User.findByIdAndUpdate(userId, {
  $set: { weeklyWhatsAppSentAt: new Date() },
});
```

---

## Notas para a submissão Meta

1. **Categoria UTILITY** — esses templates orientam o criador sobre o uso do serviço que ele já contratou. Não é promocional/marketing. Submeter como categoria errada gera rejeição.

2. **Exemplos** — a Meta exige que cada template traga **exemplos de valores** para cada `{{N}}` na submissão. Use os exemplos acima.

3. **Variáveis com URL** — a Meta aceita URLs dentro de `{{N}}` do body desde que sejam exibidas como texto. Não usar `{{N}}` em botão de URL dinâmica (mais difícil de aprovar).

4. **Emojis** — permitidos no body. Usados nas seções (✍️, 🔍) e podem ser usados no Header se desejado.

5. **Footer** — manter `_Data2Content_` (em itálico via underscores) ou simplesmente `Data2Content` ajuda a Meta a entender que é uma mensagem corporativa legítima.

6. **Tempo de aprovação Meta** — costuma ser **24–72h**. Aprovação não garantida na primeira tentativa: se rejeitado, ajustar copy do exemplo e re-submeter.

---

## Variáveis de ambiente necessárias

Já existentes (do `whatsappService.ts`):

- `WHATSAPP_TOKEN` — token permanente da WABA
- `WHATSAPP_PHONE_NUMBER_ID` — phone_number_id do número aprovado
- `WHATSAPP_OUTBOUND_ENABLED` — kill switch (`"true"` para liberar)

Nenhuma variável nova é introduzida pela D1/D2.

---

## Arquivos relacionados

- `src/app/dashboard/boards/videoUpload/weeklyWhatsAppMessageService.ts` — gera o payload
- `src/app/dashboard/boards/videoUpload/weeklyWhatsAppMessagePromptBuilder.ts` — prompts Gemini
- `src/app/lib/whatsappService.ts` — `sendTemplateMessage` (já existente)
- `src/app/models/User.ts` — campo `weeklyWhatsAppSentAt`
- `src/app/api/cron/weekly-whatsapp-message/route.ts` — _(será criado na Fase D2)_

---

*Spec de templates — Data2Content, Fase D1.*
