-- BSUID de WhatsApp: el id de la persona cuando Meta no manda su número (usuarios con @usuario).
ALTER TABLE "crm_contactos" ADD COLUMN "wa_uid" TEXT;
CREATE UNIQUE INDEX "crm_contactos_espacio_id_wa_uid_key" ON "crm_contactos"("espacio_id", "wa_uid");
