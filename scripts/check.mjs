// Verificación sin navegador: construye los módulos del modelo en Node y
// comprueba refs del catálogo, NaN y cajas envolventes (coordenadas MUNDO).
// Uso: node scripts/check.mjs [owner] [--boxes]
//   owner = head | neck | thorax | body (opcional, filtra el informe)
import * as THREE from 'three';
import { root, registry, allMeshes } from '../src/geo.js';
import { SECTIONS, INFO, ALIASES } from '../src/data/structures.js';

const owner = process.argv.find((a) => ['head', 'neck', 'thorax', 'body'].includes(a));
const boxes = process.argv.includes('--boxes');
const mods = owner ? [owner] : ['head', 'neck', 'thorax', 'body'];
let failed = false;
for (const m of mods) {
  try {
    const mod = await import(`../src/model/${m}.js`);
    const t0 = performance.now();
    mod.build();
    console.log(`✓ build ${m} (${(performance.now() - t0).toFixed(0)} ms)`);
  } catch (e) {
    failed = true;
    console.error(`✗ build ${m} FALLÓ:\n`, e);
  }
}
root.updateMatrixWorld(true);

// NaN / geometría vacía
let tris = 0, bad = 0;
for (const o of allMeshes) {
  const p = o.geometry.attributes.position;
  tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3;
  for (let i = 0; i < p.array.length; i++) if (!Number.isFinite(p.array[i])) { bad++; console.error('NaN en malla ref=', o.userData.ref); break; }
}
console.log(`mallas: ${allMeshes.length} · triángulos: ${Math.round(tris).toLocaleString()} · con NaN: ${bad}`);

// refs del catálogo
const catalogRefs = new Set();
for (const s of SECTIONS) for (const sub of s.subs) for (const [, items] of sub.groups) for (const it of items) if (it[2]) catalogRefs.add(it[2]);
const aliasParents = new Set(Object.keys(ALIASES));
const missing = [];
for (const ref of catalogRefs) {
  const own = INFO[ref]?.[0];
  if (owner && own !== owner) continue;
  const has = registry.has(ref) || (aliasParents.has(ref) && ALIASES[ref].some((c) => registry.has(c)));
  if (!has) missing.push(`${ref} (${own || 'sin INFO'})`);
}
const unknown = [...registry.keys()].filter((r) => !catalogRefs.has(r) && !INFO[r]);
console.log(`refs del catálogo${owner ? ' de ' + owner : ''}: ${[...catalogRefs].filter((r) => !owner || INFO[r]?.[0] === owner).length} · sin malla: ${missing.length}`);
if (missing.length) console.log('  FALTAN:', missing.join(', '));
if (unknown.length) console.log('  refs registradas que no están en el catálogo/INFO (ok si son contexto):', unknown.join(', '));

if (boxes) {
  const b = new THREE.Box3();
  for (const [ref, objs] of registry) {
    if (owner && INFO[ref]?.[0] !== owner) continue;
    b.makeEmpty(); objs.forEach((o) => b.expandByObject(o));
    const f = (v) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;
    console.log(`  ${ref.padEnd(32)} min ${f(b.min)} max ${f(b.max)}`);
  }
}
process.exit(failed || bad ? 1 : 0);
