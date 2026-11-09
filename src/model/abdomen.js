// ─────────────────────────────────────────────────────────────
// abdomen.js · Módulo ABDOMEN (Práctica 10)
// Estómago (rumen-retículo, omaso, abomaso) hueco y con relieve interno,
// hígado lobulado con impresiones, bazo, intestinos (colon espiral),
// páncreas, riñones lobulados con interior, omentos, pared abdominal por
// capas, nervios T13-L2, canal inguinal, regiones y referencias palpables.
// Mundo: +X craneal · +Y dorsal (suelo y=0) · +Z lado IZQUIERDO · metros.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { place, tube, blob, marker, ring, pathLine, makeMaterial, noise3, V, lerp } from '../geo.js';
import { HINDLIMB, ribPath, cartilagePath, costalArch, costochondral } from '../frame.js';
import { bodyPoint, wallNormal } from './body/surface.js';
import {
  ellipsoid, rotInv, sphere, capsuleChain, smin, smax, unionAll, nearest, gradient, snap,
  polygonize, splitGeometry, hollow, organicFinish,
} from './abd/sdf.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toV = (p) => (p.isVector3 ? p : V(p[0], p[1], p[2]));

// ── paleta ──
const C = {
  rumenOut: '#b3a487', rumenIn: '#6b5236', retIn: '#5a4532', fat: '#f0d98c',
  omasoOut: '#b59a7c', omasoIn: '#7a5a3c', lamina: '#8a6a48',
  aboOut: '#d2a08e', aboIn: '#c4605c', fold: '#b04c4c',
  liver: '#7b2f2a', liverImp: '#93413a', gall: '#4f7a3a',
  spleen: '#6a4a72', kidney: '#8a2f2f', medulla: '#5a1e2a', papilla: '#e9b3a8', calyx: '#f1dc9a',
  small: '#e0aa9c', colon: '#cfab90', cecum: '#c8a58a', rectum: '#c99a86',
  pancreas: '#e8c08e', omentum: '#f1dea0', lymph: '#6cc08a',
};
const M = (kind, color, extra = {}) => ({ kind, mat: { color, ...extra } });

/** Crea y registra mallas a partir de un Map clave→geometría. style(key) → {kind, mat, layer, ref} */
function emit(parts, style, finish = {}) {
  for (const [key, geo] of parts) {
    const s = style(key); if (!s) continue;
    // acabado orgánico: color horneado (oclusión, moteado, grasa en surcos) + microrrelieve
    const fin = { ...finish, ...(s.fin || {}) };
    organicFinish(geo, noise3, { ...fin, color: s.mat.color });
    const mat = makeMaterial(s.kind, { ...s.mat, color: '#ffffff' });
    mat.vertexColors = true;
    place(s.ref ?? key, new THREE.Mesh(geo, mat), s.layer || 'viscera');
  }
}
/** Tubo que sigue una lista de puntos [x,y,z]. */
const T = (pts, r, color, opts = {}) => tube(pts.map(toV), r, opts.kind || 'stomach', { ...opts, mat: { color, roughness: 0.55, clearcoat: 0.3, ...(opts.mat || {}) } });

export function build() {
  const stomach = buildRuminoreticulum();
  const omaso = buildOmasum();
  const abo = buildAbomasum();
  const kidneys = buildKidneys();
  buildLiver({ ret: stomach.ret, omaso: omaso.f, kidneyR: kidneys.right });
  buildSpleen();
  buildIntestines();
  buildPancreasVessels();
  buildOmenta();
  buildWall();
  buildRegions();
  void abo;
}

// ═════════════════════════════════════════════════════════════
// 1 · RUMEN + RETÍCULO (una sola cavidad: ruminorretículo)
// ═════════════════════════════════════════════════════════════
const RUMEN = {
  ret:   { c: [-0.43, 0.77, 0.06], r: [0.085, 0.13, 0.15] },
  atrio: { c: [-0.62, 0.90, 0.13], r: [0.15, 0.17, 0.17] },
  sd:    { c: [-0.90, 0.99, 0.14], r: [0.32, 0.14, 0.19] },
  ccd:   { c: [-1.24, 1.03, 0.13], r: [0.13, 0.10, 0.16] },
  sv:    { c: [-0.90, 0.77, 0.08], r: [0.31, 0.14, 0.25] },
  ccv:   { c: [-1.28, 0.86, 0.10], r: [0.15, 0.11, 0.18] },
};
const RUMEN_T = 0.016;
const arcX = (x0, x1, y, z, n = 9) => Array.from({ length: n }, (_, i) => [lerp(x0, x1, i / (n - 1)), y, z]);
const RUMEN_GROOVES = {
  surco_long_izq: arcX(-0.66, -1.16, 0.87, 0.42),
  surco_long_dcho: arcX(-0.70, -1.14, 0.87, -0.22),
  surco_acc_izq: [[-0.86, 0.87, 0.40], [-0.96, 0.93, 0.38], [-1.06, 0.97, 0.36], [-1.13, 0.97, 0.33]],
  surco_acc_dcho: [[-0.74, 0.87, -0.12], [-0.82, 0.94, -0.10], [-0.95, 0.97, -0.09], [-1.06, 0.95, -0.10], [-1.13, 0.88, -0.14]],
  surco_cor_dorsal: [[-1.14, 0.92, 0.36], [-1.14, 1.03, 0.33], [-1.13, 1.12, 0.20], [-1.13, 1.13, 0.10], [-1.14, 1.05, -0.06], [-1.15, 0.93, -0.09]],
  surco_cor_ventral: [[-1.17, 0.88, 0.36], [-1.18, 0.78, 0.30], [-1.18, 0.70, 0.12], [-1.17, 0.74, -0.08], [-1.17, 0.86, -0.13]],
  surco_caudal: [[-1.36, 0.95, 0.33], [-1.43, 0.95, 0.20], [-1.46, 0.95, 0.10], [-1.42, 0.95, -0.02], [-1.34, 0.94, -0.08]],
  surco_craneal: [[-0.62, 0.79, 0.33], [-0.57, 0.77, 0.24], [-0.53, 0.76, 0.12], [-0.57, 0.77, 0.00], [-0.63, 0.80, -0.08]],
  surco_ruminorreticular: [[-0.49, 0.66, 0.16], [-0.48, 0.74, 0.24], [-0.49, 0.85, 0.25], [-0.50, 0.95, 0.18], [-0.51, 0.99, 0.10]],
};
// profundidad (= radio del tallado) de cada surco, en metros
const GROOVE_DEPTH = {
  surco_long_izq: 0.016, surco_long_dcho: 0.017, surco_acc_izq: 0.011, surco_acc_dcho: 0.012,
  surco_cor_dorsal: 0.013, surco_cor_ventral: 0.013, surco_caudal: 0.016, surco_craneal: 0.016, surco_ruminorreticular: 0.015,
};

