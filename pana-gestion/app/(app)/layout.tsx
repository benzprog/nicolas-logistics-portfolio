import { redirect } from "next/navigation";

import { getCurrentUser, ROLE_LABELS } from "@/features/auth/server/session";
import { signOut } from "@/features/auth/actions";
import { getPendingQuestionsCount } from "@/features/mercadolibre/questions/queries";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { PanaMark } from "@/components/layout/pana-mark";

/**
 * Layout de todo lo que requiere sesión.
 *
 * El middleware ya redirige a quien no inició sesión; esta verificación es la
 * segunda cerradura: si algún día el matcher del middleware deja pasar una
 * ruta por error, acá no entra igual.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const pendingQuestions = await getPendingQuestionsCount();
  const badges = { pendingQuestions };

  return (
    <div className="flex min-h-svh">
      <aside className="border-sidebar-border bg-sidebar hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="border-sidebar-border flex h-14 shrink-0 items-center border-b px-5">
          <PanaMark />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav badges={badges} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/95 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
          <MobileNav badges={badges} />
          <div className="lg:hidden">
            <PanaMark />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu
              fullName={user.profile.full_name || user.email || "Usuario"}
              email={user.email}
              roleLabel={ROLE_LABELS[user.profile.role]}
              onSignOut={signOut}
            />
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
