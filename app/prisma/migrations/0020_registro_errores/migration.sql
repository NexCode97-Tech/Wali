-- Registro interno de errores (24-nov): cada error o aviso de la plataforma, agrupado por huella.
CREATE TABLE "registro_errores" (
    "huella" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "ejemplo" JSONB NOT NULL DEFAULT '{}',
    "espacios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "veces" INTEGER NOT NULL DEFAULT 0,
    "primera" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'nuevo',

    CONSTRAINT "registro_errores_pkey" PRIMARY KEY ("huella")
);

CREATE INDEX "registro_errores_ultima_idx" ON "registro_errores"("ultima");
