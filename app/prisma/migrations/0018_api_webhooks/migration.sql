-- Webhooks de la API (11-nov): avisos a otros sistemas del cliente, con sus envíos y reintentos.
CREATE TABLE "crm_api_webhooks" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "eventos" TEXT[],
    "secreto" TEXT NOT NULL,
    "fallas" INTEGER NOT NULL DEFAULT 0,
    "pausado_en" TIMESTAMP(3),
    "creado_por" TEXT NOT NULL,
    "ultimo_envio" TIMESTAMP(3),
    "ultimo_estado" INTEGER,
    "ultimo_error" TEXT,
    "borrado_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_api_webhooks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_api_webhooks_espacio_id_idx" ON "crm_api_webhooks"("espacio_id");
ALTER TABLE "crm_api_webhooks" ADD CONSTRAINT "crm_api_webhooks_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "crm_api_envios" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "cuerpo" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_api_envios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_api_envios_estado_proximo_idx" ON "crm_api_envios"("estado", "proximo");
CREATE INDEX "crm_api_envios_webhook_id_idx" ON "crm_api_envios"("webhook_id");
ALTER TABLE "crm_api_envios" ADD CONSTRAINT "crm_api_envios_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "crm_api_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
