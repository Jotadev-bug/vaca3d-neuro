// ─────────────────────────────────────────────────────────────
// p11/kit.js · Mini-CSG de campos de distancia con caja envolvente
// Cada primitiva devuelve { f(x,y,z), lo:[x,y,z], hi:[x,y,z] } para que
// la poligonización (marching cubes) use la caja mínima automáticamente.
// Mundo: +X craneal · +Y dorsal · +Z izquierda · metros.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { place, both, makeMaterial, noise3, tube } from '../../geo.js';
import { ellipsoid, rotInv, capsuleChain, smin, polygonize, organicFinish, splitGeometry } from '../abd/sdf.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const arr = (p) => (p.isVector3 ? [p.x, p.y, p.z] : p);

const box = (pts, r) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k] - r); hi[k] = Math.max(hi[k], p[k] + r); }
  return { lo, hi };
};

/** Elipsoide; rot = [rx,ry,rz] (Euler). */
export function E(c, r, rot = null) {
  c = arr(c);
  const f = ellipsoid(c, r, rot ? rotInv(...rot) : null);
  return { f, ...box([c], Math.max(...r)) };
}
/** Esfera. */
export function S(c, r) {
  c = arr(c);
  return { f: (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r, ...box([c], r) };
}
/** Cápsula de radio variable por una polilínea. */
export function K(pts, rad) {
  pts = pts.map(arr);
  const rr = Array.isArray(rad) ? rad : pts.map(() => rad);
  return { f: capsuleChain(pts, rr), ...box(pts, Math.max(...rr)) };
}
/** Distancia de un punto a una caja (0 dentro): cota inferior de la SDF de lo que contiene. */
const boxDist = (b, x, y, z) => Math.hypot(Math.max(b.lo[0] - x, 0, x - b.hi[0]), Math.max(b.lo[1] - y, 0, y - b.hi[1]), Math.max(b.lo[2] - z, 0, z - b.hi[2]));
/** Unión suave (k = radio del pliegue). Descarta por caja las partes lejanas (sin efecto en smin). */
export function U(parts, k = 0.01) {
  const fs = parts.map((p) => p.f);
  const lo = [0, 1, 2].map((i) => Math.min(...parts.map((p) => p.lo[i])));
  const hi = [0, 1, 2].map((i) => Math.max(...parts.map((p) => p.hi[i])));
  return { f: (x, y, z) => {
    let d = Infinity;
    for (let i = 0; i < fs.length; i++) {
      if (d !== Infinity && boxDist(parts[i], x, y, z) > d + k) continue;
      const b = fs[i](x, y, z);
      d = d === Infinity ? b : smin(d, b, k);
    }
    return d === Infinity ? boxDist({ lo, hi }, x, y, z) + 0.01 : d;
  }, lo, hi };
}
/** Índice del componente más cercano (con descarte por caja). */
export function nearestPart(list) {
  return (x, y, z) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
      if (boxDist(list[i], x, y, z) > bd) continue;
      const d = list[i].f(x, y, z); if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  };
}
/** Resta suave a − b. */
export function D(a, b, k = 0.004) {
  return { ...a, f: (x, y, z) => -smin(-a.f(x, y, z), b.f(x, y, z), k) };
}
/** Intersección (recorte) a ∩ b. */
export function I(a, b, k = 0.002) {
  return { ...a, f: (x, y, z) => -smin(-a.f(x, y, z), -b.f(x, y, z), k) };
}
/** Pared hueca de grosor t; inner(x,y,z) > 0 abulta la mucosa hacia la luz. */
export function H(a, t, inner = null) {
  return { ...a, f: (x, y, z) => { const d = a.f(x, y, z); return Math.max(d, -(d + t) - (inner ? inner(x, y, z) : 0)); } };
}
/** Desplaza la superficie (relieve): d − amp·g(x,y,z). */
export function W(a, g) { return { ...a, f: (x, y, z) => a.f(x, y, z) - g(x, y, z) }; }
/** Semiespacio n·p < h (para cortar). */
export const plane = (n, h) => (x, y, z) => n[0] * x + n[1] * y + n[2] * z - h;

