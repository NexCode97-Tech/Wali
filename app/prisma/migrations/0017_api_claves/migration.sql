-- Claves de la API pública (11-nov). Solo la huella SHA-256 de cada clave.
CREATE TABLE "crm_api_claves" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "nombre" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "permiso" TEXT NOT NULL,
    "vence_en" TIMESTAMP(3),
    "creada_por" TEXT NOT NULL,
    "ultimo_uso" TIMESTAMP(3),
    "revocada_en" TIMESTAMP(3),
    "revocada_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_api_claves_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_api_claves_huella_key" ON "crm_api_claves"("huella");
CREATE INDEX "crm_api_claves_espacio_id_idx" ON "crm_api_claves"("espacio_id");
ALTER TABLE "crm_api_claves" ADD CONSTRAINT "crm_api_claves_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
