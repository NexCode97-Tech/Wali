-- CreateTable
CREATE TABLE "consentimientos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentimientos_user_id_idx" ON "consentimientos"("user_id");

-- CreateIndex
CREATE INDEX "consentimientos_email_idx" ON "consentimientos"("email");
