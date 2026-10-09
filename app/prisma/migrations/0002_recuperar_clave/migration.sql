-- CreateTable
CREATE TABLE "recuperaciones_clave" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "usado" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recuperaciones_clave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recuperaciones_clave_token_hash_key" ON "recuperaciones_clave"("token_hash");

-- CreateIndex
CREATE INDEX "recuperaciones_clave_user_id_idx" ON "recuperaciones_clave"("user_id");
