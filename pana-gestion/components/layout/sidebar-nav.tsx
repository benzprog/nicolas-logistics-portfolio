"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "@/components/layout/nav-config";

export type NavBadges = {
  pendingQuestions?: number;
};

export function SidebarNav({
  badges,
  onNavigate,
}: {
  badges?: NavBadges;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6 px-3 py-4" aria-label="Navegación principal">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? `grupo-${index}`} className="flex flex-col gap-1">
          {group.label ? (
            <p className="text-muted-foreground px-3 pb-1 text-xs font-medium tracking-wider uppercase">
              {group.label}
            </p>
          ) : null}

          {group.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
            const Icon = item.icon;

            if (item.comingSoon) {
              return (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title="Todavía no está disponible"
                  className="text-muted-foreground/60 flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[10px] tracking-wide uppercase opacity-70">
                    pronto
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {/* El ámbar de la marca marca dónde estás parado. */}
                {active ? (
                  <span
                    aria-hidden
                    className="bg-brand absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  />
                ) : null}
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
                {badge && badge > 0 ? (
                  <span className="tabular bg-brand text-brand-foreground ml-auto rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