function buildRuminoreticulum() {
  const names = Object.keys(RUMEN);
  const fs = names.map((n) => ellipsoid(RUMEN[n].c, RUMEN[n].r));
  const [fRet, fAtrio] = fs;
  // surco ruminorretícular algo más marcado (k menor entre retículo y resto)
  const rumenOnly = unionAll(fs.slice(1), 0.035);
  const U0 = (x, y, z) => smin(fRet(x, y, z), rumenOnly(x, y, z), 0.025);
  const near = nearest(fs);
  // surcos tallados en el propio campo: tubo centrado en la superficie y restado (unión suave)
  const grooves = RUMEN_GROOVES;
  const gPaths = {};
  for (const [ref, seeds] of Object.entries(grooves)) {
    gPaths[ref] = new THREE.CatmullRomCurve3(seeds.map(toV)).getPoints(30).map((p) => snap(U0, p, 0));
  }
  const carves = Object.entries(gPaths).map(([ref, pts]) => {
    const r = GROOVE_DEPTH[ref] ?? 0.012;
    const box = new THREE.Box3().setFromPoints(pts).expandByScalar(r + 0.02);
    return { ref, box, f: capsuleChain(pts.map((p) => p.toArray()), pts.map(() => r)) };
  });
  const tmpP = V();
  const U = (x, y, z) => {
    const d = U0(x, y, z);
    if (d > 0.04 || d < -0.05) return d;
    tmpP.set(x, y, z);
    let c = Infinity;
    for (const k of carves) if (k.box.containsPoint(tmpP)) c = Math.min(c, k.f(x, y, z));
    return c === Infinity ? d : smax(d, -c, 0.01);
  };
  // relieve interior: panal en el retículo, rugosidad suave en el rumen
  const F = (2 * Math.PI) / 0.034;
  const inner = (x, y, z) => {
    const w = clamp((fAtrio(x, y, z) - fRet(x, y, z)) / 0.04 + 0.5, 0, 1);
    let h = 0.0025 * noise3(x * 60, y * 60, z * 60, 3);
    if (w > 0) {
      const hc = Math.cos(x * F) * Math.cos(y * F) + Math.cos(y * F) * Math.cos(z * F) + Math.cos(z * F) * Math.cos(x * F);
      h += w * (hc > 0.6 ? 0.007 : 0);
    }
    return h;
  };
  const f = hollow(U, RUMEN_T, inner);
  const geo = polygonize(f, [-1.46, 0.60, -0.22], [-0.32, 1.16, 0.36], 0.0085);
  const parts = splitGeometry(geo, (x, y, z, nx, ny) => {
    const d = U(x, y, z);
    const i = near(x, y, z), n = names[i];
    if (d < -RUMEN_T * 0.5) return n === 'ret' ? 'reticulo_mucosa' : 'rumen_mucosa';
    // el fondo tallado de cada surco es su propia malla (grasa, seleccionable)
    tmpP.set(x, y, z);
    for (const k of carves) if (k.box.containsPoint(tmpP) && k.f(x, y, z) < 0.0035) return k.ref;
    if (n === 'ret') return y < RUMEN.ret.c[1] - 0.07 ? 'reticulo_fondo' : (x > RUMEN.ret.c[0] - 0.01 ? 'reticulo_diaf' : 'reticulo_visc');
    return `rumen_${n}_${z > RUMEN[n].c[2] ? 'p' : 'v'}`;
  });
  const MUC = { fin: { tint: null, bump: 0.45, freq: 150, aoK: 0.7, mottle: 0.14 } };
  const SEROSA = '#b8a596';
  const grooveTint = (x, y, z) => {
    tmpP.set(x, y, z);
    let c = Infinity;
    for (const k of carves) if (k.box.containsPoint(tmpP)) c = Math.min(c, k.f(x, y, z));
    const t = clamp((c - 0.001) / 0.009, 0, 1);
    return 1 - t * t * (3 - 2 * t);
  };
  emit(parts, (k) => {
    if (k === 'rumen_mucosa') return { ...M('stomach', C.rumenIn, { roughness: 0.85 }), ...MUC };
    if (k === 'reticulo_mucosa') return { ...M('stomach', C.retIn, { roughness: 0.85 }), ...MUC };
    // serosa gris-rosada, igual en todos los trozos; la grasa de los surcos es un tinte continuo
    if (k.startsWith('surco_')) return { ...M('fat', SEROSA, { roughness: 0.42, clearcoat: 0.45 }), fin: { bump: 0.12, freq: 90 } };
    return M('stomach', SEROSA, { roughness: 0.5, clearcoat: 0.35 });
  }, { tint: grooveTint, tintColor: '#f0d58c', bump: 0.07, freq: 45, aoK: 0.5, mottle: 0.07 });

  // ── surcos (grasa en su fondo) y pilares (relieve interno) ──
  const S = (seeds, off = 0.003) => seeds.map((p) => snap(U, p, off));
  const SIn = (seeds, depth) => seeds.map((p) => snap(U, p, -RUMEN_T - depth));

  // pilares = mismos trazados por dentro (pliegues musculares)
  const pillars = {
    rumen_pilar_long_izq: [grooves.surco_long_izq, 0.010, 0.014],
    rumen_pilar_long_dcho: [grooves.surco_long_dcho, 0.012, 0.017],
    rumen_pilar_acc_izq: [grooves.surco_acc_izq, 0.008, 0.011],
    rumen_pilar_acc_dcho: [grooves.surco_acc_dcho, 0.009, 0.013],
    rumen_pilar_cor_dorsal: [grooves.surco_cor_dorsal, 0.010, 0.014],
    rumen_pilar_cor_ventral: [grooves.surco_cor_ventral, 0.010, 0.014],
    rumen_pilar_caudal: [grooves.surco_caudal, 0.018, 0.024],
    rumen_pilar_craneal: [grooves.surco_craneal, 0.020, 0.026],
  };
  for (const [ref, [seeds, depth, r]] of Object.entries(pillars)) {
    // pliegue de la pared: nace de la mucosa (medio hundido en ella) y se afila en los extremos
    const pts = new THREE.CatmullRomCurve3(seeds.map(toV)).getPoints(24);
    place(ref, T(SIn(pts, depth * 0.45), (t) => r * (0.35 + 0.65 * Math.sin(Math.PI * t)), '#7a5a3d', { kind: 'stomach', flat: 0.55, radial: 12, mat: { roughness: 0.7, clearcoat: 0.15 } }), 'viscera');
  }
  place('pliegue_ruminorreticular', T(SIn(grooves.surco_ruminorreticular.slice(0, 4), 0.014), 0.016, '#6d5238', { radial: 10, flat: 0.55 }), 'viscera');

  // curvaturas (líneas de estudio)
  const top = S(Array.from({ length: 10 }, (_, i) => [lerp(-0.50, -1.36, i / 9), 1.25, 0.14]), 0.006);
  const bot = S(Array.from({ length: 10 }, (_, i) => [lerp(-0.62, -1.42, i / 9), 0.55, 0.09]), 0.006);
  place('rumen_curv_dorsal', pathLine(top, 'projection2', 0.0045), 'proyeccion');
  place('rumen_curv_ventral', pathLine(bot, 'projection2', 0.0045), 'proyeccion');

  // orificios y referencias internas
  const io = ring(V(-0.93, 0.875, 0.10), V(0, 1, 0), 0.12, 0.0045, 'marker', '#ffd36b');
  io.scale.set(1.75, 1, 1);
  place('orificio_intrarruminal', io, 'viscera');
  place('orificio_ruminorreticular', ring(V(-0.50, 0.93, 0.11), V(1, 0.1, 0), 0.075, 0.004, 'marker', '#ffd36b'), 'viscera');
  // ínsula: parche en la cara derecha entre longitudinal y accesorio derechos
  {
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const t = i / 13, x = lerp(-0.80, -1.08, t);
      const p = snap(U, [x, 0.915 + 0.015 * Math.sin(Math.PI * t), -0.16], -RUMEN_T - 0.002);
      g.add(marker(p, '#e9c46a', 0.011));
    }
    place('insula_rumen', g, 'viscera');
  }

  // papilas del rumen (conos fusionados en una sola geometría)
  {
    const mucosa = parts.get('rumen_mucosa');
    const pos = mucosa.attributes.position, nor = mucosa.attributes.normal;
    const cones = [];
    // papila en forma de lengüeta (punta roma y aplanada), no de espina
    const base = new THREE.CylinderGeometry(0.0009, 0.0021, 0.0075, 6, 1); base.scale(1, 1, 0.55); base.translate(0, 0.0035, 0);
    const up = V(0, 1, 0), q = new THREE.Quaternion(), mtx = new THREE.Matrix4();
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 0; n < 5200 && cones.length < 3400; n++) {
      const i = Math.floor(rnd() * pos.count);
      const p = V(pos.getX(i), pos.getY(i), pos.getZ(i));
      // pocas papilas en el techo del saco dorsal y en los pilares
      if (p.y > 1.04 && near(p.x, p.y, p.z) === 2) continue;
      const nn = V(nor.getX(i), nor.getY(i), nor.getZ(i)).normalize();
      q.setFromUnitVectors(up, nn);
      mtx.compose(p, q, V(1, 0.7 + rnd() * 0.8, 1));
      cones.push(base.clone().applyMatrix4(mtx));
    }
    const merged = mergeGeometries(cones); cones.forEach((g) => g.dispose());
    place('rumen_papilas', new THREE.Mesh(merged, makeMaterial('stomach', { color: '#5a4029', roughness: 0.8 })), 'viscera');
  }

  // ── retículo: curvaturas, surco del retículo, orificio reticuloomasico ──
  const rc = RUMEN.ret.c;
  const curv = (z) => S(Array.from({ length: 8 }, (_, i) => { const a = lerp(-1.25, 1.3, i / 7); return [rc[0] + 0.09 * Math.cos(a) + 0.02, rc[1] + 0.14 * Math.sin(a), z]; }), 0.005);
  place('reticulo_curv_mayor', pathLine(curv(0.24), 'projection2', 0.0045), 'proyeccion');
  place('reticulo_curv_menor', pathLine(curv(-0.12), 'projection2', 0.0045), 'proyeccion');
  // surco: del cardias (dorsal) al orificio reticuloomasico, por la pared derecha
  const sulcus = (dz) => SIn([[-0.51, 0.95, 0.00 + dz], [-0.495, 0.90, -0.03 + dz], [-0.48, 0.85, -0.055 + dz], [-0.47, 0.81, -0.07 + dz]], 0.006);
  place('surco_ret_fondo', T(sulcus(0), 0.007, '#c9a47c', { flat: 0.35, radial: 8 }), 'viscera');
  place('surco_ret_labio_dcho', T(sulcus(-0.018), 0.0075, '#7c5c3e', { radial: 8 }), 'viscera');
  place('surco_ret_labio_izq', T(sulcus(0.018), 0.0075, '#7c5c3e', { radial: 8 }), 'viscera');
  place('orificio_reticuloomasico', ring(V(-0.47, 0.81, -0.075), V(0.3, -0.2, -1), 0.022, 0.004, 'marker', '#ffd36b'), 'viscera');
  // esófago abdominal hasta el cardias
  place('esofago', T([[-0.60, 1.055, 0.0], [-0.56, 1.0, 0.01], [-0.515, 0.955, 0.012]], 0.014, '#d58b84', { kind: 'muscle3' }), 'viscera');

  return { ret: fRet, U };
}

