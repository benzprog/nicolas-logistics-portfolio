import {
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  Truck,
  Boxes,
  Receipt,
  Factory,
  Settings,
  Store,
  Tag,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Módulos que todavía no existen: se muestran apagados para que se vea a dónde va esto. */
  comingSoon?: boolean;
  /** Clave del contador que se muestra a la derecha (por ahora solo preguntas pendientes). */
  badgeKey?: "pendingQuestions";
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

/**
 * La navegación completa del sistema.
 *
 * Los módulos que todavía no se construyeron figuran igual, apagados: sirve
 * para que quien lo usa entienda hacia dónde crece la herramienta, y para que
 * sumar uno sea agregar una carpeta en features/ y sacar `comingSoon` de acá.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "Mercado Libre",
    items: [
      {
        label: "Preguntas",
        href: "/mercadolibre/preguntas",
        icon: MessageSquare,
        badgeKey: "pendingQuestions",
      },
      { label: "Publicaciones", href: "/mercadolibre/publicaciones", icon: Tag, comingSoon: true },
      { label: "Ventas", href: "/mercadolibre/ventas", icon: Store, comingSoon: true },
      { label: "Configuración", href: "/mercadolibre/configuracion", icon: Settings },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { label: "Stock", href: "/stock", icon: Boxes, comingSoon: true },
      { label: "Productos", href: "/productos", icon: Package, comingSoon: true },
      { label: "Ventas", href: "/ventas", icon: ShoppingCart, comingSoon: true },
      { label: "Envíos", href: "/envios", icon: Truck, comingSoon: true },
      { label: "Proveedores", href: "/proveedores", icon: Factory, comingSoon: true },
      { label: "Facturación", href: "/facturacion", icon: Receipt, comingSoon: true },
    ],
  },
  {
    label: "Sistema",
    items: [{ label: "Configuración", href: "/configuracion", icon: Settings }],
  },
];

/** Título de la página según la ruta, para el encabezado y el <title>. */
export function findNavItem(pathname: string): NavItem | undefined {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  // La más específica primero: /mercadolibre/preguntas antes que /.
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
