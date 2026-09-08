"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/features/auth/actions";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", redirectTo },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signIn(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      router.replace(result.data.redirectTo);
      // El layout es un Server Component: sin esto seguiría mostrando el
      // estado de "sin sesión" hasta la próxima navegación completa.
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="tu.nombre@pana.com.ar"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-destructive text-xs">{errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p className="text-destructive text-xs">{errors.password.message}</p>
        ) : null}
      </div>

      <input type="hidden" {...register("redirectTo")} />

      {formError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-subtle text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Entrando…
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