// ═════════════════════════════════════════════════════════════
// 2 · OMASO (esfera con láminas)
// ═════════════════════════════════════════════════════════════
const OMASO = { c: [-0.66, 0.85, -0.16], r: [0.13, 0.12, 0.11] };
function buildOmasum() {
  const t = 0.010;
  const body = ellipsoid(OMASO.c, OMASO.r);
  const neck = capsuleChain([[-0.465, 0.815, -0.07], [-0.55, 0.82, -0.11]], [0.026, 0.034]);
  const U = (x, y, z) => smin(body(x, y, z), neck(x, y, z), 0.02);
  const f = hollow(U, t);
  const geo = polygonize(f, [-0.81, 0.70, -0.29], [-0.41, 0.99, -0.02], 0.006);
  const [cx, cy, cz] = OMASO.c;
  const parts = splitGeometry(geo, (x, y, z, nx, ny) => {
    if (U(x, y, z) < -t * 0.5) return 'omaso_mucosa';
    if (neck(x, y, z) < body(x, y, z)) return 'omaso_cuello';
    if (y < cy - 0.07 && ny < -0.3) return 'omaso_base';
    return z < cz ? 'omaso_parietal' : 'omaso_visceral';
  });
  emit(parts, (k) => (k === 'omaso_mucosa' ? { ...M('stomach', C.omasoIn), fin: { fat: null, bump: 0.4, freq: 140 } }
    : M('stomach', k === 'omaso_base' ? '#b0957a' : '#bea385', { clearcoat: 0.35, roughness: 0.5 })), { fat: C.fat, bump: 0.15, freq: 80 });

  // láminas: hojas de 4 órdenes que nacen de la curvatura; borde libre hacia el canal
  const axis = V(-1, -0.08, -0.25).normalize();             // eje del canal (craneal→caudal)
  const canal = V(cx, cy - 0.075, cz);
  const ref = V(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  const side = new THREE.Vector3().crossVectors(axis, ref).normalize();
  const order = [0.022, 0.085, 0.06, 0.085, 0.04, 0.085, 0.06, 0.085];
  const geos = [];
  const N = 33;
  for (let k = 0; k < N; k++) {
    const phi = lerp(-1.25, 1.25, k / (N - 1));
    const dir = ref.clone().multiplyScalar(Math.cos(phi)).addScaledVector(side, Math.sin(phi));  // dirección en el plano de la hoja
    const free = order[k % order.length];
    const pos = [], idx = [];
    const NS = 22;
    for (let s = 0; s <= NS; s++) {
      const a = lerp(-1.35, 1.35, s / NS);                       // a lo largo del eje
      const d = axis.clone().multiplyScalar(Math.sin(a)).addScaledVector(dir, Math.cos(a)).normalize();
      // rayo desde el canal hasta la pared interna
      let lo = 0, hi = 0.25;
      for (let it = 0; it < 22; it++) { const m = (lo + hi) / 2; const p = canal.clone().addScaledVector(d, m); if (U(p.x, p.y, p.z) < -t - 0.002) lo = m; else hi = m; }
      const wall = canal.clone().addScaledVector(d, lo);
      const inner = canal.clone().addScaledVector(d, Math.min(lo * 0.92, free + 0.012 * Math.cos(a)));
      pos.push(inner.x, inner.y, inner.z, wall.x, wall.y, wall.z);
      if (s < NS) { const b = s * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  }
  const lam = new THREE.Mesh(mergeGeometries(geos), makeMaterial('stomach', { color: C.lamina, side: THREE.DoubleSide, roughness: 0.75 }));
  geos.forEach((g) => g.dispose());
  place('omaso_laminas', lam, 'viscera');

  place('omaso_canal', pathLine([V(-0.47, 0.81, -0.075), V(-0.56, 0.77, -0.11), V(-0.64, 0.765, -0.14), V(-0.71, 0.75, -0.14)], 'projection2', 0.006, { dashed: true }), 'proyeccion');
  place('omaso_surco', T([[-0.50, 0.785, -0.09], [-0.58, 0.755, -0.125], [-0.66, 0.748, -0.15], [-0.71, 0.742, -0.15]], 0.004, '#e9c46a', { kind: 'fat', radial: 6 }), 'viscera');
  const crv = Array.from({ length: 12 }, (_, i) => { const a = lerp(2.5, -0.9, i / 11); return snap(U, [cx + 0.15 * Math.cos(a), cy + 0.14 * Math.sin(a), cz - 0.02], 0.005); });
  place('omaso_curvatura', pathLine(crv, 'projection2', 0.0045), 'proyeccion');
  place('surco_omasoabomasico', ring(V(-0.715, 0.75, -0.15), V(-0.5, -1, 0), 0.04, 0.005, 'fat', C.fat), 'viscera');
  place('orificio_omasoabomasico', ring(V(-0.715, 0.735, -0.15), V(-0.3, -1, 0), 0.026, 0.004, 'marker', '#ffd36b'), 'viscera');
  return { f: body };
}

// ═════════════════════════════════════════════════════════════
// 3 · ABOMASO (piriforme sobre el suelo, hacia la derecha)
// ═════════════════════════════════════════════════════════════
const ABO_PTS = [[-0.52, 0.62, 0.02], [-0.62, 0.645, -0.06], [-0.76, 0.66, -0.19], [-0.88, 0.70, -0.25], [-0.935, 0.745, -0.27], [-0.93, 0.80, -0.29], [-0.89, 0.85, -0.29]];
const ABO_R = [0.075, 0.088, 0.080, 0.062, 0.045, 0.034, 0.025];
function buildAbomasum() {
  const t = 0.008;
  const segs = ABO_PTS.slice(0, -1).map((p, i) => capsuleChain([p, ABO_PTS[i + 1]], [ABO_R[i], ABO_R[i + 1]]));
  const U = unionAll(segs, 0.03);
  const near = nearest(segs);
  const inner = (x, y, z) => 0.002 * noise3(x * 50, y * 50, z * 50, 9);
  const f = hollow(U, t, inner);
  const geo = polygonize(f, [-1.0, 0.53, -0.34], [-0.43, 0.90, 0.11], 0.0065);
  const region = (i) => (i === 0 ? 'fondo' : i <= 2 ? 'cuerpo' : 'pil');
  const parts = splitGeometry(geo, (x, y, z, nx, ny, nz) => {
    const r = region(near(x, y, z));
    if (U(x, y, z) < -t * 0.5) return `abomaso_mucosa_${r}`;
    const parietal = r === 'pil' ? nz < -0.35 : ny < -0.25;
    return `abomaso_${r}_${parietal ? 'p' : 'v'}`;
  });
  emit(parts, (k) => (k.includes('mucosa') ? { ...M('stomach', C.aboIn, { roughness: 0.35, clearcoat: 0.6 }), fin: { bump: 0.3, freq: 110, mottle: 0.12 } }
    : M('stomach', k.includes('_pil_') ? '#e0ae9a' : '#dba996', { roughness: 0.42, clearcoat: 0.5 })), { bump: 0.1, freq: 60, mottle: 0.06 });

  // curvaturas mayor (ventral/derecha) y menor (dorsal/izquierda)
  const curve = new THREE.CatmullRomCurve3(ABO_PTS.map(toV));
  const along = (sign) => Array.from({ length: 12 }, (_, i) => {
    const u = i / 11, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
    const lat = new THREE.Vector3().crossVectors(tg, V(0, 1, 0)).normalize();       // hacia la izquierda del trayecto
    const out = V(0, -1, 0).addScaledVector(lat, 0.6).normalize().multiplyScalar(sign);
    return snap(U, p.clone().addScaledVector(out, 0.12), 0.005);
  });
  place('abomaso_curv_mayor', pathLine(along(1), 'projection2', 0.0045), 'proyeccion');
  place('abomaso_curv_menor', pathLine(along(-1), 'projection2', 0.0045), 'proyeccion');

  // pliegues espirales (mucosa de fondo y cuerpo)
  {
    const g = new THREE.Group();
    const frames = curve.computeFrenetFrames(60, false);
    for (let k = 0; k < 9; k++) {
      const pts = [];
      for (let i = 0; i <= 26; i++) {
        const u = lerp(0.02, 0.55, i / 26), fi = Math.round(u * 60);
        const p = curve.getPointAt(u), N = frames.normals[fi], B = frames.binormals[fi];
        const a = (k / 9) * Math.PI * 2 + u * 3.2;
        const dir = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        pts.push(snap(U, p.clone().addScaledVector(dir, 0.03), -t - 0.006));
      }
      g.add(tube(pts, 0.0065, 'stomach', { mat: { color: C.fold, clearcoat: 0.5, roughness: 0.4 }, radial: 7, flat: 0.5, segs: 70 }));
    }
    place('abomaso_pliegues', g, 'viscera');
  }
  place('abomaso_surco', pathLine(along(-1).map((p) => snap(U, p, -t - 0.004)), 'projection2', 0.004, { dashed: true }), 'proyeccion');
  // velos en el orificio omasoabomasico + zona de glándulas cardiales
  {
    const g = new THREE.Group();
    for (const s of [1, -1]) g.add(blob(V(-0.715, 0.715, -0.15 + s * 0.016), [0.03, 0.006, 0.012], 'stomach', { mat: { color: '#d07d74' }, rot: [0, 0, s * 0.25], noise: 0.05 }));
    place('abomaso_velos', g, 'viscera');
  }
  place('abomaso_gl_cardiales', ring(V(-0.715, 0.705, -0.15), V(0, 1, 0), 0.04, 0.006, 'marker', '#ff9f80'), 'viscera');
  place('torus_pilorico', blob(V(-0.905, 0.835, -0.285), [0.018, 0.012, 0.016], 'stomach', { mat: { color: '#e5b8a0' }, noise: 0.05 }), 'viscera');
  return { f: U };
}

// ═════════════════════════════════════════════════════════════
// 4 · HÍGADO (lóbulos, caras, impresiones, vesícula)
// ═════════════════════════════════════════════════════════════
function buildLiver({ ret, omaso, kidneyR }) {
  const L = {
    dcho:  ellipsoid([-0.55, 1.00, -0.22], [0.075, 0.13, 0.10], rotInv(0.2, 0.35, -0.45)),
    izq:   ellipsoid([-0.43, 0.85, -0.11], [0.06, 0.11, 0.115], rotInv(0.15, 0.3, -0.35)),
    cuad:  ellipsoid([-0.49, 0.85, -0.22], [0.05, 0.075, 0.065], rotInv(0, 0.3, -0.3)),
    caud:  ellipsoid([-0.61, 1.03, -0.12], [0.05, 0.06, 0.06]),
    apcd:  ellipsoid([-0.71, 1.07, -0.18], [0.075, 0.045, 0.06], rotInv(0, 0.2, -0.15)),
    appap: ellipsoid([-0.62, 0.95, -0.06], [0.04, 0.035, 0.035]),
  };
  const names = Object.keys(L), fs = Object.values(L);
  const near = nearest(fs);
  const base = unionAll(fs, 0.06);
  const gall = ellipsoid([-0.52, 0.80, -0.29], [0.028, 0.055, 0.028], rotInv(0, 0, 0.35));
  // impresiones: la víscera vecina "muerde" el hígado
  const f = (x, y, z) => {
    let d = base(x, y, z);
    d = smax(d, -(ret(x, y, z) - 0.006), 0.02);
    d = smax(d, -(omaso(x, y, z) - 0.006), 0.02);
    d = smax(d, -(kidneyR(x, y, z) - 0.005), 0.015);
    d = smax(d, -(gall(x, y, z) - 0.003), 0.012);
    return d + 0.0015 * noise3(x * 30, y * 30, z * 30, 5);
  };
  const geo = polygonize(f, [-0.82, 0.70, -0.36], [-0.33, 1.17, 0.04], 0.006);
  const P = V(0.8, 0.35, -0.5).normalize();
  const parts = splitGeometry(geo, (x, y, z, nx, ny, nz) => {
    if (gall(x, y, z) < 0.012) return 'higado_fosa_vesicula';
    if (ret(x, y, z) < 0.02) return 'higado_imp_reticular';
    if (omaso(x, y, z) < 0.02) return 'higado_imp_omasal';
    if (kidneyR(x, y, z) < 0.018) return 'higado_imp_renal';
    const face = nx * P.x + ny * P.y + nz * P.z > 0 ? 'p' : 'v';
    return `higado_${names[near(x, y, z)]}_${face}`;
  });
  const tint = { dcho: '#7b2f2a', izq: '#83332d', cuad: '#8a3a30', caud: '#74302b', apcd: '#6f2b27', appap: '#7f3530' };
  emit(parts, (k) => {
    if (k.startsWith('higado_imp') || k === 'higado_fosa_vesicula') return M('liver', C.liverImp);
    const [, lobe, face] = k.split('_');
    return M('liver', tint[lobe], { clearcoat: face === 'p' ? 0.7 : 0.45, roughness: 0.32 });
  }, { bump: 0.06, freq: 50, aoK: 0.6, mottle: 0.1 });
  place('vesicula_biliar', blob(V(-0.52, 0.80, -0.29), [0.026, 0.052, 0.026], 'gland', { rot: [0, 0, 0.35], noise: 0.04, mat: { color: C.gall, roughness: 0.3, clearcoat: 0.6 } }), 'viscera');
  place('higado_cisura_redondo', T([[-0.43, 0.745, -0.14], [-0.45, 0.77, -0.16], [-0.47, 0.80, -0.175]], 0.004, '#efe3c8', { kind: 'ligament', radial: 6 }), 'viscera');
}

// ═════════════════════════════════════════════════════════════
// 5 · BAZO (aplanado sobre el atrio/saco dorsal, izquierda)
// ═════════════════════════════════════════════════════════════
function buildSpleen() {
  const c = V(-0.63, 0.99, 0.345);
  const e1 = V(-0.26, 0.30, -0.06).normalize();                 // eje largo (ventrocraneal → dorsocaudal)
  const e3 = V(0.05, 0.12, 1).normalize();                      // normal (hacia la pared)
  const e2 = new THREE.Vector3().crossVectors(e3, e1).normalize();
  e3.crossVectors(e1, e2).normalize();
  const basis = new THREE.Matrix4().makeBasis(e1, e2, e3);
  const inv = basis.clone().invert();
  const R = [0.205, 0.075, 0.016];
  // más ancho dorsalmente, extremo ventral más estrecho (campo aproximado, basta para el contorno)
  const tmp = V();
  const f = (x, y, z) => {
    tmp.set(x - c.x, y - c.y, z - c.z).applyMatrix4(inv);
    const taper = 1 + 0.3 * clamp(tmp.x / R[0], -1, 1);
    return (Math.hypot(tmp.x / R[0], tmp.y / (R[1] * taper), tmp.z / R[2]) - 1) * R[2] + 0.0006 * noise3(x * 40, y * 40, z * 40, 2);
  };
  const geo = polygonize(f, [-0.88, 0.74, 0.29], [-0.38, 1.24, 0.40], 0.005);
  const parts = splitGeometry(geo, (x, y, z, nx, ny, nz) => (nx * e3.x + ny * e3.y + nz * e3.z > 0 ? 'bazo_parietal' : 'bazo_visceral'));
  emit(parts, (k) => M('heart', k === 'bazo_parietal' ? '#74527c' : '#5d3f66', { roughness: 0.3, clearcoat: 0.7 }), { bump: 0.08, freq: 60, mottle: 0.12 });
  const at = (u, v, w = 0) => c.clone().addScaledVector(e1, u * R[0]).addScaledVector(e2, v * R[1]).addScaledVector(e3, w * R[2]);
  place('bazo_ext_dorsal', marker(at(1.0, 0), '#ffd36b', 0.012), 'proyeccion');
  place('bazo_ext_ventral', marker(at(-1.0, 0), '#ffd36b', 0.01), 'proyeccion');
  const border = (s) => Array.from({ length: 11 }, (_, i) => { const u = lerp(-0.92, 0.92, i / 10); return at(u, s * Math.sqrt(1 - u * u) * (1 + 0.3 * u) * 0.95); });
  place('bazo_borde_craneal', pathLine(border(-1), 'projection2', 0.004), 'proyeccion');
  place('bazo_borde_caudal', pathLine(border(1), 'projection2', 0.004), 'proyeccion');
  place('bazo_hilio', ring(at(0.42, 0.1, -1.05), e3.clone().negate(), 0.014, 0.0035, 'marker', '#ffd36b'), 'viscera');
}

// ═════════════════════════════════════════════════════════════
// 6 · RIÑONES (lobulados, con corteza, pirámides, papilas y cálices)
// ═════════════════════════════════════════════════════════════
function kidney(prefix, c, R, rot) {
  const inv = rotInv(...rot);
  const core = ellipsoid(c, R.map((r) => r * 0.82), inv);
  // lóbulos: esferas repartidas sobre el elipsoide (fisuras entre ellas)
  const lobes = [];
  const mat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const NL = 20;
  for (let i = 0; i < NL; i++) {
    const yy = 1 - (i + 0.5) * 2 / NL, rr = Math.sqrt(1 - yy * yy), th = golden * i;
    const u = V(Math.cos(th) * rr, yy, Math.sin(th) * rr);
    const lc = V(u.x * R[0] * 0.72, u.y * R[1] * 0.72, u.z * R[2] * 0.72).applyMatrix4(mat).add(V(...c));
    lobes.push({ c: lc, f: sphere(lc.toArray(), Math.min(...R) * 0.62) });
  }
  const lob = unionAll(lobes.map((l) => l.f), 0.008);
  const U = (x, y, z) => smin(core(x, y, z), lob(x, y, z), 0.01);
  const t = 0.011;                                         // corteza
  const geo = polygonize(hollow(U, t), [c[0] - R[0] - 0.03, c[1] - R[1] - 0.03, c[2] - R[2] - 0.03], [c[0] + R[0] + 0.03, c[1] + R[1] + 0.03, c[2] + R[2] + 0.03], 0.0045);
  // corteza: fisuras entre lóbulos oscurecidas con grasa (oclusión del campo)
  emit(new Map([[`${prefix}_sup`, geo]]), () => M('heart', '#94363a', { roughness: 0.32, clearcoat: 0.6 }), { fat: '#e8cf8e', fatK: 1.4, aoK: 0.55, bump: 0.05, freq: 70 });
  // hilio: en la cara medial
  const hilus = V(...c).add(V(0, -R[1] * 0.1, prefix === 'rinon_dcho' ? R[2] * 0.55 : R[2] * 0.5));
  const pyr = new THREE.Group(), pap = new THREE.Group(), cal = new THREE.Group();
  for (const l of lobes) {
    const out = l.c.clone().sub(V(...c)).normalize();
    const a = l.c.clone().addScaledVector(out, Math.min(...R) * 0.28);          // base (bajo la corteza)
    const tip = l.c.clone().lerp(hilus, 0.55);
    pyr.add(tube([a, a.clone().lerp(tip, 0.5), tip], (s) => lerp(0.016, 0.004, s), 'heart', { mat: { color: C.medulla }, radial: 8, segs: 14 }));
    pap.add(marker(tip, C.papilla, 0.0055, 'gland'));
    cal.add(tube([tip, tip.clone().lerp(hilus, 0.5).add(V(0, 0.004, 0)), hilus], 0.0042, 'fat', { mat: { color: C.calyx }, radial: 6 }));
  }
  place(`${prefix}_medula`, pyr, 'viscera');
  place(`${prefix}_papilas`, pap, 'viscera');
  place(`${prefix}_calices`, cal, 'viscera');
  // uréter hacia la pelvis
  place(`${prefix}_calices`, T([hilus.toArray(), [hilus.x - 0.12, hilus.y - 0.03, hilus.z * 0.6], [-1.45, 0.96, hilus.z * 0.3], [-1.55, 0.90, 0]], 0.004, C.calyx, { kind: 'fat', radial: 6 }), 'viscera');
  return U;
}
function buildKidneys() {
  const right = kidney('rinon_dcho', [-0.80, 1.10, -0.14], [0.11, 0.05, 0.065], [0, 0.1, 0.05]);
  kidney('rinon_izq', [-1.04, 1.035, -0.075], [0.10, 0.05, 0.058], [0.15, -0.1, -0.1]);
  return { right };
}

// ═════════════════════════════════════════════════════════════
// 7 · INTESTINOS (masa intestinal en el receso supraomental, derecha)
// ═════════════════════════════════════════════════════════════
function buildIntestines() {
  // duodeno
  const du = { kind: 'stomach', radial: 12 };
  place('duodeno_craneal', T([[-0.89, 0.85, -0.29], [-0.86, 0.93, -0.30], [-0.80, 0.975, -0.28], [-0.84, 1.02, -0.29]], 0.019, C.small, du), 'viscera');
  place('duodeno_desc', T([[-0.84, 1.02, -0.29], [-0.98, 1.04, -0.31], [-1.15, 1.04, -0.31], [-1.30, 1.02, -0.29]], 0.019, C.small, du), 'viscera');
  place('duodeno_flex_caudal', T([[-1.30, 1.02, -0.29], [-1.38, 0.995, -0.25], [-1.36, 1.0, -0.195], [-1.28, 1.02, -0.17]], 0.019, C.small, du), 'viscera');
  place('duodeno_asc', T([[-1.28, 1.02, -0.17], [-1.12, 1.035, -0.20], [-0.98, 1.03, -0.22], [-0.92, 0.99, -0.21]], 0.018, C.small, du), 'viscera');

  // yeyuno: guirnalda en el borde del mesenterio
  const Mc = V(-1.13, 0.86, -0.225);
  const jej = [];
  const N = 640, phi0 = 1.35, phi1 = -3.55, coils = 23;
  for (let i = 0; i <= N; i++) {
    const s = i / N, phi = lerp(phi0, phi1, s), w = s * coils * Math.PI * 2;
    const rx = 0.19 + 0.028 * Math.sin(w), ry = 0.175 + 0.028 * Math.sin(w);
    jej.push(V(Mc.x + rx * Math.cos(phi), Mc.y + ry * Math.sin(phi), Mc.z + 0.045 * Math.cos(w)));
  }
  jej.unshift(V(-0.92, 0.99, -0.21));
  // ondas peristálticas suaves: el calibre varía a lo largo del asa
  place('yeyuno', tube(jej, (t) => 0.0165 * (1 + 0.09 * Math.sin(t * 380) + 0.04 * Math.sin(t * 97)), 'stomach', { mat: { color: C.small, roughness: 0.45, clearcoat: 0.4 }, segs: 1800, radial: 10 }), 'viscera');
  const jEnd = jej[jej.length - 1];
  const J = V(-1.22, 0.90, -0.245);                                   // unión ileocecocólica
  place('ileon', tube([jEnd, V(jEnd.x + 0.02, jEnd.y + 0.04, -0.24), V(-1.27, 0.925, -0.25), J], 0.015, 'stomach', { mat: { color: '#d99d90' }, radial: 10 }), 'viscera');
  // ciego
  place('ciego_cuerpo', T([J.toArray(), [-1.32, 0.92, -0.27], [-1.42, 0.92, -0.27]], (t) => lerp(0.042, 0.036, t), C.cecum, du), 'viscera');
  place('ciego_vertice', T([[-1.42, 0.92, -0.27], [-1.49, 0.905, -0.255], [-1.54, 0.875, -0.23]], (t) => lerp(0.036, 0.016, t), C.cecum, du), 'viscera');
  {
    const pts = [V(-1.25, 0.94, -0.25), J, V(-1.31, 0.95, -0.268), V(-1.29, 0.965, -0.255)];
    place('pliegue_ileocecal', fan(pts, C.omentum, 0.5), 'omento');
  }
  // colon ascendente: asa proximal (S) → asa espiral → asa distal
  const Cs = V(-1.12, 0.86, -0.15), k = 0.115 / (4 * Math.PI);
  place('colon_asa_proximal', T([J.toArray(), [-1.10, 0.955, -0.225], [-0.99, 0.965, -0.205], [-0.985, 0.90, -0.17], [Cs.x + 0.115, Cs.y, Cs.z]], 0.022, C.colon, du), 'viscera');
  const spiral = (s0, s1, n) => Array.from({ length: n + 1 }, (_, i) => { const s = lerp(s0, s1, i / n); return V(Cs.x + k * s * Math.cos(s), Cs.y + k * s * Math.sin(s), Cs.z + 0.004 * Math.sin(s * 3)); });
  place('colon_centripetos', tube(spiral(4 * Math.PI, Math.PI * 0.55, 160), 0.0105, 'stomach', { mat: { color: C.colon }, radial: 9, segs: 520 }), 'viscera');
  place('colon_flexura_central', tube(spiral(Math.PI * 0.55, -Math.PI * 0.55, 30), 0.0105, 'stomach', { mat: { color: '#e0b88f' }, radial: 10 }), 'viscera');
  place('colon_centrifugos', tube(spiral(-Math.PI * 0.55, -4 * Math.PI, 160), 0.0105, 'stomach', { mat: { color: '#c39a7c' }, radial: 9, segs: 520 }), 'viscera');
  place('colon_asa_distal', T([[Cs.x - 0.115, Cs.y, Cs.z], [-1.28, 0.93, -0.14], [-1.22, 0.985, -0.13], [-1.08, 0.975, -0.135], [-0.96, 0.99, -0.12], [-0.90, 1.05, -0.09]], 0.018, C.colon, du), 'viscera');
  place('colon_transverso', T([[-0.90, 1.05, -0.09], [-0.87, 1.09, -0.05], [-0.90, 1.11, -0.02]], 0.018, C.colon, du), 'viscera');
  place('colon_descendente', T([[-0.90, 1.11, -0.02], [-1.10, 1.115, -0.02], [-1.30, 1.12, -0.02], [-1.45, 1.11, -0.01]], 0.019, C.colon, du), 'viscera');
  place('recto', T([[-1.45, 1.11, -0.01], [-1.60, 1.09, 0], [-1.72, 1.065, 0], [-1.84, 1.04, 0]], (t) => 0.024 + 0.012 * Math.sin(Math.PI * Math.min(1, t * 1.2)), C.rectum, { ...du, mat: { transparent: true, opacity: 0.55, depthWrite: false } }), 'viscera');
  {
    const g = new THREE.Group();
    const rc = new THREE.CatmullRomCurve3([V(-1.45, 1.11, -0.01), V(-1.60, 1.09, 0), V(-1.72, 1.065, 0), V(-1.84, 1.04, 0)]);
    for (const u of [0.3, 0.48, 0.66, 0.82]) g.add(ring(rc.getPointAt(u), rc.getTangentAt(u), 0.026, 0.005, 'stomach', '#b97a6c'));
    place('recto_pliegues', g, 'viscera');
  }
  // mesenterio + linfonodos yeyunales
  {
    const pts = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2; return V(Mc.x + 0.175 * Math.cos(a), Mc.y + 0.16 * Math.sin(a), -0.185); });
    place('mesenterio', fan(pts, '#f3e3c0', 0.3), 'omento');
    const g = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = lerp(1.1, -3.3, i / 11); g.add(blob(V(Mc.x + 0.15 * Math.cos(a), Mc.y + 0.135 * Math.sin(a), -0.19), [0.016, 0.009, 0.007], 'lymph', { rot: [0, 0, a + Math.PI / 2], noise: 0.08, seed: i })); }
    place('nnll_yeyunales', g, 'linfa');
  }
}

