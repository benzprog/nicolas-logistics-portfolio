import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

/** Rutas que se pueden ver sin sesión. */
const PUBLIC_PATHS = ["/login", "/auth"];

/** Rutas que se autentican solas (secreto propio) y no usan cookies. */
const SELF_AUTHENTICATED_PREFIXES = ["/api/webhooks/", "/api/cron/"];

/**
 * Refresca la sesión de Supabase en cada request y saca del paso a quien no
 * inició sesión.
 *
 * Va en el middleware porque es el único lugar donde se pueden escribir las
 * cookies renovadas antes de que rendericen los Server Components.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  if (SELF_AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin configuración no se puede validar nada: mejor dejar pasar y que la
  // página muestre el error de configuración, en vez de un redirect infinito.
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida el token contra Supabase. getSession() solo lee la cookie,
  // que el navegador puede haber tocado: para decidir accesos no alcanza.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Se guarda solo la ruta interna, nunca una URL completa: si aceptáramos
    // una absoluta, tendríamos un redirect abierto.
    if (pathname !== "/") loginUrl.searchParams.set("volver", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}
