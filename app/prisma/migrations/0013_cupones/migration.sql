-- Cupones de descuento del panel de superadministrador (31-oct): el cupón con que se pagó cada cobro y la tabla de cupones.
ALTER TABLE "crm_pagos" ADD COLUMN "cupon" TEXT;
ALTER TABLE "crm_pagos" ADD COLUMN "descuento" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "crm_pagos_cupon_idx" ON "crm_pagos"("cupon");

CREATE TABLE "crm_cupones" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "duracion" TEXT NOT NULL,
    "meses" INTEGER,
    "planes" TEXT[],
    "vence" TIMESTAMP(3),
    "max_usos" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "creado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_cupones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_cupones_codigo_key" ON "crm_cupones"("codigo");
