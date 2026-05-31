# Fase B — Paywall: Dois Perfis de Entrada

## Visão Geral

Implementação de paywall com dois perfis de entrada após o primeiro sinal no onboarding:

1. **"Assinar agora"** — Acesso direto ao fluxo de subscription
2. **"Explorar grátis primeiro"** — Continue com a tier free (1 análise/mês)

### Princípios

- ✅ Aparece APENAS após a primeira leitura (quando `accessState === "free_unused"`)
- ✅ Sem botão "Fechar" ou "Pular" — apenas essas duas opções
- ✅ Assinar não pula etapas — aprofunda apenas o que já foi descoberto
- ✅ Opção de assinar disponível em qualquer momento da jornada (implementar depois)
- ✅ Design calmo, alinhado com o onboarding

---

## Arquivos Criados

### 1. `OnboardingPaywallModal.tsx` (NEW)

**Localização:** `src/app/dashboard/boards/components/videoUpload/appPreview/OnboardingPaywallModal.tsx`

**O que faz:**
- Modal com dois botões de entrada bem definidos
- Profile 1: "Assinar agora" (cta principal — fundo preto)
- Profile 2: "Explorar grátis primeiro" (cta secundária — border)
- Lista de 4 features principais do plano Pro
- Footer explicativo: "A assinatura não pula etapas — só aprofunda o que você descobre"
- Sem close button

**Props:**
```typescript
interface OnboardingPaywallModalProps {
  open: boolean;
  onSubscribeNow: () => Promise<void>;
  onExploreFree: () => void;
}
```

**Design:**
- z-index: 280 (acima do onboarding em 270)
- Fundo semitransparente com sobreposição
- Rounded-3xl, max-width md, shadow-2xl
- Ícone laranja no topo (mesmo padrão do onboarding)
- Features com checkmarks em laranja

---

## Arquivos Modificados

### 2. `MobileOnboardingFlow.tsx` (MODIFIED)

**Mudanças:**

#### A. Import
```typescript
import { OnboardingPaywallModal } from "./OnboardingPaywallModal";
```

#### B. State
```typescript
const [showPaywallModal, setShowPaywallModal] = useState(false);
```

#### C. Reset effect
Adicionado reset do modal state quando onboarding fecha:
```typescript
setShowPaywallModal(false);
```

#### D. Handler da primeira resposta
Antes: chamava `openPaywallModal()` (evento global)
Depois: mostra o modal customizado
```typescript
if (accessState === "free_unused") {
  onComplete(answers);
  setShowPaywallModal(true);  // ← Nova lógica
  return;
}
```

#### E. Callbacks do paywall
```typescript
const handlePaywallSubscribeNow = useCallback(async () => {
  openPaywallModal({
    context: "narrative_map",
    source: "onboarding_entry",  // ← novo source
    returnTo: MOBILE_PROFILE_ROUTE,
    postCheckoutIntent: "connect_instagram",
  });
}, []);

const handlePaywallExploreFree = useCallback(() => {
  setShowPaywallModal(false);
}, []);
```

#### F. Render
```typescript
<OnboardingPaywallModal
  open={showPaywallModal}
  onSubscribeNow={handlePaywallSubscribeNow}
  onExploreFree={handlePaywallExploreFree}
/>
```

---

### 3. `DiagnosticoIdeasDetailView.tsx` (FIXED)

**Correção de linting:**
- Linha 286: Unescaped quotes → convertido para HTML entities
- Antes: `"{idea.hook}"`
- Depois: `&ldquo;{idea.hook}&rdquo;`

---

## Fluxo de Uso

### Onboarding Flow

1. Criador responde 3 perguntas (why, feeling, limit)
2. Sistema gera "ponto de partida" (seed signal)
3. Criador vê o sinal e responde: "Sim?" / "Quase" / "Não é isso"
4. **SE `accessState === "free_unused"`:**
   - Onboarding completa internamente (`onComplete(answers)`)
   - Modal de paywall aparece (z-index 280)
5. Criador escolhe:
   - **"Assinar agora":** Abre `openPaywallModal` → redirecionamento para checkout
   - **"Explorar grátis primeiro":** Fecha modal, permanece na plataforma com free tier

---

## Próximas Fases

### Fase B.1 — Gating de Features Pro
- Identificar quais features requerem Pro
- Implementar gates baseados em `accessState`
- Exemplo: pautas ilimitadas (Pro) vs. 1 por mês (Free)

### Fase B.2 — Opção de assinar em qualquer ponto
- Adicionar contexto `"onboarding_entry"` ao `PaywallContext` type
- Criar botão "Assinar" flutuante ou em headers
- Implementar em:
  - Diagnóstico Overview (card de stats)
  - Collab suggestions (card destacado)
  - Content ideas (quando limite atingido)

### Fase B.3 — Messaging e copy por estado
- Messaging diferenciado para:
  - Free tier de primeira vez
  - Free tier com limite atingido
  - Pro (nada, acesso completo)

---

## Testing

### Casos a validar:

1. **Free user (unused reading)**
   - Completa onboarding → paywall aparece
   - Escolhe "Assinar agora" → checkout
   - Escolhe "Explorar grátis" → modal fecha, volta pro perfil

2. **Pro user (any reading)**
   - Completa onboarding → nenhum paywall
   - Acesso completo a tudo

3. **Free user (preview_used)**
   - Completa onboarding → nenhum paywall
   - Pode fazer 1 reading, depois limita

---

## Notas Técnicas

- **Custom event flow:** "Assinar agora" ainda dispara `openPaywallModal` (event)
  - Permite reusar o fluxo de checkout existente
  - Logging/tracking automático via `PaywallModalProvider`
- **Z-index strategy:**
  - Onboarding: 270
  - Paywall modal: 280
  - Modal fica acima do onboarding, mas onboarding permanece visível
- **Estado compartilhado:** Modal reflete `accessState` da prop pai
  - Sem fetch adicional
  - Sincronizado com a verdade de subscription

---

## Próxima Fase: Fase B vs Roadmap

**Status de Fase B:** ✅ Implementado (paywall básico após primeiro sinal)

**Bloqueadores antes de Fase C:**
- Nenhum — Fase B é independente de features subsequentes

**Sugestão de próximo passo:**
- Fase B.1: Implementar gating de features (qual feature é Pro-only?)
- Ou: Retornar à Fase C (melhorias em collab matching)
