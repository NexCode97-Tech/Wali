import { Router, Request, Response } from 'express'
import multer from 'multer'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { almacenListo } from '../services/almacen'
import { subirArchivo, nombreArchivo } from '../controllers/crm/_comun'

/** Subida de la foto de perfil. Los archivos de las conversaciones van por POST /crm/archivos. */
const router = Router()
const una = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file')

router.post('/imagen', authenticate, (req, res, next) => una(req, res, err => (err ? next(new ValidationError('La foto pesa más de 5 MB o no se pudo recibir.')) : next())), asyncHandler(async (req: Request, res: Response) => {
  const f = req.file
  if (!f) throw new ValidationError('No se recibió ningún archivo')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)) throw new ValidationError('Elige una foto JPG, PNG o WebP')
  if (!almacenListo()) throw new ValidationError('La subida de archivos no está configurada.')
  const url = await subirArchivo(f.buffer, nombreArchivo(f), f.mimetype, 'crm/perfiles')
  return ApiResponse.success(res, { url })
}))

export default router
