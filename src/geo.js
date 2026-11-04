// ─────────────────────────────────────────────────────────────
// geo.js · API compartida de modelado procedural
// Ejes del mundo: +X craneal, +Y dorsal (suelo y=0), +Z lado IZQUIERDO.
// Unidades: metros (vaca adulta ~1.4 m a la cruz).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Capas visibles (filtros de la UI). */
export const LAYERS = {
  piel:       { label: 'Piel',        color: '#e8d6c3' },
  hueso:      { label: 'Huesos',      color: '#e9dfc8' },
  musculo:    { label: 'Músculos',    color: '#c4554f' },
  vaso:       { label: 'Vasos',       color: '#d63a3a' },
  nervio:     { label: 'Nervios',     color: '#f2c94c' },
  linfa:      { label: 'Linfáticos',  color: '#6cc08a' },
  glandula:   { label: 'Glándulas',   color: '#e59ab4' },
  seno:       { label: 'Senos',       color: '#5ab4e6' },
  cavidad:    { label: 'Cavidades',   color: '#e88a8a' },
  viscera:    { label: 'Vísceras',    color: '#a8323c' },
  proyeccion: { label: 'Proyecciones',color: '#ff4d6d' },
};

/** Presets de material por tipo. `layer` = capa por defecto. */
const KINDS = {
  bone:      { layer: 'hueso',   color: '#ece2cc', roughness: 0.55, clearcoat: 0.25 },
  bone2:     { layer: 'hueso',   color: '#dccfb2', roughness: 0.6 },
  cartilage: { layer: 'hueso',   color: '#c9e0e3', roughness: 0.35, clearcoat: 0.4 },
  tooth:     { layer: 'hueso',   color: '#fbf6ea', roughness: 0.2, clearcoat: 0.6 },
  horn:      { layer: 'piel',    color: '#4d3d30', roughness: 0.4, clearcoat: 0.3 },
  horn2:     { layer: 'piel',    color: '#9c8a70', roughness: 0.5 },
  ligament:  { layer: 'musculo', color: '#eadbb8', roughness: 0.45, clearcoat: 0.3 },
  muscle:    { layer: 'musculo', color: '#c4554f', roughness: 0.62, sheen: 0.4, sheenColor: '#ffb3a8' },
  muscle2:   { layer: 'musculo', color: '#a94545', roughness: 0.62, sheen: 0.4, sheenColor: '#ffb3a8' },
  muscle3:   { layer: 'musculo', color: '#d97a5f', roughness: 0.62, sheen: 0.4, sheenColor: '#ffd0b8' },
  artery:    { layer: 'vaso',    color: '#d83a3a', roughness: 0.35, clearcoat: 0.5 },
  vein:      { layer: 'vaso',    color: '#3b5bd6', roughness: 0.35, clearcoat: 0.5 },
  lymphduct: { layer: 'linfa',   color: '#d9c45a', roughness: 0.4 },
  nerve:     { layer: 'nervio',  color: '#f2c94c', roughness: 0.4, emissive: '#5a4300' },
  ganglion:  { layer: 'nervio',  color: '#e8a93a', roughness: 0.4, emissive: '#4a2c00' },
  lymph:     { layer: 'linfa',   color: '#6cc08a', roughness: 0.45, clearcoat: 0.3 },
  gland:     { layer: 'glandula',color: '#e59ab4', roughness: 0.6 },
  thyroid:   { layer: 'glandula',color: '#a5486a', roughness: 0.5 },
  thymus:    { layer: 'glandula',color: '#ecd2b4', roughness: 0.6 },
  sinus:     { layer: 'seno',    color: '#4fb0ec', roughness: 0.2, transparent: true, opacity: 0.42, depthWrite: false },
  cavity:    { layer: 'cavidad', color: '#e88a8a', roughness: 0.45, clearcoat: 0.4 },
  mucosa:    { layer: 'cavidad', color: '#f0a0a0', roughness: 0.4, clearcoat: 0.5 },
  tongue:    { layer: 'cavidad', color: '#d9797a', roughness: 0.55 },
  airspace:  { layer: 'cavidad', color: '#7fd3f0', roughness: 0.2, transparent: true, opacity: 0.35, depthWrite: false },
  lung:      { layer: 'viscera', color: '#f2a7ad', roughness: 0.7, sheen: 0.6, sheenColor: '#ffe0e4' },
  heart:     { layer: 'viscera', color: '#a8323c', roughness: 0.45, clearcoat: 0.4 },
  atrium:    { layer: 'viscera', color: '#8b2a3c', roughness: 0.45, clearcoat: 0.4 },
  fat:       { layer: 'viscera', color: '#f2dc96', roughness: 0.5 },
  valve:     { layer: 'viscera', color: '#f6efe0', roughness: 0.3 },
  liver:     { layer: 'viscera', color: '#7b2f2a', roughness: 0.4, clearcoat: 0.4 },
  stomach:   { layer: 'viscera', color: '#b98f70', roughness: 0.6 },
  serosa:    { layer: 'viscera', color: '#f5e3d6', roughness: 0.3, transparent: true, opacity: 0.22, depthWrite: false },
  diaphragm: { layer: 'musculo', color: '#c9705f', roughness: 0.55, transparent: true, opacity: 0.55, depthWrite: false },
  skin:      { layer: 'piel',    color: '#efe1d1', roughness: 0.8, transparent: true, opacity: 0.16, depthWrite: false },
  nose:      { layer: 'piel',    color: '#5b4a4c', roughness: 0.35, clearcoat: 0.5 },
  eye:       { layer: 'piel',    color: '#1b1716', roughness: 0.05, clearcoat: 1 },
  projection:{ layer: 'proyeccion', color: '#ff4d6d', basic: true },
  projection2:{ layer: 'proyeccion', color: '#2bb3a6', basic: true },
  area:      { layer: 'proyeccion', color: '#ff4d6d', basic: true, transparent: true, opacity: 0.22, depthWrite: false },
  marker:    { layer: 'proyeccion', color: '#ffffff', basic: true },
};