/** Lámina translúcida en abanico (mesos, pliegues, omento menor). */
function fan(pts, color, opacity = 0.35) {
  const c = pts.reduce((a, b) => a.clone().add(b), V()).multiplyScalar(1 / pts.length);
  const pos = [c.x, c.y, c.z]; const idx = [];
  pts.forEach((p) => pos.push(p.x, p.y, p.z));
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, makeMaterial('serosa', { color, opacity, side: THREE.DoubleSide }));
}

// ═════════════════════════════════════════════════════════════
// 8 · PÁNCREAS, VASOS (porta, cava caudal, aorta abdominal)
// ═════════════════════════════════════════════════════════════
function buildPancreasVessels() {
  const pm = { mat: { color: C.pancreas, roughness: 0.7 }, noise: 0.18, freq: 7, detail: 3 };
  place('pancreas_cuerpo', blob(V(-0.82, 1.0, -0.17), [0.05, 0.022, 0.04], 'gland', { ...pm, seed: 3 }), 'glandula');
  place('pancreas_lob_dcho', tube([V(-0.85, 1.0, -0.21), V(-0.95, 1.01, -0.25), V(-1.06, 1.015, -0.27)], (t) => lerp(0.02, 0.011, t), 'gland', { mat: pm.mat, flat: 0.55 }), 'glandula');
  place('pancreas_lob_izq', tube([V(-0.82, 1.0, -0.13), V(-0.85, 1.02, -0.08), V(-0.89, 1.04, -0.045)], (t) => lerp(0.02, 0.011, t), 'gland', { mat: pm.mat, flat: 0.55 }), 'glandula');
  place('pancreas_escotadura', ring(V(-0.80, 1.0, -0.15), V(1, 0, 0.2), 0.018, 0.0035, 'marker', '#ffd36b'), 'glandula');
  place('v_porta', T([[-0.92, 0.97, -0.10], [-0.86, 0.985, -0.12], [-0.80, 1.0, -0.15], [-0.70, 0.985, -0.16], [-0.62, 0.965, -0.16]], 0.013, '#5b4fd6', { kind: 'vein', radial: 10 }), 'vaso');
  place('v_cava_caudal_abd', T([[-0.40, 0.97, -0.09], [-0.50, 1.04, -0.10], [-0.62, 1.10, -0.07], [-0.80, 1.145, -0.045], [-1.05, 1.15, -0.03], [-1.42, 1.15, -0.03]], 0.016, '#3b5bd6', { kind: 'vein', radial: 10 }), 'vaso');
  place('aorta_abdominal', T([[-0.78, 1.16, 0.022], [-1.05, 1.165, 0.022], [-1.30, 1.17, 0.02], [-1.45, 1.165, 0.015]], 0.015, '#d83a3a', { kind: 'artery', radial: 10 }), 'vaso');
}

