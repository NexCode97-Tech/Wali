-- Espacios de trabajo (6-oct): una cuenta con plan tiene varios espacios (Starter 1, Growth 3, Business 6).
ALTER TABLE "crm_espacios" ADD COLUMN "cuenta_id" TEXT;
CREATE INDEX "crm_espacios_cuenta_id_idx" ON "crm_espacios"("cuenta_id");
ALTER TABLE "usuarios" ADD COLUMN "espacio_activo" TEXT;
