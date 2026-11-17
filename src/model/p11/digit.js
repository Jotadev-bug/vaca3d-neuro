// ─────────────────────────────────────────────────────────────
// p11/digit.js · Porción distal de un miembro (vacuno, lado izq):
// cabeza del metápodo III+IV, falanges ×2, sesamoideos, articulaciones,
// tendones digitales y pezuña (pared axial/abaxial, suela, línea blanca,
// bulbo, corona, limbo). Se instancia en mano (con refs) y pie (contexto).
// Coordenadas: dedo III medial (z menor) y IV lateral; +x hacia la punta.
// ─────────────────────────────────────────────────────────────
import { E, S, K, U, D, part, parts, T, tubeMesh, group, clamp, lerp, V, THREE } from './kit.js';

const BONE = '#ece2cc';
/** Puntos de referencia de los dedos (sin construir nada): para colocar tendones. */
export function digitPoints({ x0, z0, yF = 0.125 }) {
  const out = { p3: [], p2: [], p1: [], ses: [] };
  for (const dz of [-0.024, 0.024]) {
    const zc = z0 + dz;
    out.p1.push([x0 + 0.002, yF - 0.007, zc - dz * 0.35]);
    out.p2.push([x0 + 0.026, yF - 0.077, zc]);
    out.p3.push([x0 + 0.027, 0.05, zc]);
    out.ses.push([x0 - 0.026, yF, zc]);
  }
  return out;
}
/**
 * o = { x0, z0 (centro del metápodo en el menudillo), yF (altura del menudillo), refs (bool), tag }
 * Devuelve puntos útiles para los tendones del miembro.
 */
export function buildDigits(o) {
  const { x0, z0, yF = 0.125, refs = true } = o;
  const r = (id) => (refs ? id : `pie_${id}`);
  const out = { p3: [], p2: [], p1: [], ses: [] };
  for (const [dz, dig] of [[-0.024, 'III'], [0.024, 'IV']]) {
    const zc = z0 + dz, ax = Math.sign(-dz);                    // ax: dirección axial (hacia la línea media del pie)
    const zAx = z0 + ax * -0.003;                               // cara axial plana de la pezuña
    // ── falanges
    const P1a = [x0 + 0.002, yF - 0.007, zc - dz * 0.35], P1b = [x0 + 0.016, yF - 0.05, zc];
    const P2b = [x0 + 0.026, yF - 0.077, zc];
    part(r('falange_proximal'), U([K([P1a, P1b], [0.0115, 0.0095]), E(P1a, [0.012, 0.009, 0.011]), E(P1b, [0.011, 0.008, 0.011])], 0.006), { color: BONE, step: 0.0025, mirror: true, layer: 'hueso' });
    part(r('falange_media'), U([K([P1b, P2b], [0.0098, 0.0092]), E(P2b, [0.01, 0.007, 0.0105])], 0.005), { color: '#e6dbc2', step: 0.0025, mirror: true, layer: 'hueso' });
    // falange distal: cuña dentro del estuche córneo (caras axial/abaxial, tubérculo flexor)
    const p3c = [x0 + 0.03, 0.027, zc];
    let p3 = E(p3c, [0.027, 0.018, 0.0125], [0, 0, -0.32]);
    const p3e = p3.f, zP = zAx - ax * 0.004;
    p3 = { ...p3, f: (x, y, z) => Math.max(p3e(x, y, z), 0.006 - y, ax * (z - zP)) };
    p3 = U([p3, E([x0 + 0.027, 0.046, zc], [0.009, 0.006, 0.009]), E([x0 + 0.014, 0.017, zc], [0.008, 0.006, 0.008])], 0.006);
    parts(p3, (x, y, z, nx, ny, nz) => {
      if (x < x0 + 0.02 && y < 0.03) return 'tub';
      if (ny < -0.6) return 'sol';
      return ax * nz > 0.25 ? 'axial' : 'abaxial';
    }, {
      axial: { ref: r('fd_cara_axial'), color: BONE }, abaxial: { ref: r('fd_cara_abaxial'), color: '#efe6d2' },
      tub: { ref: r('fd_tuberculo_flexor'), color: '#e3d4b4' }, sol: { ref: r('falange_distal'), color: '#ddd0b4' },
    }, { step: 0.0022, mirror: true, layer: 'hueso', kind: 'bone' });
    // ── sesamoideos proximales (2 por dedo) y distal
    const ses = [];
    for (const s of [-0.006, 0.006]) ses.push(E([x0 - 0.02, yF + 0.002, zc + s], [0.008, 0.011, 0.0055], [0, 0, 0.25]));
    part(r('sesamoideos_prox'), U(ses, 0.002), { color: '#e9dfc8', step: 0.0018, mirror: true, layer: 'hueso' });
    part(r('sesamoideo_distal'), E([x0 + 0.012, 0.042, zc], [0.0055, 0.004, 0.009]), { color: '#e9dfc8', step: 0.0015, mirror: true, layer: 'hueso' });
    // ── articulaciones (cápsulas translúcidas) y ligamentos colaterales interfalangianos proximales
    const cap = { kind: 'cartilage', layer: 'hueso', mirror: true, mat: { transparent: true, opacity: 0.38, depthWrite: false } };
    part(r('art_metacarpofalangiana'), S([x0 - 0.002, yF, zc - dz * 0.4], 0.0165), { ...cap, color: '#9fd0dc', step: 0.003 });
    part(r('art_interfalangiana_prox'), S(P1b, 0.0125), { ...cap, color: '#a7d7c5', step: 0.0025 });
    part(r('art_interfalangiana_dist'), S([P2b[0] + 0.004, P2b[1] - 0.006, zc], 0.0115), { ...cap, color: '#c3b6e6', step: 0.0025 });
    const colL = [];
    for (const s of [-1, 1]) colL.push(tubeMesh([[P1b[0] - 0.012, P1b[1] + 0.012, zc + s * 0.011], [P1b[0], P1b[1], zc + s * 0.012], [P1b[0] + 0.008, P1b[1] - 0.012, zc + s * 0.011]], 0.0022, 'ligament', { radial: 6 }));
    group(r('ligg_colaterales_ifp'), colL, 'musculo', true);
    // ── pezuña (estuche córneo) de este dedo
    buildClaw({ x0, zc, zAx, ax, refs });
    out.p1.push(P1a); out.p2.push(P2b); out.p3.push([x0 + 0.027, 0.05, zc]); out.ses.push([x0 - 0.026, yF, zc]);
    void dig;
  }
  return out;
}

