import { PLANES } from "@/lib/precios-crm";

/** Los planes del CRM tal como salen en /precios. El CRM los lee de aquí para Ajustes → Plan y pagos. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(
    { planes: PLANES.map(({ id, nombre, mensual, anual, equivaleMes, ahorro, destacado, ficha, base, incluye }) => ({ id, nombre, mensual, anual, equivaleMes, ahorro, destacado: !!destacado, ficha, base: base ?? null, incluye })) },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
