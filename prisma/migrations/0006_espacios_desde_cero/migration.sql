-- Las empresas nuevas empiezan desde cero (6-oct): sin las etapas, etiquetas ni reglas de ejemplo de NexCode97.
-- Los espacios de clientes (todos menos los internos) que nunca guardaron esos ajustes quedan con listas vacías;
-- los que ya los guardaron no cambian.
INSERT INTO "crm_ajustes" ("espacio_id", "clave", "valor", "updatedAt")
SELECT e."id", k.clave, '[]'::jsonb, now()
FROM "crm_espacios" e
CROSS JOIN (VALUES ('etapas'), ('etiquetas'), ('reglas')) AS k(clave)
WHERE e."estado_plan" <> 'interno'
ON CONFLICT DO NOTHING;