export const PROF = {};
/** Factor global de resolución de las SDF de la P11 (↑ = menos triángulos, carga más rápida). */
export const COARSE = 1.4;
/** Poligoniza un campo con su caja (margen pad). */
export function mesh(s, step = 0.005, ao = 0.02, pad = 0.008, tag = '?') {
  step *= COARSE;
  const lo = s.lo.map((v) => v - pad), hi = s.hi.map((v) => v + pad);
  const t0 = performance.now();
  const g = polygonize(s.f, lo, hi, step, { ao, sparse: true });
  PROF[tag] = (PROF[tag] || 0) + performance.now() - t0;
  return g;
}

/** Material con color horneado por vértice. */
function finished(geo, kind, color, fin = {}, mat = {}) {
  organicFinish(geo, noise3, { aoK: 0.5, mottle: 0.06, bump: 0.18, freq: 110, ...fin, color });
  const m = makeMaterial(kind, { ...mat, color: '#ffffff' });
  m.vertexColors = true;
  return new THREE.Mesh(geo, m);
}

/**
 * Parte SDF registrada. o: { step, kind, color, layer, fin, mat, mirror, ao }
 * mirror=true → se crea también la copia derecha (z → −z).
 */
export function part(ref, s, o = {}) {
  const g = mesh(s, (o.step ?? 0.005) / (o.thin ? COARSE : 1), o.ao ?? 0.02, 0.008, ref);
  if (!g.index || g.index.count === 0) { console.warn('[p11] malla vacía', ref); return null; }
  const m = finished(g, o.kind || 'bone', o.color || '#ece2cc', o.fin, o.mat);
  return o.mirror ? both(ref, m, o.layer) : place(ref, m, o.layer);
}

/**
 * Parte SDF troceada por regiones. classify(cx,cy,cz,nx,ny,nz) → clave.
 * styles[clave] = { ref, kind, color, layer, fin, mat } (sin entrada → se descarta).
 */
export function parts(s, classify, styles, o = {}) {
  const g = mesh(s, (o.step ?? 0.005) / (o.thin ? COARSE : 1), o.ao ?? 0.02, 0.008, Object.values(styles)[0]?.ref);
  const out = {};
  for (const [key, geo] of splitGeometry(g, classify)) {
    const st = styles[key]; if (!st) continue;
    const m = finished(geo, st.kind || o.kind || 'bone', st.color || o.color, { ...(o.fin || {}), ...(st.fin || {}) }, { ...(o.mat || {}), ...(st.mat || {}) });
    const rf = 'ref' in st ? st.ref : key;
    out[key] = o.mirror ? both(rf, m, st.layer || o.layer) : place(rf, m, st.layer || o.layer);
  }
  return out;
}

/** Tubo sin registrar (para agrupar). */
export function tubeMesh(pts, r, kind, o = {}) {
  const segs = o.segs ?? clamp(pts.length * 6, 12, 72);
  return tube(pts.map((p) => (p.isVector3 ? p : V(p[0], p[1], p[2]))), r, kind, { radial: o.radial ?? 8, ...o, segs, mat: { ...(o.mat || {}), ...(o.color ? { color: o.color } : {}) } });
}
/**
 * Lámina (cinta) entre dos polilíneas a y b: malla paramétrica de doble cara.
 * o: { nu, nv, bulge:[x,y,z] (abombamiento en el centro), hole(x,y,z)→bool, kind, color, mat, layer, mirror }
 */
