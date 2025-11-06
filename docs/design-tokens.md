# Design Tokens

## Cores da marca

As cores abaixo estão configuradas no `tailwind.config.ts` (seção `extend.colors`) e podem ser utilizadas através das classes utilitárias do Tailwind. O prefixo segue a estrutura `text-brand-magenta`, `bg-neutral-50`, etc.

| Grupo | Token | Classe base | Valor HEX | Uso recomendado |
|-------|-------|-------------|-----------|-----------------|
| brand | `magenta` | `bg-brand-magenta` | `#E74B6F` | CTAs primários, destaques emocionais |
| brand | `magenta-dark` | `hover:bg-brand-magenta-dark` | `#D54465` | Hover/active de CTAs |
| brand | `magenta-soft` | `bg-brand-magenta-soft` | `#FFF0F6` | Chips e planos com tom suave |
| brand | `rose-10` | `bg-brand-rose-10` | `#FFE9EE` | Etiquetas e badges discretos |
| brand | `blue` | `bg-brand-blue` | `#0B57D0` | CTAs orientados a dados, botões "solid" |
| brand | `blue-dark` | `hover:bg-brand-blue-dark` | `#094AB4` | Hover/active azul |
| brand | `blue-light` | `text-brand-blue-light` | `#4C8DFF` | Detalhes e ícones de dados |
| brand | `violet` | `text-brand-violet` | `#6C2DB5` | Gradientes frios e métricas |
| brand | `violet-light` | `text-brand-violet-light` | `#8A3CF1` | Complemento em gradientes |
| brand | `dark` | `text-brand-dark` | `#1C1C1E` | Títulos, corpo principal |
| brand | `text-secondary` | `text-brand-text-secondary` | `#6B6B6B` | Corpo secundário, descrições |
| brand | `glass-100` | `bg-brand-glass-100` | `#F6F8FB` | Fundos translúcidos claros |
| brand | `glass-200` | `bg-brand-glass-200` | `#F4F6FD` | Fundos translúcidos médios |
| brand | `glass-border` | `border-brand-glass-border` | `#E3E8F4` | Bordas de cartões glass |
| brand | `chip-border` | `border-brand-chip-border` | `#D8E1F5` | Chips/etiquetas |
| neutral | `0` | `bg-neutral-0` | `#FFFFFF` | Superfícies sólidas |
| neutral | `25` | `bg-neutral-25` | `#FDF3F8` | Testemunhais, seções emocionais |
| neutral | `50` | `bg-neutral-50` | `#F9FAFD` | Blocos de dados amplos |
| neutral | `75` | `bg-neutral-75` | `#F7F8FB` | Superfícies suaves |
| neutral | `100` | `bg-neutral-100` | `#F3F5FD` | Tabela de planos e cartões de comparação |
| neutral | `200` | `border-neutral-200` | `#E6E9F3` | Divisores e tabelas |
| neutral | `500` | `text-neutral-500` | `#55586A` | Texto auxiliar sobre fundos claros |

### Gradientes utilitários

Os gradientes recorrentes da landing estão registrados em `extend.backgroundImage`:

- `bg-landing-hero`: gradiente radial magenta para o Hero.
- `bg-landing-brand`: gradiente magenta translúcido (seção Para Marcas).
- `bg-landing-data`: gradiente azul/violeta para blocos de métricas.
- `bg-landing-testimonial`: gradiente rosa suave para depoimentos.

### Sombras e vidro

As superfícies "glass" utilizam `shadow-glass-md`, `shadow-glass-lg` e `shadow-glass-xl` com borda `border-brand-glass-border` e `backdrop-blur-glass`.

Exemplo rápido:

```tsx
<article className="bg-neutral-0 shadow-glass-lg border border-brand-glass-border backdrop-blur-glass">
  ...
</article>
```
