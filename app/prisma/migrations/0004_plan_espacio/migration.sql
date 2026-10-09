-- AlterTable
ALTER TABLE "crm_espacios" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'starter',
ADD COLUMN "estado_plan" TEXT NOT NULL DEFAULT 'prueba',
ADD COLUMN "periodo" TEXT,
ADD COLUMN "prueba_hasta" TIMESTAMP(3),
ADD COLUMN "renueva_el" TIMESTAMP(3),
ADD COLUMN "cancela_al_final" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "creem_cliente" TEXT,
ADD COLUMN "creem_suscripcion" TEXT;

-- Los espacios que ya existen son de NexCode97: quedan internos, con todo y sin cobro.
UPDATE "crm_espacios" SET "plan" = 'business', "estado_plan" = 'interno';
