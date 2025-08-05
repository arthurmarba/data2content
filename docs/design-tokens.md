# Design Tokens

## Cores da marca

As cores abaixo estão configuradas no `tailwind.config.ts` e podem ser utilizadas através das classes utilitárias do Tailwind.

| Nome        | Classe Tailwind         | Valor HEX |
|-------------|-------------------------|-----------|
| `brand-dark` | `text-brand-dark`, `bg-brand-dark`, `border-brand-dark` | `#191E1E` |
| `brand-red`  | `text-brand-red`, `bg-brand-red`, `border-brand-red`    | `#FF6B6B` |
| `brand-pink` | `text-brand-pink`, `bg-brand-pink`, `border-brand-pink` | `#FF85C0` |
| `brand-light`| `text-brand-light`, `bg-brand-light`, `border-brand-light` | `#F0F7F7` |

Exemplo de uso:

```tsx
<p className="text-brand-pink bg-brand-light">Texto com as cores da marca</p>
```
