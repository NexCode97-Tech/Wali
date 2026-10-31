-- Soporte (maqueta aprobada el 31-oct): solicitudes hechas desde el asistente del CRM y sus mensajes.
-- CreateTable
CREATE TABLE "crm_solicitudes" (
    "id" SERIAL NOT NULL,
    "espacio_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "prioridad" TEXT NOT NULL DEFAULT 'normal',
    "estado" TEXT NOT NULL DEFAULT 'abierta',
    "asunto" TEXT NOT NULL,
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "adjunto" TEXT,
    "vista" BOOLEAN NOT NULL DEFAULT true,
    "primera_respuesta_at" TIMESTAMP(3),
    "resuelta_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_solicitudes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_solicitud_mensajes" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "autor" TEXT NOT NULL,
    "autor_nombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_solicitud_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_solicitudes_estado_created_at_idx" ON "crm_solicitudes"("estado", "created_at");

-- CreateIndex
CREATE INDEX "crm_solicitudes_user_id_idx" ON "crm_solicitudes"("user_id");

-- CreateIndex
CREATE INDEX "crm_solicitud_mensajes_solicitud_id_created_at_idx" ON "crm_solicitud_mensajes"("solicitud_id", "created_at");

-- AddForeignKey
ALTER TABLE "crm_solicitudes" ADD CONSTRAINT "crm_solicitudes_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_solicitud_mensajes" ADD CONSTRAINT "crm_solicitud_mensajes_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "crm_solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

