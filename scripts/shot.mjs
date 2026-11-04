// Captura headless con Chrome (WebGL por SwiftShader).
// Requiere el servidor de desarrollo en http://127.0.0.1:5173
// Uso: node scripts/shot.mjs "<query>" <salida.png> [ancho] [alto]
//   query ejemplos:
//     "view=cabeza&layers=hueso,seno"          vista + capas visibles
//     "view=cabeza&clip=sag:0"                 corte sagital en z=0
//     "view=torax_izq&clip=tr:0.05"            corte transversal en x=0.05
//     "solo=head"                              solo un módulo (head|neck|thorax|body)
//     "sel=gl_parotida"                        selecciona y centra una ref
//     "cam=1.6,1.2,0.9&target=1.2,1.0,0"       cámara libre
//     "ui=0"                                   oculta la interfaz
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, existsSync } from 'node:fs';

const [query = '', out = 'shot.png', w = '1400', h = '900'] = process.argv.slice(2);
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
// el parámetro t evita capturas cacheadas de la misma URL
const url = `http://127.0.0.1:5173/?shot=1&t=${Date.now()}&${query}`;
const file = resolve(out);
// perfil efímero fuera del proyecto (el watcher de Vite no lo ve)
const profile = join(tmpdir(), 'vaca3d-shot', `${process.pid}-${Date.now()}`);
try { rmSync(file, { force: true }); } catch { /* sin captura previa */ }
const r = spawnSync(chrome, [
  '--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  `--window-size=${w},${h}`, '--virtual-time-budget=15000',
  `--user-data-dir=${profile}`,
  `--screenshot=${file}`, url,
], { encoding: 'utf8', timeout: 120000 });
try { rmSync(profile, { recursive: true, force: true }); } catch { /* perfil en uso */ }
if (r.error) { console.error(r.error); process.exit(1); }
// Chrome en Windows puede terminar de escribir la captura tras salir: espera hasta 30 s
for (let i = 0; i < 60 && !existsSync(file); i++) await new Promise((ok) => setTimeout(ok, 500));
await new Promise((ok) => setTimeout(ok, 400));
if (!existsSync(file)) { console.error(`✗ no se escribió ${file}`); process.exit(1); }
console.log(`captura → ${file}`);