/** Estuche córneo de un dedo (sólido aproximado) troceado en sus partes. */
function buildClaw({ x0, zc, zAx, ax, refs }) {
  const r = (id) => (refs ? id : `pie_${id}`);
  const heel = x0 - 0.018, toe = x0 + 0.075;
  const xT = (y) => toe - 0.62 * y, xH = (y) => heel + 0.15 * y;
  const yTop = (x) => lerp(0.036, 0.07, clamp((x - heel) / (toe - heel), 0, 1));
  const azF = (y) => 0.0215 * (1 - 0.25 * y / 0.07);
  const f = (x, y, z) => {
    const xa = xT(Math.max(0, y)), xb = xH(Math.max(0, y)), xc = (xa + xb) / 2, a = (xa - xb) / 2, az = azF(y);
    const q = Math.hypot((x - xc) / a, (z - zc) / az);
    const dE = (q - 1) * Math.min(a, az);
    return Math.max(dE, -y, y - yTop(x), ax * (zAx - z) * -1);
  };
  const s = { f, lo: [heel - 0.01, -0.004, zc - 0.03], hi: [toe + 0.01, 0.08, zc + 0.03] };
  parts(s, (x, y, z, nx, ny, nz) => {
    if (ny < -0.75 && y < 0.004) {
      const xa = xT(0), xb = xH(0), xc = (xa + xb) / 2, a = (xa - xb) / 2;
      const q = Math.hypot((x - xc) / a, (z - zc) / azF(0));
      const nearAx = Math.abs(z - zAx) < 0.0035;
      return q > 0.84 || nearAx ? 'lb' : 'suela';
    }
    if (ny > 0.55) return null;                       // tapa superior (dentro de la piel)
    return ax * nz > 0.6 ? 'axial' : 'abaxial';
  }, {
    axial: { ref: r('pez_pared_axial'), color: '#4d3d30', kind: 'horn' },
    abaxial: { ref: r('pez_pared_abaxial'), color: '#5a4636', kind: 'horn' },
    suela: { ref: r('pez_suela'), color: '#8a7860', kind: 'horn2' },
    lb: { ref: r('pez_linea_blanca'), color: '#e9e0c8', kind: 'horn2' },
  }, { step: 0.0025, mirror: true, layer: 'piel', fin: { bump: 0.07, freq: 240, aoK: 0.35 } });
  // bulbo (almohadilla digital): blando, en el talón
  part(r('pez_bulbo'), E([heel + 0.012, 0.018, zc], [0.02, 0.02, 0.0165]), { kind: 'horn2', color: '#cfae92', layer: 'piel', step: 0.0025, mirror: true });
  // corona y limbo (periople): bandas en el borde coronario
  const ring = (dy, sc) => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const xa = xT(0.06), xb = xH(0.04), xc = (xa + xb) / 2, a = (xa - xb) / 2 * sc;
      let x = xc + a * Math.cos(t), z = zc + azF(0.05) * sc * Math.sin(t);
      if (ax * (zAx - z) * -1 > 0) z = zAx;
      pts.push(V(x, yTop(x) + dy, z));
    }
    return pts;
  };
  T(r('pez_corona'), ring(0.004, 1.0), 0.0042, 'horn2', { color: '#c79a86', mirror: true, layer: 'piel', segs: 80, radial: 8 });
  T(r('pez_limbo'), ring(-0.0005, 1.02), 0.0022, 'horn2', { color: '#efe4cf', mirror: true, layer: 'piel', segs: 80, radial: 6 });
}
export { V };
