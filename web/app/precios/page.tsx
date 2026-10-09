import type { Metadata } from "next";
import { PieWali } from "@/components/pie";
import { PLANES, PREGUNTAS } from "@/lib/precios-crm";
import { PreciosCrm } from "./precios-crm";

const TITULO = "Precios | Wali";
const DESCRIPCION = `CRM multicanal desde USD ${Math.min(...PLANES.map((p) => p.mensual))} al mes: WhatsApp, Instagram, Messenger y correo en una bandeja. WhatsApp e IA sin recargo y 10 días gratis.`;

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/precios" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/precios", siteName: "Wali", locale: "es_CO", type: "website" },
  twitter: { card: "summary", title: TITULO, description: DESCRIPCION },
};

/** Para Google: el CRM con un precio por plan (mensual, en dólares) y las preguntas frecuentes de la página. */
const DATOS_ESTRUCTURADOS = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Wali",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://www.nexcode97.com/precios",
      description: DESCRIPCION,
      publisher: { "@type": "Organization", name: "NexCode97", url: "https://www.nexcode97.com" },
      offers: PLANES.map((p) => ({
        "@type": "Offer",
        name: `Plan ${p.nombre}`,
        price: String(p.mensual),
        priceCurrency: "USD",
        url: "https://www.nexcode97.com/precios",
        priceSpecification: { "@type": "UnitPriceSpecification", price: String(p.mensual), priceCurrency: "USD", unitText: "MONTH" },
      })),
    },
    {
      "@type": "FAQPage",
      mainEntity: PREGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

export default function Precios() {
  return (
    <main className="flex-1" style={{ background: "#09090e" }}>
      {/* JSON estático armado aquí mismo; "<" escapado para que nada cierre la etiqueta. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(DATOS_ESTRUCTURADOS).replace(/</g, "\\u003c") }} />
      <PreciosCrm />
      <PieWali />
    </main>
  );
}
