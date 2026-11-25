-- Dispositivos que reciben las notificaciones push de Wali (25-nov).
CREATE TABLE "push_dispositivos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "agente" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_dispositivos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_dispositivos_endpoint_key" ON "push_dispositivos"("endpoint");
CREATE INDEX "push_dispositivos_user_id_idx" ON "push_dispositivos"("user_id");
