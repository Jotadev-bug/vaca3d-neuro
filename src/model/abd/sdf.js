// ─────────────────────────────────────────────────────────────
// abd/sdf.js · Órganos por campos de distancia (SDF) + marching cubes
// Permite unir sacos con surcos naturales (unión suave), vaciar órganos
// (pared + mucosa interior visible en los cortes) y trocear la malla por
// regiones anatómicas (cada trozo = una ref del temario).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { makeMaterial } from '../../geo.js';

// ── primitivas SDF (d < 0 dentro) ──
/** Elipsoide (aprox. de Inigo Quilez). c=[x,y,z] r=[rx,ry,rz]; rot opcional (Matrix4 inversa). */
export function ellipsoid(c, r, rotInv = null) {
  const [cx, cy, cz] = c, [rx, ry, rz] = r;
  const v = new THREE.Vector3();
  return (x, y, z) => {
    v.set(x - cx, y - cy, z - cz);
    if (rotInv) v.applyMatrix4(rotInv);
    const k0 = Math.hypot(v.x / rx, v.y / ry, v.z / rz);
    const k1 = Math.hypot(v.x / (rx * rx), v.y / (ry * ry), v.z / (rz * rz));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  };
}
/** Matriz inversa de rotación (Euler XYZ en rad) para ellipsoid(). */
export const rotInv = (rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).invert();
export function sphere(c, r) { return (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r; }
/** Cápsula de radio variable a lo largo de una polilínea pts=[[x,y,z],...], rad=[r0,r1,...] */
export function capsuleChain(pts, rad) {
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1], rad[i], rad[i + 1]]);
  return (x, y, z) => {
    let best = Infinity;
    for (const [a, b, ra, rb] of segs) {
      const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
      const px = x - a[0], py = y - a[1], pz = z - a[2];
      const L2 = bx * bx + by * by + bz * bz;
      const t = Math.max(0, Math.min(1, (px * bx + py * by + pz * bz) / L2));
      const d = Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
      if (d < best) best = d;
    }
    return best;
  };
}
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export const smax = (a, b, k) => -smin(-a, -b, k);
/** Unión suave de varias SDF (k = radio del pliegue; pequeño → surco marcado). */
export function unionAll(fs, k) {
  return (x, y, z) => { let d = fs[0](x, y, z); for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k); return d; };
}
/** Índice del componente más cercano (para clasificar regiones). */
export function nearest(fs) {
  return (x, y, z) => { let bi = 0, bd = Infinity; for (let i = 0; i < fs.length; i++) { const d = fs[i](x, y, z); if (d < bd) { bd = d; bi = i; } } return bi; };
}
/** Gradiente numérico (normal exterior). */
export function gradient(f, x, y, z, e = 0.002) {
  return new THREE.Vector3(
    f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)).normalize();
}
/** Proyecta un punto sobre la superficie f=off (pasos de Newton). */
export function snap(f, p, off = 0) {
  const q = p.isVector3 ? p.clone() : new THREE.Vector3(...p);
  for (let i = 0; i < 12; i++) {
    const d = f(q.x, q.y, q.z) - off;
    if (Math.abs(d) < 1e-4) break;
    q.addScaledVector(gradient(f, q.x, q.y, q.z), -d);
  }
  return q;
}

// ── marching cubes indexado ──
// Esquinas (convención de three/MarchingCubes): 0(0,0,0) 1(1,0,0) 2(1,1,0) 3(0,1,0) 4(0,0,1) 5(1,0,1) 6(1,1,1) 7(0,1,1)
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
// arista → [esquina origen, eje]
const EDGE = [[0, 0], [1, 1], [3, 0], [0, 1], [4, 0], [5, 1], [7, 0], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2]];

/**
 * Poligoniza f (d<0 dentro) en la caja [min,max] con paso `step`.
 * Devuelve BufferGeometry indexada con normales del gradiente.
 */
