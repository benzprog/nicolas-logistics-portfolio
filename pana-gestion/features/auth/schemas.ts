import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Ingresá un email válido").trim().toLowerCase(),
  password: z.string().min(1, "Ingresá tu contraseña"),
  /** Ruta interna a la que volver después de entrar. Nunca una URL completa. */
  redirectTo: z
    .string()
    .optional()
    .transform((value) =>
      value && value.startsWith("/") && !value.startsWith("//") ? value : "/",
    ),
});

export type LoginInput = z.input<typeof loginSchema>;