// ═════════════════════════════════════════════════════════════
// 9 · OMENTOS (mayor: paredes superficial y profunda; menor)
// ═════════════════════════════════════════════════════════════
const floorIn = (x) => bodyPoint(x, Math.PI).y + 0.034;
function sling(x0, x1, section, color, opacity, ref) {
  const nu = 30, nv = 40, pos = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const p = section(lerp(x0, x1, i / nu), j / nv); pos.push(p.x, p.y, p.z); }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, makeMaterial('serosa', { color, opacity, side: THREE.DoubleSide, roughness: 0.4 }));
  place(ref, m, 'omento');
}
/** Interpola una polilínea de puntos [z, y(x)] → V(x,y,z) */
function polyAt(x, ctrl, v) {
  const n = ctrl.length - 1, f = v * n, i = Math.min(n - 1, Math.floor(f)), t = f - i;
  const a = ctrl[i](x), b = ctrl[i + 1](x), s = t * t * (3 - 2 * t);
  return V(x, lerp(a[1], b[1], s), lerp(a[0], b[0], s));
}
function buildOmenta() {
  const supCtrl = [
    () => [-0.335, 1.005], () => [-0.352, 0.86], (x) => [-0.33, floorIn(x) + 0.07], (x) => [-0.22, floorIn(x) + 0.012],
    (x) => [-0.02, floorIn(x) + 0.004], (x) => [0.18, floorIn(x) + 0.012], (x) => [0.31, floorIn(x) + 0.07], () => [0.37, 0.85],
  ];
  const deepCtrl = [
    () => [-0.075, 0.875], () => [-0.10, 0.76], (x) => [-0.17, floorIn(x) + 0.04], (x) => [-0.28, floorIn(x) + 0.055], () => [-0.322, 0.80], () => [-0.318, 1.0],
  ];
  sling(-0.95, -1.40, (x, v) => polyAt(x, supCtrl, v), C.omentum, 0.34, 'om_mayor_sup');
  sling(-0.95, -1.34, (x, v) => polyAt(x, deepCtrl, v), '#f6e7b8', 0.3, 'om_mayor_prof');
  // bolsa omental: espacio entre ambas paredes (ventral derecha)
  const bursa = [(x) => [-0.30, floorIn(x) + 0.075], (x) => [-0.25, floorIn(x) + 0.03], (x) => [-0.18, floorIn(x) + 0.022]];
  sling(-0.97, -1.32, (x, v) => polyAt(x, bursa, v), '#8fc7f0', 0.22, 'om_bolsa');
  // receso supraomental: contorno discontinuo en dos planos transversales
  {
    const g = new THREE.Group();
    for (const x of [-1.02, -1.26]) {
      const f = floorIn(x);
      const pts = [V(x, 0.99, -0.31), V(x, 0.84, -0.32), V(x, f + 0.07, -0.29), V(x, f + 0.05, -0.18), V(x, 0.76, -0.11), V(x, 0.92, -0.10), V(x, 1.0, -0.15), V(x, 0.99, -0.31)];
      g.add(pathLine(pts, 'projection2', 0.004, { dashed: true }));
    }
    place('om_receso', g, 'omento');
  }
  place('om_agujero', ring(V(-0.75, 1.0, -0.215), V(0.2, 0, -1), 0.018, 0.004, 'marker', '#ffd36b'), 'omento');
  place('om_menor_hg', fan([V(-0.56, 0.90, -0.28), V(-0.68, 0.965, -0.282), V(-0.80, 0.85, -0.288), V(-0.86, 0.77, -0.27), V(-0.74, 0.74, -0.262), V(-0.62, 0.80, -0.28)], C.omentum, 0.38), 'omento');
  place('om_menor_hd', fan([V(-0.66, 0.975, -0.255), V(-0.77, 1.005, -0.27), V(-0.85, 0.955, -0.30), V(-0.80, 0.905, -0.29)], '#f6e2a6', 0.42), 'omento');
}

