-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LIDER', 'AGENTE', 'LECTOR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "image" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENTE',
    "suspendido" BOOLEAN NOT NULL DEFAULT false,
    "operador" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_ingreso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contactos" (
    "id" SERIAL NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "numero" SERIAL NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "fb_id" TEXT,
    "ig_id" TEXT,
    "tg_id" TEXT,
    "tt_id" TEXT,
    "correo" TEXT,
    "canal" TEXT NOT NULL DEFAULT 'wa',
    "etapa" TEXT,
    "asignado_id" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campos" JSONB NOT NULL DEFAULT '{}',
    "ficha" JSONB NOT NULL DEFAULT '{}',
    "pauta" JSONB,
    "menor" BOOLEAN NOT NULL DEFAULT false,
    "autorizacion" JSONB,
    "representante" JSONB,
    "rne" JSONB,
    "no_contactar" JSONB,
    "permiso_llamada" JSONB,
    "guardado" BOOLEAN NOT NULL DEFAULT false,
    "externo_id" TEXT,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lineas" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "conexion_id" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "waba_id" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'conectada',
    "calidad" TEXT,
    "limite" TEXT,
    "ajustes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_conversaciones" (
    "id" SERIAL NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "contacto_id" INTEGER NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'wa',
    "linea_id" TEXT,
    "conexion_id" TEXT,
    "asignado_id" TEXT,
    "equipo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'abiertas',
    "prioridad" TEXT,
    "solo_lider" BOOLEAN NOT NULL DEFAULT false,
    "motivo_fin" TEXT,
    "finalizada_at" TIMESTAMP(3),
    "encuestada" BOOLEAN NOT NULL DEFAULT false,
    "recs" JSONB NOT NULL DEFAULT '[]',
    "no_leidos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_mensaje_at" TIMESTAMP(3),
    "ultimo_entrante_at" TIMESTAMP(3),
    "espera_desde" TIMESTAMP(3),
    "extra" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_conversaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_mensajes" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "conversacion_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "autor_id" TEXT,
    "wa_id" TEXT,
    "estado" TEXT,
    "error" TEXT,
    "programado_para" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_ajustes" (
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "actualizado_por_id" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_ajustes_pkey" PRIMARY KEY ("espacio_id","clave")
);

-- CreateTable
CREATE TABLE "crm_preferencias" (
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "user_id" TEXT NOT NULL,
    "valor" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_preferencias_pkey" PRIMARY KEY ("espacio_id","user_id")
);

-- CreateTable
CREATE TABLE "crm_webhook_eventos" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT,
    "conexion_id" TEXT,
    "cuerpo" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_webhook_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_espacios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_espacios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_enlaces" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "linea_id" TEXT,
    "mensaje" TEXT NOT NULL DEFAULT 'Hola, quiero más información',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_enlaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_clics" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "enlace_id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "huella" TEXT,
    "referer" TEXT,
    "contacto_id" INTEGER,
    "conversacion_id" INTEGER,
    "atribuido_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_clics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_miembros" (
    "espacio_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_miembros_pkey" PRIMARY KEY ("espacio_id","user_id")
);

