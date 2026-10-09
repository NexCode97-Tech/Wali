-- Cambiar o recuperar la contraseña cierra las sesiones abiertas (revisión de seguridad, 8-oct).
ALTER TABLE "usuarios" ADD COLUMN "sesiones_desde" TIMESTAMP(3);
