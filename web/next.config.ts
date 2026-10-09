import type { NextConfig } from "next";

/** El CRM de Wali corre en Railway y se sirve en /crm (CRM_BASE=/crm): se reenvía quitando el prefijo. */
const CRM_ORIGEN = "https://crm-production-9b97.up.railway.app";

const seguridad = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  async rewrites() {
    return {
      // El home es la maqueta aprobada (8-oct), tal cual: public/inicio.html.
      beforeFiles: [{ source: "/", destination: "/inicio.html" }],
      afterFiles: [
        { source: "/crm", destination: `${CRM_ORIGEN}/` },
        { source: "/crm/:path*", destination: `${CRM_ORIGEN}/:path*` },
      ],
      fallback: [],
    };
  },
  // Las cabeceras de seguridad van en todo menos /crm: el CRM manda las suyas y con dos CSP se rompe.
  async headers() {
    return [{ source: "/((?!crm$|crm/).*)", headers: seguridad }, { source: "/", headers: seguridad }];
  },
};

export default nextConfig;