export function ribbonMesh(a, b, o = {}) {
  const nu = o.nu ?? 20, nv = o.nv ?? 6, bu = o.bulge || [0, 0, 0];
  const pos = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    const pa = sampleLine(a, i / nu), pb = sampleLine(b, i / nu);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv, w = 4 * v * (1 - v);
      let p = [lerp(pa[0], pb[0], v) + bu[0] * w, lerp(pa[1], pb[1], v) + bu[1] * w, lerp(pa[2], pb[2], v) + bu[2] * w];
      if (o.map) p = o.map(p);
      pos.push(p[0], p[1], p[2]);
    }
  }
  const at = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const q = i * (nv + 1) + j, r = q + nv + 1;
    if (o.hole) { const A = at(q), B = at(r + 1); if (o.hole((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2)) continue; }
    idx.push(q, r, q + 1, r, r + 1, q + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, makeMaterial(o.kind || 'ligament', { side: THREE.DoubleSide, ...(o.mat || {}), ...(o.color ? { color: o.color } : {}) }));
}
export function R(ref, a, b, o = {}) {
  const m = ribbonMesh(a, b, o);
  return o.mirror ? both(ref, m, o.layer) : place(ref, m, o.layer);
}
/** Tubo (vaso, nervio, tendón) por puntos [x,y,z]; mirror opcional. */
export function T(ref, pts, r, kind, o = {}) {
  const t = tubeMesh(pts, r, kind, o);
  return o.mirror ? both(ref, t, o.layer) : place(ref, t, o.layer);
}
/** Disco elíptico plano (sin registrar): centro c, semiejes rx/ry, normal n, eje "arriba" up (→ ry). */
export function diskMesh(c, rx, ry, n, up, color, opacity = 0.2) {
  const g = new THREE.CircleGeometry(1, 48);
  g.scale(rx, ry, 1);
  const N = V(...n).normalize();
  const Y = V(...up); Y.addScaledVector(N, -Y.dot(N)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, N);
  const m = new THREE.Mesh(g, makeMaterial('area', { color, opacity, side: THREE.DoubleSide }));
  m.matrixAutoUpdate = true;
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, N));
  m.position.set(...c);
  return m;
}

/** Músculo fusiforme: cápsula por puntos con radios; capa músculo, ambos lados por defecto. */
export function M(ref, pts, rad, color = '#c4554f', o = {}) {
  return part(ref, K(pts, rad), { kind: o.kind || 'muscle', color, layer: 'musculo', step: o.step ?? 0.006, mirror: o.mirror ?? true,
    fin: { aoK: 0.45, bump: 0.35, freq: 160, mottle: 0.05, ...(o.fin || {}) }, mat: o.mat, ao: 0.02 });
}

/** Lámina fina entre dos polilíneas (ligamentos, mesos, fascias). */
export function sheet(a, b, r = 0.004, n = 8, k = 0.02) {
  const segs = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const pa = sampleLine(a, t), pb = sampleLine(b, t);
    segs.push(K([pa, lerp3(pa, pb, 0.5), pb], r));
  }
  return U(segs, k);
}
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export function sampleLine(pts, t) {
  pts = pts.map(arr);
  if (pts.length === 1) return pts[0];
  const f = clamp(t, 0, 1) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f));
  return lerp3(pts[i], pts[i + 1], f - i);
}
/** Puntos de un anillo (círculo) de centro c, normal n, radio r. */
export function ringPts(c, n, r, seg = 24, rz = r) {
  const N = new THREE.Vector3(...arr(n)).normalize();
  const a = Math.abs(N.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(N, a).normalize(), w = new THREE.Vector3().crossVectors(N, u);
  const C = V(...arr(c)), out = [];
  for (let i = 0; i <= seg; i++) { const t = (i / seg) * Math.PI * 2; out.push(C.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(w, Math.sin(t) * rz)); }
  return out;
}
/** Dist. de un punto a una polilínea. */
export function distLine(pts, x, y, z) {
  pts = pts.map(arr);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    const L2 = bx * bx + by * by + bz * bz || 1e-9;
    const t = clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / L2, 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - bx * t, y - a[1] - by * t, z - a[2] - bz * t));
  }
  return best;
}
/** Proyección del punto sobre la polilínea: parámetro t∈[0,1]. */
export function paramLine(pts, x, y, z) {
  pts = pts.map(arr);
  let best = Infinity, bt = 0, acc = 0;
  const lens = []; let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(...[0, 1, 2].map((k) => pts[i + 1][k] - pts[i][k])); lens.push(l); total += l; }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    const L2 = bx * bx + by * by + bz * bz || 1e-9;
    const t = clamp(((x - a[0]) * bx + (y - a[1]) * by + (z - a[2]) * bz) / L2, 0, 1);
    const d = Math.hypot(x - a[0] - bx * t, y - a[1] - by * t, z - a[2] - bz * t);
    if (d < best) { best = d; bt = (acc + t * lens[i]) / total; }
    acc += lens[i];
  }
  return bt;
}
/** Group con varias mallas registradas juntas. */
export function group(ref, objs, layer, mirror = false) {
  const g = new THREE.Group(); objs.forEach((o) => g.add(o));
  return mirror ? both(ref, g, layer) : place(ref, g, layer);
}
export { THREE, noise3 };
