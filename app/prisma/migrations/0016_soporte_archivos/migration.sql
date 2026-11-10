-- Adjuntos en los mensajes de soporte (10-nov): lista de {url, n, mime, t}.
ALTER TABLE "crm_solicitud_mensajes" ADD COLUMN "archivos" JSONB NOT NULL DEFAULT '[]';
