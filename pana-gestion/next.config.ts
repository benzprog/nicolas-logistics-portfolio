import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next genera AGENTS.md y CLAUDE.md en cada build. Este proyecto documenta
  // sus convenciones en README.md y docs/, así que no hacen falta.
  agentRules: false,

  // Las cabeceras valen para toda la aplicación: es una herramienta interna y
  // no hay ninguna página que deba poder embeberse o indexarse.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
