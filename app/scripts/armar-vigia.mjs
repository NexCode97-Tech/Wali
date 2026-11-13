// Empaqueta el vigilante de las pantallas (pantalla/compartido/vigia.js) con Sentry para el navegador en dist/vigia.js.
// Corre en `pnpm build`; el servidor lo sirve en /vigia.js (routes/vigia.ts).
import { build } from 'esbuild'

await build({
  entryPoints: ['pantalla/compartido/vigia.js'],
  outfile: 'dist/vigia.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  legalComments: 'none',
  logLevel: 'warning',
})
