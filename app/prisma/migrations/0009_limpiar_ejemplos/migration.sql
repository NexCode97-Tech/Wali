-- Empresas que heredaron los ejemplos de NexCode97 al abrir el CRM por primera vez (6-oct): se vacían solo las
-- claves que siguen siendo la copia de los ejemplos. Nada de lo que la empresa haya creado se toca; el espacio interno
-- de NexCode97 tampoco.
UPDATE "crm_ajustes" a SET "valor" = '[]'::jsonb, "updatedAt" = now()
FROM "crm_espacios" e
WHERE e."id" = a."espacio_id" AND e."estado_plan" <> 'interno' AND (
  (a."clave" = 'etapas' AND a."valor"::text LIKE '%Link errado%' AND a."valor"::text LIKE '%No interesado/perdido%')
  OR (a."clave" = 'etiquetas' AND a."valor"::text LIKE '%Pide descuento%' AND a."valor"::text LIKE '%Cliente frecuente%')
  OR (a."clave" = 'reglas' AND a."valor"::text LIKE '%Sin respuesta 48 horas%')
  OR (a."clave" = 'flujos' AND a."valor"::text LIKE '%Gracias por escribirnos%' AND jsonb_array_length(a."valor") <= 2)
);

-- Equipos de ejemplo sin nadie adentro: queda solo «Ventas», vacío.
UPDATE "crm_ajustes" a SET "valor" = '{"miembros":{"Ventas":[]},"ids":{"Ventas":[]}}'::jsonb, "updatedAt" = now()
FROM "crm_espacios" e
WHERE e."id" = a."espacio_id" AND e."estado_plan" <> 'interno' AND a."clave" = 'equipos'
  AND a."valor"->'miembros' ? 'Recuperación de ventas' AND a."valor"->'miembros' ? 'Soporte de ventas'
  AND NOT EXISTS (SELECT 1 FROM jsonb_each(COALESCE(a."valor"->'miembros', '{}'::jsonb)) m WHERE jsonb_typeof(m.value) = 'array' AND jsonb_array_length(m.value) > 0);

-- Los que nunca guardaron esas claves: vacías desde ya, para que la pantalla no mande los ejemplos.
INSERT INTO "crm_ajustes" ("espacio_id", "clave", "valor", "updatedAt")
SELECT e."id", k.clave, '[]'::jsonb, now()
FROM "crm_espacios" e CROSS JOIN (VALUES ('flujos')) AS k(clave)
WHERE e."estado_plan" <> 'interno'
ON CONFLICT DO NOTHING;
