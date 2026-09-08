import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Reglas de dependencia entre capas (ver docs/ARCHITECTURE.md).
 *
 *   app        -> features, components, lib
 *   features   -> services, lib, components
 *   services   -> lib
 *   lib        -> (nada del proyecto)
 *   components -> lib   (los componentes de UI no conocen el dominio)
 *
 * El objetivo es que el día que un módulo crezca no arrastre a los demás.
 */
const layerBoundaries = [
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/services/*", "@/app/*", "@/components/*"],
              message:
                "lib/ es infraestructura transversal: no puede depender de features, services, app ni components.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/app/*", "@/components/*"],
              message:
                "services/ es el cliente de una API externa: no conoce el dominio ni la UI. Pasale lo que necesite por parámetro.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*", "@/services/*"],
              message:
                "components/ es UI reutilizable y sin dominio. Si el componente necesita saber de preguntas, va en features/mercadolibre/questions/components.",
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerBoundaries,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "Usá now() de lib/time.ts en vez de new Date(): así los tests pueden congelar el reloj.",
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"]),
]);

export default eslintConfig;
