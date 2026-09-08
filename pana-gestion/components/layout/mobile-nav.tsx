"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav, type NavBadges } from "@/components/layout/sidebar-nav";
import { PanaMark } from "@/components/layout/pana-mark";

/** En pantallas chicas el sidebar se guarda detrás de este botón. */
export function MobileNav({ badges }: { badges?: NavBadges }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir navegación">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar w-72 p-0">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div className="border-sidebar-border flex h-14 items-center border-b px-5">
          <PanaMark />
        </div>
        <div className="overflow-y-auto">
          <SidebarNav badges={badges} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