export function polygonize(f, min, max, step, { ao = 0.03 } = {}) {
  const nx = Math.ceil((max[0] - min[0]) / step) + 1;
  const ny = Math.ceil((max[1] - min[1]) / step) + 1;
  const nz = Math.ceil((max[2] - min[2]) / step) + 1;
  const val = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    val[id(i, j, k)] = f(min[0] + i * step, min[1] + j * step, min[2] + k * step);
  }
  const cache = new Int32Array(nx * ny * nz * 3).fill(-1);
  const pos = [], idx = [];
  const vert = (i, j, k, axis) => {
    const g = id(i, j, k), key = g * 3 + axis;
    if (cache[key] >= 0) return cache[key];
    const i2 = i + (axis === 0), j2 = j + (axis === 1), k2 = k + (axis === 2);
    const a = val[g], b = val[id(i2, j2, k2)];
    const t = a / (a - b);
    const x = min[0] + (i + (i2 - i) * t) * step, y = min[1] + (j + (j2 - j) * t) * step, z = min[2] + (k + (k2 - k) * t) * step;
    cache[key] = pos.length / 3; pos.push(x, y, z);
    return cache[key];
  };
  const ev = new Int32Array(12);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let ci = 0;
    for (let c = 0; c < 8; c++) { const o = CORNER[c]; if (val[id(i + o[0], j + o[1], k + o[2])] > 0) ci |= 1 << c; }
    const bits = edgeTable[ci];
    if (!bits) continue;
    for (let e = 0; e < 12; e++) if (bits & (1 << e)) { const [c, ax] = EDGE[e]; const o = CORNER[c]; ev[e] = vert(i + o[0], j + o[1], k + o[2], ax); }
    const base = ci << 4;
    for (let t = 0; triTable[base + t] !== -1; t += 3) idx.push(ev[triTable[base + t]], ev[triTable[base + t + 1]], ev[triTable[base + t + 2]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // normales = gradiente del campo (suaves) y orientación de caras coherente con ellas
  const n = new Float32Array(pos.length);
  for (let v = 0; v < pos.length; v += 3) { const gr = gradient(f, pos[v], pos[v + 1], pos[v + 2], step * 0.5); n[v] = gr.x; n[v + 1] = gr.y; n[v + 2] = gr.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  orientFaces(g);
  // oclusión ambiental desde el propio campo: en surcos y pliegues f(p+n·e) < e
  if (ao > 0) {
    const a = new Float32Array(pos.length / 3);
    for (let v = 0, i = 0; v < pos.length; v += 3, i++) {
      let occ = 0;
      for (const s of [0.35, 1]) {
        const e = ao * s;
        occ += Math.min(1, Math.max(0, f(pos[v] + n[v] * e, pos[v + 1] + n[v + 1] * e, pos[v + 2] + n[v + 2] * e) / e));
      }
      a[i] = occ / 2;
    }
    // normaliza: las SDF aproximadas (elipsoides) no dan distancia exacta → referencia = percentil 85
    const sorted = Float32Array.from(a).sort();
    const ref = Math.max(1e-3, sorted[Math.floor(sorted.length * 0.85)] || 1);
    for (let i = 0; i < a.length; i++) a[i] = Math.min(1, a[i] / ref);
    g.setAttribute('ao', new THREE.BufferAttribute(a, 1));
  }
  return g;
}
function orientFaces(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
  let score = 0;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < ix.length; t += 3 * 17) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    A.set(p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]);
    B.set(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]);
    C.crossVectors(A, B);
    score += C.x * n[a] + C.y * n[a + 1] + C.z * n[a + 2];
  }
  if (score < 0) for (let t = 0; t < ix.length; t += 3) { const s = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = s; }
}

/**
 * Trocea una geometría por regiones. classify(cx,cy,cz, nx,ny,nz) → clave (string) o null (descartar).
 * Devuelve Map clave → BufferGeometry compacta.
 */
