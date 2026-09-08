import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Inter para la interfaz: aguanta bien las tablas densas y los números.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

// Poppins solo para la marca: es la tipografía del catálogo y de los flyers.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PANA Gestión", template: "%s · PANA Gestión" },
  description: "Sistema interno de gestión de PANA Iluminación.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
