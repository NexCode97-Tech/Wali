-- Cobro por usuarios (10-nov): usuarios pagados del espacio, la bajada programada y de qué es cada cobro.
ALTER TABLE "crm_espacios" ADD COLUMN "usuarios" INTEGER;
ALTER TABLE "crm_espacios" ADD COLUMN "usuarios_prox" INTEGER;
ALTER TABLE "crm_espacios" ADD COLUMN "usuarios_prox_desde" TIMESTAMP(3);
ALTER TABLE "crm_pagos" ADD COLUMN "usuarios" INTEGER;
ALTER TABLE "crm_pagos" ADD COLUMN "concepto" TEXT;