export function splitGeometry(g, classify) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
  const buckets = new Map();
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    const key = classify(
      (p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3,
      (n[a] + n[b] + n[c]) / 3, (n[a + 1] + n[b + 1] + n[c + 1]) / 3, (n[a + 2] + n[b + 2] + n[c + 2]) / 3);
    if (key == null) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(ix[t], ix[t + 1], ix[t + 2]);
  }
  const out = new Map();
  const ao = g.attributes.ao?.array;
  for (const [key, list] of buckets) {
    const remap = new Map(), pos = [], nor = [], occ = [], idx = [];
    for (const v of list) {
      let r = remap.get(v);
      if (r === undefined) {
        r = pos.length / 3; remap.set(v, r);
        pos.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); nor.push(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
        if (ao) occ.push(ao[v]);
      }
      idx.push(r);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    if (ao) gg.setAttribute('ao', new THREE.Float32BufferAttribute(occ, 1));
    gg.setIndex(idx);
    out.set(key, gg);
  }
  return out;
}

/**
 * Acabado orgánico de una geometría SDF: hornea color por vértice
 * (base · oclusión · moteado, y grasa en los surcos si `fat`) y añade
 * microrrelieve perturbando las normales con ruido (sin coste de triángulos).
 * opts: { color, fat, fatK, aoK, mottle, bump, freq, seed, tint(x,y,z)→0..1, tintColor }
 */
export function organicFinish(g, noise, o = {}) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, A = g.attributes.ao?.array;
  const base = new THREE.Color(o.color || '#ffffff'), fat = o.fat ? new THREE.Color(o.fat) : null;
  const tintC = new THREE.Color(o.tintColor || '#ffffff');
  const aoK = o.aoK ?? 0.55, fatK = o.fatK ?? 1.6, mot = o.mottle ?? 0.08;
  const bump = o.bump ?? 0, fq = o.freq ?? 90, sd = o.seed ?? 0, e = 0.35 / fq;
  const col = new Float32Array(P.length), c = new THREE.Color(), v = new THREE.Vector3();
  const h = (x, y, z) => noise(x * fq, y * fq, z * fq, sd) + 0.5 * noise(x * fq * 2.3, y * fq * 2.3, z * fq * 2.3, sd + 1);
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i], y = P[i + 1], z = P[i + 2], ao = A ? A[i / 3] : 1;
    c.copy(base);
    if (fat) c.lerp(fat, Math.min(1, Math.max(0, (0.8 - ao) * fatK)));
    // tinte por campo continuo (mismo en trozos vecinos → sin bordes en sierra)
    if (o.tint) c.lerp(tintC, o.tint(x, y, z));
    const m = 1 + mot * noise(x * 14, y * 14, z * 14, sd + 7);
    const k = (1 - aoK + aoK * ao) * m;
    col[i] = c.r * k; col[i + 1] = c.g * k; col[i + 2] = c.b * k;
    if (bump > 0) {
      const gx = h(x + e, y, z) - h(x - e, y, z), gy = h(x, y + e, z) - h(x, y - e, z), gz = h(x, y, z + e) - h(x, y, z - e);
      v.set(N[i], N[i + 1], N[i + 2]);
      const d = gx * v.x + gy * v.y + gz * v.z;                     // quita la componente normal del gradiente
      v.x -= bump * (gx - d * v.x); v.y -= bump * (gy - d * v.y); v.z -= bump * (gz - d * v.z);
      v.normalize(); N[i] = v.x; N[i + 1] = v.y; N[i + 2] = v.z;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.attributes.normal.needsUpdate = true;
  return g;
}

/** Malla a partir de una geometría con normales ya calculadas. */
export function sdfMesh(geo, kind, mat) {
  const m = new THREE.Mesh(geo, makeMaterial(kind, mat));
  return m;
}

/** Órgano hueco: pared de grosor t; `inner(x,y,z)` añade relieve a la mucosa (positivo = hacia la luz). */
export function hollow(f, t, inner = null) {
  return (x, y, z) => {
    const d = f(x, y, z);
    const di = -(d + t) - (inner ? inner(x, y, z) : 0);
    return Math.max(d, di);
  };
}
