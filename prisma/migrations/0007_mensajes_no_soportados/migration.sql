-- Los mensajes que WhatsApp no pasa (ver una vez, encuestas, ubicación en vivo) que ya habían llegado: con la
-- explicación nueva en vez de «tipo que el CRM todavía no muestra» (6-oct).
UPDATE "crm_mensajes"
SET "datos" = jsonb_set("datos", '{in}', to_jsonb('La persona mandó algo que WhatsApp solo deja ver en el celular: una foto o un video de «ver una vez», una encuesta, su ubicación en tiempo real o un mensaje de un tipo nuevo. Pídele que lo mande de otra forma: la foto o el video normal, la ubicación fija o la respuesta escrita.'::text))
WHERE "tipo" = 'in' AND "datos"->>'tipoWa' = 'unsupported';
