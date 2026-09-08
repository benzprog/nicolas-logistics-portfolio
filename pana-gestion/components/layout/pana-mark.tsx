import { cn } from "@/lib/utils";

/**
 * Marca de PANA Gestión.
 *
 * El isotipo es un trazo cerrado, del mismo espíritu monolineal que el logo
 * de la marca. Va en SVG y no como imagen para que herede el color del tema
 * y no cueste una request más.
 */
export function PanaMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-7 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {/* La lámpara: el producto de la casa. */}
        <path d="M16 4a8 8 0 0 0-4.6 14.5c.6.4 1 1.1 1 1.9v1.1h7.2v-1.1c0-.8.4-1.5 1-1.9A8 8 0 0 0 16 4Z" />
        <path d="M13.4 25.4h5.2" />
        <path d="M14.2 28h3.6" />
      </svg>
      {/*
        El interlineado va suelto a propósito: con leading-none, la tilde de
        "GESTIÓN" se monta sobre el nombre de arriba.
      */}
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[15px] leading-none font-semibold tracking-tight">
          PANA
        </span>
        <span className="text-muted-foreground text-[10px] leading-none tracking-[0.18em] uppercase">
          Gestión
        </span>
      </div>
    </div>
  );
}
