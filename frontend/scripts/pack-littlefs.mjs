// Copia o build (dist/) para ../firmware/WebOS_ESP32/data/www comprimindo tudo em gzip.
// O firmware serve "arquivo.gz" com Content-Encoding: gzip.
// Só a pasta data/www é recriada: os outros arquivos de data/ (leia-me, grupo.json) são preservados.
import { gzipSync, constants } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from 'node:fs'
import { join, relative, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'dist')
const out = join(root, '..', 'firmware', 'WebOS_ESP32', 'data', 'www')
const PARTITION_BYTES = 0x160000          // partição "spiffs" do esquema padrão de 4 MB
const MAX_NAME = 31                       // limite seguro de nome no LittleFS
const MAX_PATH = 63

if (!existsSync(join(dist, 'index.html'))) { console.error('dist/index.html não encontrado: rode o build do Vite antes'); process.exit(1) }
rmSync(out, { recursive: true, force: true })

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
let raw = 0, packed = 0
const rows = []
for (const file of walk(dist)) {
  const rel = relative(dist, file).split('\\').join('/')
  const target = join(out, rel + '.gz')
  const fsPath = '/www/' + rel + '.gz'
  if (basename(target).length > MAX_NAME) { console.error(`nome longo demais para o LittleFS: ${rel}`); process.exit(1) }
  if (fsPath.length > MAX_PATH) { console.error(`caminho longo demais: ${fsPath}`); process.exit(1) }
  const buf = readFileSync(file)
  const gz = gzipSync(buf, { level: constants.Z_BEST_COMPRESSION })
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, gz)
  raw += buf.length; packed += gz.length
  rows.push([fsPath, buf.length, gz.length])
}
rows.sort((a, b) => b[2] - a[2])
for (const [p, r, g] of rows) console.log(`${p.padEnd(34)} ${String(r).padStart(8)} → ${String(g).padStart(7)} bytes`)
const kb = (n) => (n / 1024).toFixed(1) + ' KB'
console.log(`\ntotal: ${rows.length} arquivos, ${kb(raw)} → ${kb(packed)} gzip (${((packed / PARTITION_BYTES) * 100).toFixed(1)}% da partição de ${kb(PARTITION_BYTES)})`)
if (packed > PARTITION_BYTES * 0.8) { console.error('ERRO: a interface ocuparia mais de 80% do LittleFS'); process.exit(1) }