export function makeMaterial(kind = 'bone', over = {}) {
  const k = { ...(KINDS[kind] || KINDS.bone), ...over };
  const common = {
    color: new THREE.Color(k.color),
    transparent: !!k.transparent,
    opacity: k.opacity ?? 1,
    depthWrite: k.depthWrite ?? true,
    side: k.side ?? THREE.FrontSide,
  };
  let m;
  if (k.basic) {
    m = new THREE.MeshBasicMaterial({ ...common, toneMapped: false });
  } else {
    m = new THREE.MeshPhysicalMaterial({
      ...common,
      roughness: k.roughness ?? 0.5,
      metalness: 0,
      clearcoat: k.clearcoat ?? 0,
      clearcoatRoughness: 0.4,
      sheen: k.sheen ?? 0,
      sheenColor: new THREE.Color(k.sheenColor || '#ffffff'),
      emissive: new THREE.Color(k.emissive || '#000000'),
    });
  }
  m.userData.baseOpacity = common.opacity;
  m.userData.baseTransparent = common.transparent;
  m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null;
  m.userData.kind = kind;
  return m;
}
export const kindLayer = (kind) => (KINDS[kind] || KINDS.bone).layer;

// ── Registro ────────────────────────────────────────────────
export const root = new THREE.Group();
root.name = 'vaca';
/** ref → Object3D[] */
export const registry = new Map();
/** todas las mallas (pickables y de contexto) */
export const allMeshes = [];

/**
 * Añade `obj` a `parent` (por defecto root) y lo vincula a `ref` (id del catálogo).
 * ref = null → malla de contexto (visible, filtrable por capa, no seleccionable).
 * layer: capa explícita; si se omite se deduce del material.
 */
export function place(ref, obj, layer, parent = root) {
  parent.add(obj);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const kind = o.material?.userData?.kind;
    o.userData.ref = ref;
    o.userData.layer = layer || kindLayer(kind);
    allMeshes.push(o);
  });
  if (ref) {
    if (!registry.has(ref)) registry.set(ref, []);
    registry.get(ref).push(obj);
  }
  return obj;
}

