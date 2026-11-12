/**
 * Copia dashboard/dist/ a firmware/protesis_ws/data/ (imagen LittleFS del ESP32),
 * comprimiendo HTML/JS/CSS con gzip. ESPAsyncWebServer sirve "archivo.gz" cuando
 * se pide "archivo", así que solo se guarda la versión comprimida (≈ 1/3 del tamaño).
 *
 * Uso: npm run build:esp32
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '..', 'dist');
const DATA = resolve(here, '..', '..', 'firmware', 'protesis_ws', 'data');
const GZIP_EXT = /\.(html|js|css|svg|json)$/i;
const LITTLEFS_MAX_NAME = 31; // longitud máxima de ruta por defecto en LittleFS (ESP32)

if (!existsSync(DIST)) {
  console.error('No existe dist/. Ejecuta primero "npm run build".');
  process.exit(1);
}

rmSync(DATA, { recursive: true, force: true });
mkdirSync(DATA, { recursive: true });

let total = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const src = join(dir, name);
    if (statSync(src).isDirectory()) {
      walk(src);
      continue;
    }
    const rel = relative(DIST, src).replaceAll('\\', '/');
    const gz = GZIP_EXT.test(name);
    const outRel = gz ? `${rel}.gz` : rel;
    if (outRel.length + 1 > LITTLEFS_MAX_NAME) console.warn(`⚠ Ruta larga para LittleFS: /${outRel}`);
    const out = join(DATA, outRel);
    mkdirSync(dirname(out), { recursive: true });
    const buf = readFileSync(src);
    const body = gz ? gzipSync(buf, { level: 9 }) : buf;
    writeFileSync(out, body);
    total += body.length;
    console.log(`  /${outRel.padEnd(34)} ${(body.length / 1024).toFixed(1).padStart(7)} kB`);
  }
};
walk(DIST);
console.log(`\n✔ ${(total / 1024).toFixed(1)} kB copiados a ${DATA}`);
console.log('  Siguiente paso: subir la imagen LittleFS (ver firmware/README.md).');
