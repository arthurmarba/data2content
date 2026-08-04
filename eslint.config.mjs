import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "exports/**",
      "node_modules/**",
      "output/**",
      "public/**",
      "tmp/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-duplicate-enum-values": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Stripe']",
          message:
            "Não instancie Stripe diretamente. Use o cliente único de src/app/lib/stripe.ts.",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    files: ["src/app/lib/stripe.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