/** Coloca obj y su espejo (z→−z respecto al plano medio del padre). */
export function both(ref, obj, layer, parent = root) {
  place(ref, obj, layer, parent);
  const m = mirrorZ(obj);
  place(ref, m, layer, parent);
  return [obj, m];
}

/**
 * Espejo z→−z en el espacio del padre, horneado en la geometría
 * (sin escala negativa: evita normales/caras invertidas con DoubleSide y cortes).
 * Devuelve un Group plano con las mallas reflejadas (Line/Points se clonan con escala).
 */
const _S = new THREE.Matrix4().makeScale(1, 1, -1);
export function mirrorZ(obj) {
  obj.updateWorldMatrix(true, true);
  const inv = obj.parent ? obj.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const out = new THREE.Group();
  out.name = obj.name; out.userData = { ...obj.userData };
  obj.traverse((o) => {
    if (!o.isMesh && !o.isLine && !o.isPoints) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld).premultiply(_S);
    const g = o.geometry.clone();
    g.applyMatrix4(rel);
    if (o.isMesh) {
      // la reflexión invierte el sentido de las caras: se restaura el orden
      if (g.index) {
        const a = g.index.array;
        for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; }
        g.index.needsUpdate = true;
      } else {
        for (const attr of Object.values(g.attributes)) {
          const s = attr.itemSize, arr = attr.array;
          for (let i = 0; i < attr.count; i += 3) for (let k = 0; k < s; k++) {
            const t = arr[(i + 1) * s + k]; arr[(i + 1) * s + k] = arr[(i + 2) * s + k]; arr[(i + 2) * s + k] = t;
          }
          attr.needsUpdate = true;
        }
      }
      g.computeVertexNormals();
    }
    const m = new o.constructor(g, Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone());
    m.name = o.name; m.userData = { ...o.userData }; m.renderOrder = o.renderOrder; m.visible = o.visible;
    out.add(m);
  });
  return out;
}

// ── Utilidades numéricas ────────────────────────────────────
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const toV = (p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2] ?? 0));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

// ruido 3D (value noise) determinista
function hash(x, y, z, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453;
  return h - Math.floor(h);
}
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  let v = 0;
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) for (let dz = 0; dz < 2; dz++) {
    const w = (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
    v += w * hash(xi + dx, yi + dy, zi + dz, seed);
  }
  return v * 2 - 1;
}

// ── Primitivas ──────────────────────────────────────────────
function mesh(geo, kind, matOver) {
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, makeMaterial(kind, matOver));
  m.castShadow = false; m.receiveShadow = false;
  return m;
}

/**
 * Tubo suave por puntos. r = número o función r(t) (t∈[0,1]).
 * opts: { segs, radial, closed, cap (bool, tapa extremos), mat }
 */
