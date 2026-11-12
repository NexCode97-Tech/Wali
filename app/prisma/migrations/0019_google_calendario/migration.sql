-- Google Calendar de cada persona (12-nov): sus recordatorios de seguimiento se agendan ahí. El permiso va cifrado.
CREATE TABLE "crm_google_calendario" (
    "user_id" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "secreto" TEXT NOT NULL,
    "conectado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_google_calendario_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "crm_google_calendario" ADD CONSTRAINT "crm_google_calendario_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