-- CreateTable
CREATE TABLE "crm_conexiones" (
    "id" TEXT NOT NULL,
    "espacio_id" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'manual',
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "error" TEXT,
    "datos" JSONB NOT NULL DEFAULT '{}',
    "secretos" TEXT,
    "clave" TEXT NOT NULL,
    "verificado_en" TIMESTAMP(3),
    "ultimo_evento_en" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_conexiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contenido_id" TEXT,
    "leida_en" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_app" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_app_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_numero_key" ON "crm_contactos"("numero");

-- CreateIndex
CREATE INDEX "crm_contactos_asignado_id_idx" ON "crm_contactos"("asignado_id");

-- CreateIndex
CREATE INDEX "crm_contactos_correo_idx" ON "crm_contactos"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_espacio_id_telefono_key" ON "crm_contactos"("espacio_id", "telefono");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_espacio_id_fb_id_key" ON "crm_contactos"("espacio_id", "fb_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_espacio_id_ig_id_key" ON "crm_contactos"("espacio_id", "ig_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_espacio_id_tg_id_key" ON "crm_contactos"("espacio_id", "tg_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contactos_espacio_id_tt_id_key" ON "crm_contactos"("espacio_id", "tt_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lineas_phone_number_id_key" ON "crm_lineas"("phone_number_id");

-- CreateIndex
CREATE INDEX "crm_lineas_espacio_id_idx" ON "crm_lineas"("espacio_id");

-- CreateIndex
CREATE INDEX "crm_lineas_conexion_id_idx" ON "crm_lineas"("conexion_id");

-- CreateIndex
CREATE INDEX "crm_conversaciones_espacio_id_estado_ultimo_mensaje_at_idx" ON "crm_conversaciones"("espacio_id", "estado", "ultimo_mensaje_at");

-- CreateIndex
CREATE INDEX "crm_conversaciones_conexion_id_idx" ON "crm_conversaciones"("conexion_id");

-- CreateIndex
CREATE INDEX "crm_conversaciones_estado_ultimo_mensaje_at_idx" ON "crm_conversaciones"("estado", "ultimo_mensaje_at");

-- CreateIndex
CREATE INDEX "crm_conversaciones_asignado_id_idx" ON "crm_conversaciones"("asignado_id");

-- CreateIndex
CREATE INDEX "crm_conversaciones_contacto_id_idx" ON "crm_conversaciones"("contacto_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_mensajes_wa_id_key" ON "crm_mensajes"("wa_id");

-- CreateIndex
CREATE INDEX "crm_mensajes_conversacion_id_createdAt_idx" ON "crm_mensajes"("conversacion_id", "createdAt");

-- CreateIndex
CREATE INDEX "crm_mensajes_programado_para_idx" ON "crm_mensajes"("programado_para");

-- CreateIndex
CREATE INDEX "crm_mensajes_espacio_id_createdAt_idx" ON "crm_mensajes"("espacio_id", "createdAt");

-- CreateIndex
CREATE INDEX "crm_webhook_eventos_estado_createdAt_idx" ON "crm_webhook_eventos"("estado", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_enlaces_codigo_key" ON "crm_enlaces"("codigo");

-- CreateIndex
CREATE INDEX "crm_enlaces_espacio_id_idx" ON "crm_enlaces"("espacio_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_clics_ref_key" ON "crm_clics"("ref");

-- CreateIndex
CREATE INDEX "crm_clics_enlace_id_created_at_idx" ON "crm_clics"("enlace_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_clics_espacio_id_created_at_idx" ON "crm_clics"("espacio_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_miembros_user_id_idx" ON "crm_miembros"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "crm_conexiones_clave_key" ON "crm_conexiones"("clave");

-- CreateIndex
CREATE INDEX "crm_conexiones_espacio_id_tipo_idx" ON "crm_conexiones"("espacio_id", "tipo");

-- CreateIndex
CREATE INDEX "notificaciones_user_id_leida_en_idx" ON "notificaciones"("user_id", "leida_en");

-- CreateIndex
CREATE INDEX "notificaciones_user_id_createdAt_idx" ON "notificaciones"("user_id", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "config_app_clave_key" ON "config_app"("clave");

-- AddForeignKey
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lineas" ADD CONSTRAINT "crm_lineas_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lineas" ADD CONSTRAINT "crm_lineas_conexion_id_fkey" FOREIGN KEY ("conexion_id") REFERENCES "crm_conexiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversaciones" ADD CONSTRAINT "crm_conversaciones_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversaciones" ADD CONSTRAINT "crm_conversaciones_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "crm_contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversaciones" ADD CONSTRAINT "crm_conversaciones_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "crm_lineas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversaciones" ADD CONSTRAINT "crm_conversaciones_conexion_id_fkey" FOREIGN KEY ("conexion_id") REFERENCES "crm_conexiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensajes" ADD CONSTRAINT "crm_mensajes_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_mensajes" ADD CONSTRAINT "crm_mensajes_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "crm_conversaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_ajustes" ADD CONSTRAINT "crm_ajustes_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_preferencias" ADD CONSTRAINT "crm_preferencias_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_enlaces" ADD CONSTRAINT "crm_enlaces_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_clics" ADD CONSTRAINT "crm_clics_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_clics" ADD CONSTRAINT "crm_clics_enlace_id_fkey" FOREIGN KEY ("enlace_id") REFERENCES "crm_enlaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_miembros" ADD CONSTRAINT "crm_miembros_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conexiones" ADD CONSTRAINT "crm_conexiones_espacio_id_fkey" FOREIGN KEY ("espacio_id") REFERENCES "crm_espacios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