export function tube(points, r = 0.01, kind = 'artery', opts = {}) {
  const pts = points.map(toV);
  const curve = new THREE.CatmullRomCurve3(pts, !!opts.closed, 'centripetal');
  const segs = opts.segs ?? Math.max(16, pts.length * 12);
  const radial = opts.radial ?? 12;
  const rf = typeof r === 'function' ? r : () => r;
  const frames = curve.computeFrenetFrames(segs, !!opts.closed);
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const P = curve.getPointAt(t);
    const N = frames.normals[i], B = frames.binormals[i];
    const rr = rf(t);
    const sx = opts.flat ? opts.flat : 1;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * rr, s = Math.sin(a) * rr * sx;
      pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  if (opts.cap !== false && !opts.closed) {
    for (const end of [0, segs]) {
      const P = curve.getPointAt(end / segs);
      const ci = pos.length / 3; pos.push(P.x, P.y, P.z);
      const base = end * (radial + 1);
      for (let j = 0; j < radial; j++) {
        if (end === 0) idx.push(ci, base + j + 1, base + j); else idx.push(ci, base + j, base + j + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = mesh(g, kind, opts.mat);
  m.userData.curve = curve;
  return m;
}

/**
 * Elipsoide orgánico. radii=[rx,ry,rz]; opts: { rot:[x,y,z], noise (0-0.3), freq, seed, detail, mat, squash(fn) }
 * opts.deform(v) permite deformar cada vértice (en espacio local unitario escalado).
 */
export function blob(center, radii, kind = 'gland', opts = {}) {
  // Icosaedro indexado: sin esto cada cara tiene sus vértices y las normales salen planas (facetas)
  const ico = new THREE.IcosahedronGeometry(1, opts.detail ?? 4);
  ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
  const g = mergeVertices(ico, 1e-5); ico.dispose();
  const p = g.attributes.position; const v = new THREE.Vector3();
  const n = opts.noise ?? 0.06, f = opts.freq ?? 2.2, seed = opts.seed ?? 1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + n * noise3(v.x * f + 10, v.y * f + 20, v.z * f + 30, seed);
    v.multiplyScalar(k);
    v.set(v.x * radii[0], v.y * radii[1], v.z * radii[2]);
    if (opts.deform) opts.deform(v);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  const m = mesh(g, kind, opts.mat);
  m.position.copy(toV(center));
  if (opts.rot) m.rotation.set(...opts.rot);
  return m;
}

/**
 * Loft: barrido de secciones superelípticas a lo largo de un camino.
 * section(t) → { w (semiancho, eje lateral), h (semialto), p (exponente, 2=elipse, >2 más cuadrado),
 *                dy (desplazamiento vertical local), dz, wTop?, wBot? (semiancho arriba/abajo opcional) }
 * opts: { segs, radial, up:[0,1,0], caps:true, mat }
 */
export function loft(points, section, kind = 'skin', opts = {}) {
  const pts = points.map(toV);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = opts.segs ?? 80, radial = opts.radial ?? 40;
  const up = toV(opts.up || [0, 1, 0]);
  const pos = [], idx = [];
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const P = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    B.crossVectors(T, up).normalize();     // lateral
    if (B.lengthSq() < 1e-6) B.set(0, 0, 1);
    N.crossVectors(B, T).normalize();      // "arriba" local
    const s = section(t);
    const pe = s.p ?? 2;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const ex = 2 / pe;
      const cy = Math.sign(ca) * Math.pow(Math.abs(ca), ex);  // vertical
      const cz = Math.sign(sa) * Math.pow(Math.abs(sa), ex);  // lateral
      const w = cy > 0 ? (s.wTop ?? s.w) * (cy) + s.w * (1 - cy) : (s.wBot ?? s.w) * (-cy) + s.w * (1 + cy);
      const yy = cy * s.h + (s.dy || 0), zz = cz * w + (s.dz || 0);
      pos.push(P.x + N.x * yy + B.x * zz, P.y + N.y * yy + B.y * zz, P.z + N.z * yy + B.z * zz);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  if (opts.caps !== false) {
    for (const end of [0, segs]) {
      const P = curve.getPointAt(end / segs); const s = section(end / segs);
      const ci = pos.length / 3;
      pos.push(P.x, P.y + 0, P.z); // centro aproximado
      const base = end * (radial + 1);
      for (let j = 0; j < radial; j++) {
        if (end === 0) idx.push(ci, base + j, base + j + 1); else idx.push(ci, base + j + 1, base + j);
      }
      void s;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return mesh(g, kind, opts.mat);
}

/**
 * Lámina extruida a partir de un contorno 2D (plano XY local). depth = grosor (en Z local).
 * opts: { bevel (tamaño), curveSegments, holes:[[[x,y],...]], mat }
 */
export function sheet(outline, depth = 0.01, kind = 'muscle', opts = {}) {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of opts.holes || []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const bev = opts.bevel ?? Math.min(depth * 0.45, 0.006);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 3,
    curveSegments: opts.curveSegments ?? 24, steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return mesh(g, kind, opts.mat);
}

/**
 * Lámina curva: superficie gruesa definida por una función de parche.
 * fn(u,v) → Vector3 (u,v ∈ [0,1]); thickness hacia la normal. Útil para músculos que cubren huesos.
 */
export function patch(fn, thickness = 0.008, kind = 'muscle', opts = {}) {
  const nu = opts.nu ?? 24, nv = opts.nv ?? 24;
  const pos = [], idx = [];
  const grid = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) grid.push(fn(i / nu, j / nv));
  const at = (i, j) => grid[i * (nv + 1) + j];
  const normals = [];
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const a = at(Math.min(i + 1, nu), j).clone().sub(at(Math.max(i - 1, 0), j));
    const b = at(i, Math.min(j + 1, nv)).clone().sub(at(i, Math.max(j - 1, 0)));
    normals.push(a.cross(b).normalize());
  }
  // espesor que se adelgaza en los bordes
  const edge = (i, j) => {
    const u = i / nu, v = j / nv;
    return Math.min(1, 4 * Math.min(u, 1 - u) + 0.15) * Math.min(1, 4 * Math.min(v, 1 - v) + 0.15);
  };
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const k = i * (nv + 1) + j;
      const P = grid[k], Nn = normals[k];
      const d = side === 0 ? thickness * edge(i, j) * 0.5 : -thickness * edge(i, j) * 0.5;
      pos.push(P.x + Nn.x * d, P.y + Nn.y * d, P.z + Nn.z * d);
    }
  }
  const off = (nu + 1) * (nv + 1);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + nv + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
    idx.push(off + a, off + a + 1, off + b, off + b, off + a + 1, off + b + 1);
  }
  // bordes
  const ring = [];
  for (let i = 0; i <= nu; i++) ring.push(i * (nv + 1));
  for (let j = 1; j <= nv; j++) ring.push(nu * (nv + 1) + j);
  for (let i = nu - 1; i >= 0; i--) ring.push(i * (nv + 1) + nv);
  for (let j = nv - 1; j >= 1; j--) ring.push(j);
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r], b = ring[(r + 1) % ring.length];
    idx.push(a, off + a, b, b, off + a, off + b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = mesh(g, kind, { side: THREE.DoubleSide, ...(opts.mat || {}) });
  return m;
}

/** Punto de referencia (agujeros, puntos clínicos, nódulos pequeños…). */
export function marker(p, color = '#ffffff', size = 0.012, kind = 'marker') {
  const g = new THREE.SphereGeometry(size, 20, 14);
  const m = mesh(g, kind, { color });
  m.position.copy(toV(p));
  m.renderOrder = 5;
  return m;
}

/** Anillo (para agujeros/orificios). normal = dirección del eje del anillo. */
export function ring(p, normal, r = 0.01, tubeR = 0.0025, kind = 'marker', color) {
  const g = new THREE.TorusGeometry(r, tubeR, 10, 32);
  const m = mesh(g, kind, color ? { color } : undefined);
  m.position.copy(toV(p));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toV(normal).normalize());
  return m;
}