// ═════════════════════════════════════════════════════════════
// 10 · PARED ABDOMINAL (capas en escalera de disección), nervios, inguinal
// ═════════════════════════════════════════════════════════════
// a = ángulo de la sección del tronco (0 dorsal, π ventral); lado izq a>0, dcho a<0
const wallAt = (x, a, inset) => { const p = bodyPoint(x, a); return p.addScaledVector(wallNormal(x, a), -inset); };
// textura de fibras (una por músculo, rotada según la dirección de sus fibras)
let fiberImg = null;
function fiberTexture(angle, rep = [6, 6]) {
  if (!fiberImg) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 4) { g.fillStyle = `rgba(90,30,30,${0.10 + 0.12 * ((y * 7) % 5) / 5})`; g.fillRect(0, y, 128, 1.6); }
    fiberImg = cv;
  }
  const tex = new THREE.CanvasTexture(fiberImg);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...rep); tex.center.set(0.5, 0.5); tex.rotation = angle;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/** Lámina sobre la pared: u→x, v→a. inside(x,a) opcional recorta celdas. */
function wallSheet({ x0, x1, a0, a1, inset, side, color, kind = 'muscle', fiber = null, opacity, inside, nu = 40, nv = 30 }) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const x = lerp(x0, x1, i / nu), a = lerp(a0, a1, j / nv);
    const p = wallAt(x, side * a, inset); pos.push(p.x, p.y, p.z); uv.push(i / nu, j / nv);
  }
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    if (inside && !inside(lerp(x0, x1, (i + 0.5) / nu), lerp(a0, a1, (j + 0.5) / nv))) continue;
    const a = i * (nv + 1) + j, b = a + nv + 1;
    if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const over = { color, side: THREE.DoubleSide };
  if (opacity != null) Object.assign(over, { transparent: true, opacity, depthWrite: false });
  const mat = makeMaterial(kind, over);
  if (fiber != null) { mat.map = fiberTexture(fiber); mat.needsUpdate = true; }
  return new THREE.Mesh(g, mat);
}
const A_TOP = 1.36, A_APO = 2.3, A_REC = 2.72;
function buildWall() {
  // Escalera de disección por el lado IZQUIERDO (de fuera adentro cada capa termina más caudal);
  // el lado DERECHO lleva todas las capas completas.
  const X0 = -0.42;
  for (const side of [1, -1]) {
    const cut = (xl) => (side > 0 ? xl : -1.42);
    const add = (ref, o) => place(ref, wallSheet({ side, ...o }), 'pared');
    add('pa_cutaneo', { x0: X0, x1: cut(-0.68), a0: A_TOP - 0.05, a1: 2.55, inset: 0.005, color: '#d98a72', kind: 'muscle3', fiber: 0.15, opacity: 0.92 });
    add('pa_obl_ext', { x0: X0, x1: cut(-0.86), a0: A_TOP, a1: A_APO, inset: 0.011, color: '#c4554f', fiber: -0.75 });
    add('pa_obl_ext_apon', { x0: X0, x1: cut(-0.86) - 0.04, a0: A_APO, a1: Math.PI, inset: 0.011, color: '#eadbb8', kind: 'ligament', fiber: -0.75 });
    add('pa_obl_int', { x0: X0 - 0.12, x1: cut(-1.04), a0: A_TOP, a1: A_APO + 0.12, inset: 0.017, color: '#b8474a', kind: 'muscle2', fiber: 0.75,
      inside: (x, a) => a < A_APO - 0.2 + (x - X0) * -0.9 || x < -0.9 });
    add('pa_obl_int_apon', { x0: X0, x1: cut(-1.04), a0: A_APO + 0.12, a1: Math.PI, inset: 0.0165, color: '#e3d2ad', kind: 'ligament', fiber: 0.75 });
    add('pa_vaina_ext', { x0: X0 + 0.02, x1: cut(-1.04) - 0.02, a0: A_REC - 0.06, a1: Math.PI, inset: 0.020, color: '#efe2c4', kind: 'ligament', opacity: 0.55 });
    add('pa_recto', { x0: X0 + 0.04, x1: -1.44, a0: A_REC, a1: Math.PI - 0.025, inset: 0.0245, color: '#a94545', kind: 'muscle2', fiber: 1.5708 });
    add('pa_vaina_int', { x0: X0 + 0.02, x1: -1.40, a0: A_REC - 0.06, a1: Math.PI, inset: 0.029, color: '#e7d8b6', kind: 'ligament', opacity: 0.6 });
    add('pa_transverso', { x0: X0, x1: cut(-1.26), a0: A_TOP, a1: 2.45, inset: 0.031, color: '#d97a5f', kind: 'muscle3', fiber: 0.0 });
    add('pa_fascia_transversa', { x0: X0, x1: cut(-1.36), a0: A_TOP, a1: Math.PI, inset: 0.035, color: '#e8d9c8', kind: 'ligament', opacity: 0.55 });
    add('pa_peritoneo', { x0: X0, x1: -1.44, a0: A_TOP, a1: Math.PI, inset: 0.038, color: '#f6e6da', kind: 'serosa', opacity: 0.4 });
  }
  // línea blanca
  place('pa_linea_blanca', tube(Array.from({ length: 12 }, (_, i) => wallAt(lerp(-0.38, -1.46, i / 11), Math.PI, 0.02)), 0.006, 'ligament', { mat: { color: '#f7f0e0' }, radial: 8 }), 'pared');

  // nervios T13, L1, L2 (entre oblicuo interno y transverso), ramos dorsales y ventrales
  const nerves = { n_costoabdominal: -0.80, n_iliohipogastrico: -0.92, n_ilioinguinal: -1.02 };
  const dors = new THREE.Group(), vent = new THREE.Group();
  for (const [ref, x] of Object.entries(nerves)) {
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      const run = [[0, A_TOP], [-0.06, 1.75], [-0.13, 2.1], [-0.18, 2.5], [-0.21, ref === 'n_ilioinguinal' ? 2.72 : 2.88]];
      const pts = [V(x + 0.03, 1.18, side * 0.06), V(x + 0.005, 1.15, side * 0.24), ...run.map(([dx, a]) => wallAt(x + dx, side * a, 0.027))];
      g.add(tube(pts, 0.0042, 'nerve', { radial: 8 }));
      const d0 = wallAt(x, side * A_TOP, 0.027);
      dors.add(tube([d0, wallAt(x - 0.01, side * 1.25, 0.015), wallAt(x - 0.03, side * 1.12, 0.002)], 0.0028, 'nerve', { radial: 6 }));
      const v0 = wallAt(x - 0.09, side * 1.9, 0.027);
      vent.add(tube([v0, wallAt(x - 0.11, side * 1.95, 0.014), wallAt(x - 0.15, side * 2.02, 0.002)], 0.0028, 'nerve', { radial: 6 }));
    }
    place(ref, g, 'nervio');
  }
  place('n_ramos_dorsales', dors, 'nervio');
  place('n_ramos_ventrales', vent, 'nervio');

  // canal inguinal, anillos, vasos pudendos externos, n. genitofemoral
  const gf = new THREE.Group(), canal = new THREE.Group(), rs = new THREE.Group(), rp = new THREE.Group(), ap = new THREE.Group(), vp = new THREE.Group();
  for (const side of [1, -1]) {
    const deep = wallAt(-1.36, side * 2.62, 0.034), sup = wallAt(-1.42, side * 2.74, 0.010);
    rp.add(ring(deep, wallNormal(-1.36, side * 2.62), 0.024, 0.004, 'marker', '#ff8fa6'));
    rs.add(ring(sup, wallNormal(-1.42, side * 2.74), 0.03, 0.0045, 'marker', '#ffd36b'));
    canal.add(tube([deep, deep.clone().lerp(sup, 0.5), sup], 0.013, 'airspace', { radial: 10 }));
    const udder = V(-1.40, 0.50, side * 0.11);
    ap.add(tube([V(-1.34, 0.95, side * 0.10), V(-1.36, 0.82, side * 0.17), deep, sup, udder], 0.0055, 'artery', { radial: 8 }));
    vp.add(tube([V(-1.33, 0.95, side * 0.115), V(-1.35, 0.82, side * 0.185), deep.clone().add(V(0.01, 0, 0)), sup.clone().add(V(0.012, 0, 0)), udder.clone().add(V(0.02, 0, 0))], 0.0065, 'vein', { radial: 8 }));
    gf.add(tube([V(-1.10, 1.16, side * 0.05), V(-1.20, 1.05, side * 0.11), V(-1.30, 0.90, side * 0.17), deep], 0.0035, 'nerve', { radial: 6 }));
  }
  place('pa_anillo_prof', rp, 'pared'); place('pa_anillo_sup', rs, 'pared'); place('pa_canal_inguinal', canal, 'pared');
  place('pa_a_pudenda', ap, 'vaso'); place('pa_v_pudenda', vp, 'vaso'); place('n_genitofemoral', gf, 'nervio');

  // v. subcutánea abdominal (de la leche) y nl. subilíaco
  const vs = new THREE.Group(), nl = new THREE.Group();
  for (const side of [1, -1]) {
    const pts = Array.from({ length: 22 }, (_, i) => { const x = lerp(-1.24, -0.56, i / 21); return wallAt(x, side * (2.86 + 0.045 * Math.sin(i * 1.9)), -0.004); });
    pts.push(wallAt(-0.53, side * 2.86, 0.03));
    vs.add(tube(pts, (t) => lerp(0.011, 0.014, t), 'vein', { radial: 10 }));
    const p = wallAt(-1.37, side * 1.95, -0.006);
    nl.add(blob(p, [0.022, 0.045, 0.012], 'lymph', { noise: 0.08, rot: [0, 0, -0.3] }));
  }
  place('pa_v_subcutanea', vs, 'vaso');
  place('pa_nl_subiliaco', nl, 'linfa');

  // referencias palpables
  const rib = new THREE.Group(), cox = new THREE.Group();
  for (const side of [1, -1]) {
    rib.add(tube([...ribPath(13, side), ...cartilagePath(13, side).slice(1)], 0.0115, 'bone', { mat: { color: '#f3e6c0', emissive: '#3a2e10' }, radial: 10 }));
    const ct = HINDLIMB.coxalTuber;
    cox.add(blob(V(ct.x, ct.y, side * ct.z), [0.034, 0.028, 0.034], 'bone', { mat: { color: '#f3e6c0', emissive: '#3a2e10' }, noise: 0.05 }));
  }
  place('ultima_costilla', rib, 'hueso');
  place('tuberosidad_coxal', cox, 'hueso');
}

