"use client";

import { useTransition } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function UserMenu({
  fullName,
  email,
  roleLabel,
  onSignOut,
}: {
  fullName: string;
  email: string | null;
  roleLabel: string;
  onSignOut: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pr-2 pl-1.5">
          <span
            aria-hidden
            className="bg-secondary flex size-6 items-center justify-center rounded-full text-[11px] font-semibold"
          >
            {initials}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{fullName}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{fullName}</span>
          {email ? (
            <span className="text-muted-foreground truncate text-xs font-normal">{email}</span>
          ) : null}
          <span className="text-muted-foreground mt-1 text-xs font-normal">{roleLabel}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <a href="/configuracion">
            <UserIcon aria-hidden />
            Mi cuenta
          </a>
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await onSignOut();
            });
          }}
        >
          <LogOut aria-hidden />
          {pending ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
