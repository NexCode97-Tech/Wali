-- CreateTable
CREATE TABLE "crm_pagos" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "creem_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "impuestos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "reembolso" INTEGER NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'USD',
    "desde" TIMESTAMP(3),
    "hasta" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_pagos_numero_key" ON "crm_pagos"("numero");
CREATE UNIQUE INDEX "crm_pagos_creem_id_key" ON "crm_pagos"("creem_id");
CREATE INDEX "crm_pagos_espacio_id_fecha_idx" ON "crm_pagos"("espacio_id", "fecha");

-- AddForeignKey
ALTER TABLE "crm_pagos" ADD CONSTRAINT "crm_pagos_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los recibos arrancan en NX-10001.
ALTER SEQUENCE "crm_pagos_numero_seq" RESTART WITH 10001;