// ═════════════════════════════════════════════════════════════
// 11 · REGIONES (manchas sobre la piel) y línea del diafragma
// ═════════════════════════════════════════════════════════════
/** Ángulo a (0..π) del flanco izq a la altura y en la sección x. */
function aFromY(x, y) {
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bodyPoint(x, m).y > y) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function inPoly(x, a, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, ai] = poly[i], [xj, aj] = poly[j];
    if ((ai > a) !== (aj > a) && x < ((xj - xi) * (a - ai)) / (aj - ai) + xi) ins = !ins;
  }
  return ins;
}
function buildRegions() {
  // puntos (x, y) en el flanco → (x, a); los pares ya en (x, a) se escriben tal cual (ventrales)
  const toA = (pts) => pts.map(([x, y]) => [x, aFromY(x, y)]);
  const arch = costalArch(1).map((p) => [p.x, p.y]);                          // 13 → xifoides
  const rib13 = ribPath(13, 1).slice(3).map((p) => [p.x, p.y]);
  const dia = [[-0.27, 0.72], [-0.17, 0.85], [-0.15, 0.97], [-0.30, 1.10], [-0.55, 1.18], [-0.74, 1.215]];
  const R = {
    reg_craneal: [...toA(dia), ...toA(rib13), ...toA(arch.slice(1))],
    reg_paralumbar: toA([[-0.80, 1.235], [-1.30, 1.235], [-1.30, 1.20], [-0.98, 1.0], [-0.90, 1.08]]),
    reg_flanco: [...toA([[-0.98, 1.0], [-1.30, 1.20], [-1.25, 0.95], [-1.20, 0.80]]), [-1.16, 2.6], [-0.70, 2.62], ...toA([[-0.62, 0.70], [-0.80, 0.85], [-0.92, 0.95]])],
    reg_pliegue: [...toA([[-1.25, 0.95], [-1.36, 1.0], [-1.36, 0.80]]), [-1.30, 2.6], [-1.16, 2.6], ...toA([[-1.20, 0.80]])],
    reg_umbilical: [[-0.66, 2.66], [-1.10, 2.66], [-1.10, 3.14], [-0.66, 3.14]],
    reg_caudal: [...toA([[-1.36, 1.22], [-1.50, 1.20]]), [-1.50, 3.14], [-1.36, 3.14], [-1.30, 2.6], ...toA([[-1.36, 0.80], [-1.36, 1.0]])],
  };
  const COL = { reg_craneal: '#ff4d6d', reg_paralumbar: '#2bb3a6', reg_flanco: '#f2a65a', reg_pliegue: '#a78bfa', reg_umbilical: '#4cc9f0', reg_caudal: '#e9c46a' };
  for (const [ref, poly] of Object.entries(R)) {
    const xs = poly.map((p) => p[0]), as = poly.map((p) => p[1]);
    const x0 = Math.max(...xs), x1 = Math.min(...xs), a0 = Math.min(...as), a1 = Math.max(...as);
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      g.add(wallSheet({ x0, x1, a0, a1, inset: -0.006, side, color: COL[ref], kind: 'area', opacity: 0.42, nu: 84, nv: 64, inside: (x, a) => inPoly(x, a, poly) }));
      // contorno nítido del mismo color (se lee aunque haya mucho detrás)
      const edge = [];
      for (let i = 0; i < poly.length; i++) {
        const [xa, aa] = poly[i], [xb, ab] = poly[(i + 1) % poly.length];
        for (let s = 0; s < 6; s++) { const t = s / 6; edge.push(wallAt(lerp(xa, xb, t), side * lerp(aa, ab, t), -0.009)); }
      }
      edge.push(edge[0].clone());
      g.add(pathLine(edge, 'projection', 0.0032, { mat: { color: COL[ref] } }));
    }
    place(ref, g, 'proyeccion');
  }
  // avance craneal del diafragma (línea discontinua)
  const g = new THREE.Group();
  for (const side of [1, -1]) g.add(pathLine(dia.map(([x, y]) => wallAt(x, side * aFromY(x, y), -0.008)), 'projection', 0.005, { dashed: true }));
  place('reg_diafragma', g, 'proyeccion');
  void costochondral; void gradient;
}
