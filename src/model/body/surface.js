// ─────────────────────────────────────────────────────────────
// body/surface.js · Superficie analítica del tronco (barril)
// Da, para cada x (craneal..caudal), el centro y semiejes de la
// sección del cuerpo, con perfil superelíptico. Se usa tanto para
// construir la piel del tronco como para proyectar los puntos de las
// proyecciones parietales sobre la pared torácica.
// Coordenadas MUNDO: +X craneal, +Y dorsal, +Z izquierda.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Perfil del tronco. Define para una x dada: centro vertical cy, semialto h
 * (hacia arriba hTop y hacia abajo hBot distintos), semiancho w y exponente p.
 * Rango útil x ∈ [-2.05, 0.95] (de la cola a la base del cuello).
 */
// Perfil de vaca lechera Holstein. La TOPLINE (cy+hTop) hugs el esqueleto con
// ~2-3 cm de margen sobre las espinosas/escápula; nada de halo blanco.
// Referencias de hueso (tipos de espinosa, mundo):
//   cruz escápula ≈1.36 · espinosas T3-T7 ≈1.46 · lumbares ≈1.41-1.43
//   cresta sacra ≈1.32 · tuber coxae (hook) 1.27 · tuber ischii (pin) 1.07
// Silueta: cruz marcada, dorso recto, ijar (flanco) hundido, grupa con
// tuberosidades, nalga que cae hacia la cola.
const KEY = [
  // x,     cy,    hTop,  hBot,  w,     p
  [0.95, 1.06, 0.20, 0.30, 0.165, 2.4], // base del cuello (empalma con NECK_SKIN) top≈1.26
  [0.78, 1.05, 0.33, 0.40, 0.235, 2.5], // entrada del tórax → cruz             top≈1.38
  [0.55, 1.04, 0.44, 0.46, 0.290, 2.7], // cruz craneal (escápula)               top≈1.48
  [0.30, 1.04, 0.47, 0.52, 0.330, 2.9], // cruz (T2-T4, punto más alto)          top≈1.51
  [0.00, 1.05, 0.44, 0.57, 0.355, 3.1], // mitad tórax / dorso recto             top≈1.49
  [-0.35, 1.08, 0.40, 0.58, 0.378, 3.2], // tórax caudal / barril profundo       top≈1.48
  [-0.70, 1.12, 0.33, 0.58, 0.408, 3.2], // flanco: ijar hundido, barril ancho   top≈1.45
  [-1.05, 1.17, 0.27, 0.55, 0.415, 3.0], // lomo / fosa paralumbar (ijar)        top≈1.44
  [-1.36, 1.22, 0.22, 0.50, 0.405, 2.9], // grupa: tuber coxae (hook bones)      top≈1.44
  [-1.58, 1.19, 0.17, 0.46, 0.350, 2.8], // isquion (pin bones) / nalga          top≈1.36
  [-1.78, 1.14, 0.14, 0.38, 0.235, 2.7], // nalga posterior, redondeando         top≈1.28
  [-1.95, 1.10, 0.11, 0.26, 0.090, 2.5], // raíz de la cola (cierra el barril)   top≈1.21
];

function sample(x) {
  const xs = KEY[0][0], xe = KEY[KEY.length - 1][0];
  const xc = clamp(x, xe, xs);
  for (let k = 0; k < KEY.length - 1; k++) {
    const a = KEY[k], b = KEY[k + 1];
    if (xc <= a[0] && xc >= b[0]) {
      const t = (a[0] - xc) / (a[0] - b[0]);
      const s = t * t * (3 - 2 * t); // suavizado
      return {
        cy: lerp(a[1], b[1], s), hTop: lerp(a[2], b[2], s), hBot: lerp(a[3], b[3], s),
        w: lerp(a[4], b[4], s), p: lerp(a[5], b[5], s),
      };
    }
  }
  const a = KEY[0];
  return { cy: a[1], hTop: a[2], hBot: a[3], w: a[4], p: a[5] };
}

/** Semiancho (z) del tronco a la altura x. */
export function bodyHalfWidth(x) { return sample(x).w; }

/**
 * Punto de la superficie del tronco para (x, ángulo a). a=0 dorsal, a=±π/2 lado,
 * a=π ventral. Perfil superelíptico (exponente p). Devuelve Vector3 (mundo).
 */
export function bodyPoint(x, a) {
  const s = sample(x);
  const ex = 2 / s.p;
  const cy = Math.cos(a), sz = Math.sin(a);
  const yy = Math.sign(cy) * Math.pow(Math.abs(cy), ex);
  const zz = Math.sign(sz) * Math.pow(Math.abs(sz), ex);
  const h = yy >= 0 ? s.hTop : s.hBot;
  return V(x, s.cy + yy * h, zz * s.w);
}

/**
 * Proyecta un punto (x, y) del plano medio sobre la pared lateral del tronco
 * en el lado `side` (+1 izq, −1 dcha) y lo desplaza `off` hacia fuera (normal).
 * Útil para dibujar las proyecciones parietales pegadas a la piel.
 */
export function projectToWall(x, y, side = 1, off = 0.004) {
  const s = sample(x);
  // ¿a qué ángulo corresponde esa altura en el flanco? resolvemos cy en [−1,1]
  const dy = (y - s.cy);
  const h = dy >= 0 ? s.hTop : s.hBot;
  let cy = clamp(dy / h, -0.999, 0.999);
  // el punto está en el costado: sz>0 (lado izq). a desde dorsal.
  const ex = 2 / s.p;
  // cy = sign*|cos|^ex  → |cos| = |cy|^(1/ex)
  const cosA = Math.sign(cy) * Math.pow(Math.abs(cy), 1 / ex);
  const aRaw = Math.acos(clamp(cosA, -1, 1));   // ∈[0,π], asume lado +z
  const a = side >= 0 ? aRaw : -aRaw;
  const P = bodyPoint(x, a);
  // normal aproximada del elipsoide en ese punto (gradiente)
  const n = wallNormal(x, a).multiplyScalar(off);
  return P.add(n);
}

/** Normal exterior aproximada de la pared en (x, a). */
export function wallNormal(x, a) {
  const e = 0.012;
  const p0 = bodyPoint(x, a);
  const pa = bodyPoint(x, a + 0.05);
  const px = bodyPoint(x + e, a);
  const ta = pa.clone().sub(p0);
  const tx = px.clone().sub(p0);
  const n = new THREE.Vector3().crossVectors(tx, ta).normalize();
  // orientar hacia fuera (misma dirección que el radio lateral)
  const radial = V(0, p0.y - sample(x).cy, p0.z).normalize();
  if (n.dot(radial) < 0) n.negate();
  return n;
}

export { V, lerp };