/** Línea de proyección (tubo fino). dashed=true → discontinua. */
export function pathLine(points, kind = 'projection', r = 0.0035, opts = {}) {
  if (!opts.dashed) return tube(points, r, kind, { radial: 8, ...opts });
  const pts = points.map(toV);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const dash = opts.dash ?? 0.03, gap = opts.gap ?? 0.018;
  const group = new THREE.Group();
  for (let s = 0; s < len; s += dash + gap) {
    const a = s / len, b = Math.min(1, (s + dash) / len);
    const seg = [0, 0.5, 1].map((k) => curve.getPointAt(lerp(a, b, k)));
    group.add(tube(seg, r, kind, { radial: 8, segs: 4 }));
  }
  return group;
}

/** Superficie plana semitransparente a partir de un polígono 3D casi plano (abanico). */
export function area(points, kind = 'area', opts = {}) {
  const pts = points.map(toV);
  const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  const pos = [c.x, c.y, c.z]; const idx = [];
  pts.forEach((p) => pos.push(p.x, p.y, p.z));
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return mesh(g, kind, { side: THREE.DoubleSide, ...(opts.mat || {}) });
}

/** Agrupa varias mallas en un Group (para registrar una estructura compuesta). */
export function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => g.add(c));
  return g;
}

export { THREE };
