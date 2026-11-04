// ─────────────────────────────────────────────────────────────
// thorax.js · Módulo TÓRAX (cavidad torácica 9.6)
// Pulmones, corazón, mediastino, grandes vasos, nervios, linfáticos,
// diafragma + vísceras abdominales craneales (hígado, retículo).
// Mundo: +X craneal · +Y dorsal (suelo y=0) · +Z lado IZQUIERDO · metros.
// ─────────────────────────────────────────────────────────────
import {
  place, both, tube, blob, loft, sheet, patch, marker, ring, pathLine, area, group, V, lerp, THREE,
} from '../geo.js';
import {
  THORACIC, RIB_HALFWIDTH, STERNUM, XIPHOID, sternumY, costochondral, ribPath, cartilagePath,
  diaphragmAttachment, DIAPHRAGM_DOME, HEART, TRACHEA, TRACHEA_R, TRACHEAL_BRONCHUS_ORIGIN,
  BIFURCATION, ESOPHAGUS, ESOPHAGUS_R, JUGULAR, intercostalX, ribXAtY,
} from '../frame.js';

// ── Helpers geométricos de la pared torácica interior ──────────
// Semiancho (z) de la cavidad pleural a (x,y): a partir del semiancho máximo de
// la costilla cuyo nivel corresponde a x, descontando ~1.5 cm de pared.
const RIBS_X = THORACIC.map((d) => d.x);                 // 0.31 .. -0.74
function ribIndexAtX(x) {
  // devuelve índice fraccional 0..12 (costilla 1..13) por x
  let t = (0.31 - x) / 0.0875;
  return Math.max(0, Math.min(12, t));
}
/** Semiancho interior de la cavidad pleural en (x,y). Resta pared y techo vertebral. */
function innerHalfWidth(x, y) {
  const fi = ribIndexAtX(x);
  const i0 = Math.floor(fi), i1 = Math.min(12, i0 + 1), f = fi - i0;
  const hw = lerp(RIB_HALFWIDTH[i0], RIB_HALFWIDTH[i1], f);
  // factor de altura: el tórax es más estrecho cerca del esternón (ventral) y del techo
  const yTop = 1.10, yBot = 0.70;
  const yn = Math.max(0, Math.min(1, (y - yBot) / (yTop - yBot)));
  // perfil elíptico vertical: máximo a media altura
  const vprof = Math.sqrt(Math.max(0, 1 - Math.pow((yn - 0.52) / 0.62, 2)));
  return Math.max(0.02, hw * vprof - 0.016);
}
/** Techo (y dorsal) de la cavidad: bajo los cuerpos vertebrales. */
function roofY(x) {
  const fi = ribIndexAtX(x), i0 = Math.floor(fi), i1 = Math.min(12, i0 + 1), f = fi - i0;
  return lerp(THORACIC[i0].y, THORACIC[i1].y, f) - 0.03;
}
/** Suelo (esternón) aproximado. */
function floorY(x) {
  return sternumY(x) + 0.015;
}
/**
 * Cara craneal (ventral) del diafragma a un (x,z): altura y por debajo de la cual
 * el pulmón ya no puede bajar (apoyo sobre la cúpula diafragmática).
 * La cúpula es más craneal (x mayor) en el centro (z≈0) y retrocede caudal y dorsalmente.
 */
function diaphragmSurfaceX(y, z) {
  // x de la cara craneal del diafragma a una altura y y una z dadas.
  // Centro de la cúpula ~ x=-0.20 a media altura; dorsal (y alto) retrocede a ~-0.70.
  const dome = DIAPHRAGM_DOME;           // (-0.24, 0.94, 0)
  const yn = (y - 0.70) / (1.14 - 0.70); // 0 ventral .. 1 dorsal
  const back = lerp(-0.02, -0.46, Math.max(0, Math.min(1, yn))); // dorsal mucho más caudal
  const lateral = -0.10 * Math.pow(Math.min(1, Math.abs(z) / 0.30), 2); // bordes retroceden
  return dome.x + back + lateral;        // x craneal-límite del pulmón
}

const COLORS = {
  lungL: '#f3abb1', lungR: '#f0a6ad',
};

// ── Modelado del pulmón como "molde" de la cavidad pleural ─────
// En vez de un elipsoide clampeado, deformamos la esfera unidad para que:
//  · la cara costal (lateral, |z| creciente) copie la pared torácica interior,
//  · la cara mediastínica (hacia z=0) sea casi plana,
//  · el techo suba hasta bajo los cuerpos vertebrales,
//  · la base se apoye cóncava sobre la cúpula del diafragma,
//  · los bordes (ventral y basal) sean finos.
// opts: { side, xCranial, xCaudal, yFloorFn, zMedial, hollowBase, notch }
function makeLungFill(center, o) {
  const side = o.side;                 // +1 izq, -1 dcho
  const xCr = o.xCranial, xCd = o.xCaudal;
  const zMed = (o.zMedial ?? 0.012) * side;   // cara medial (plana) cercana al plano medio
  return (v) => {
    // v está en espacio local (radio ~ radii). Trabajamos en mundo.
    let wx = center.x + v.x, wy = center.y + v.y, wz = center.z + v.z;

    // 1 · recorte craneal / caudal (los extremos se afinan, no se cortan planos)
    if (xCd != null) {
      const dlim = diaphragmSurfaceX(wy, wz);
      const lim = Math.max(xCd, dlim);
      if (wx < lim) wx = lerp(wx, lim, 0.9);
    }
    if (xCr != null && wx > xCr) wx = lerp(wx, xCr, 0.85);

    // 2 · cara costal: empuja la mitad lateral hacia la pared interior
    const hw = innerHalfWidth(wx, wy);
    const latSign = Math.sign(wz) || side;
    if (latSign === side) {
      // lado costal: llevar |z| hacia (casi) la pared, dejando una fina holgura
      const target = side * (hw - 0.006);
      if (Math.abs(wz) < Math.abs(target)) wz = lerp(wz, target, 0.62);
      else wz = target;
    } else {
      // lado medial: aplanar hacia el plano mediastínico
      wz = lerp(wz, zMed, 0.78);
    }
    // nunca atravesar la pared
    if (Math.abs(wz) > hw) wz = side * hw;

    // 3 · techo dorsal: subir hasta bajo las vértebras
    const ry = roofY(wx);
    if (wy > ry) wy = ry; else if (o.fillRoof && wy > ry - 0.11) wy = lerp(wy, ry, 0.35);

    // 4 · suelo ventral y base diafragmática; el borde ventral se afina (fino)
    const fy = floorY(wx);
    if (wy < fy) wy = lerp(wy, fy, 0.9);
    const ventralEdge = (wy - fy) / 0.06;        // <1 cerca del borde ventral
    if (ventralEdge < 1) {
      const thin = 0.35 + 0.65 * Math.max(0, ventralEdge);
      wz = lerp(zMed, wz, thin);                 // acercar la cara costal al plano medial → cuña fina
    }

    // 5 · escotadura cardíaca (muesca en el borde ventral craneal)
    if (o.notch) {
      const nx = o.notch.x, ny = o.notch.y, nr = o.notch.r;
      const d = Math.hypot(wx - nx, wy - ny);
      if (d < nr && wy < 0.90) {
        const push = (nr - d) / nr;            // 0..1
        wz = lerp(wz, zMed, 0.6 * push);        // retrae la cara ventral medialmente
        wy = lerp(wy, ny + nr * 0.4, 0.3 * push);
      }
    }

    v.set(wx - center.x, wy - center.y, wz - center.z);
  };
}

export function build() {
  // ============================================================
  // 1 · DIAFRAGMA + vísceras abdominales craneales
  // ============================================================
  buildDiaphragm();
  buildAbdominalContext();

  // ============================================================
  // 2 · AIRWAYS (tráquea torácica, bifurcación, bronquios)
  // ============================================================
  buildAirways();

  // ============================================================
  // 3 · PULMONES
  // ============================================================
  buildLungs();

  // ============================================================
  // 4 · CORAZÓN
  // ============================================================
  buildHeart();

  // ============================================================
  // 5 · PERICARDIO
  // ============================================================
  buildPericardium();

  // ============================================================
  // 6 · GRANDES VASOS
  // ============================================================
  buildGreatVessels();

  // ============================================================
  // 7 · NERVIOS
  // ============================================================
  buildNerves();

  // ============================================================
  // 8 · LINFÁTICOS Y TIMO
  // ============================================================
  buildLymphAndThymus();

  // ============================================================
  // 9 · MEDIASTINO (láminas serosas translúcidas)
  // ============================================================
  buildMediastinum();
}

// ───────────────────────────────────────────────────────────────
// DIAFRAGMA
// ───────────────────────────────────────────────────────────────
function buildDiaphragm() {
  const dome = DIAPHRAGM_DOME;   // (-0.24, 0.94, 0) punto más craneal
  // Cúpula: superficie (patch) desde la inserción periférica (anillo) abombada
  // CRANEALMENTE hacia el domo. u recorre el anillo ventral→dorsal por un lado y
  // vuelve por el otro; v va del borde (0) al centro de la cúpula (1).
  const attL = diaphragmAttachment(1);
  const attR = diaphragmAttachment(-1);
  const nAtt = attL.length;
  const rimAt = (s) => {
    // s∈[0,1): recorre todo el anillo. 0..0.5 lado izq ventral→dorsal, 0.5..1 dcho dorsal→ventral.
    let side, u;
    if (s < 0.5) { side = attL; u = s * 2; } else { side = attR; u = (1 - s) * 2; }
    const fu = u * (nAtt - 1);
    const i0 = Math.floor(fu), i1 = Math.min(nAtt - 1, i0 + 1), f = fu - i0;
    return side[i0].clone().lerp(side[i1], f);
  };
  const fn = (u, v) => {
    const rim = rimAt(u);
    // centro de la cúpula: craneal al anillo, en el domo, ligeramente desplazado
    // por el ángulo del anillo (la cúpula derecha es un poco más craneal).
    const center = V(dome.x, dome.y, rim.z * 0.12);
    // abombamiento: v=0 en el anillo, v=1 en el centro; perfil redondeado
    const t = v;
    const p = rim.clone().lerp(center, t);
    // levantar la superficie hacia craneal (x mayor) en el interior → cúpula convexa
    const bulge = Math.sin(Math.PI * 0.5 * t) * (1 - 0.15);
    p.x += 0.14 * bulge;
    return p;
  };
  const dia = patch(fn, 0.014, 'diaphragm', { nu: 40, nv: 18 });
  place('diafragma', dia, 'musculo');

  // Centro tendinoso: parche claro poco translúcido en la cúpula.
  const tendon = blob(V(dome.x - 0.03, dome.y - 0.01, 0.0), [0.07, 0.085, 0.10], 'diaphragm', {
    noise: 0.03, freq: 3, seed: 61, detail: 3,
    deform: (vv) => { vv.x *= 0.45; },     // disco aplanado en X (frontal)
    mat: { color: '#d8c3b0', opacity: 0.7 },
  });
  place('diafragma', tendon, 'musculo');

  // Pilares (crura) dorsales hacia la aorta/esófago, dos vientres musculares.
  const crusL = tube([V(-0.80, 1.15, 0.045), V(-0.72, 1.02, 0.06), V(-0.63, 0.94, 0.05), V(-0.58, 0.90, 0.03)], (t) => lerp(0.022, 0.014, t), 'muscle2', { radial: 10 });
  const crusR = tube([V(-0.80, 1.15, -0.045), V(-0.72, 1.02, -0.06), V(-0.63, 0.94, -0.05), V(-0.58, 0.90, -0.03)], (t) => lerp(0.022, 0.014, t), 'muscle2', { radial: 10 });
  place('diafragma', crusL, 'musculo');
  place('diafragma', crusR, 'musculo');

  // Hiato esofágico (anillo) y foramen de la vena cava (anillo), en la cúpula.
  const hiatus = ring(V(-0.60, 1.00, 0.01), V(1, 0.15, 0), 0.02, 0.0035, 'muscle2', '#8a4a40');
  place('diafragma', hiatus, 'musculo');
  const caval = ring(V(-0.40, 0.97, -0.09), V(1, 0.05, 0), 0.024, 0.0035, 'muscle2', '#8a4a40');
  place('diafragma', caval, 'musculo');
}

// ───────────────────────────────────────────────────────────────
// VÍSCERAS ABDOMINALES CRANEALES (contexto en el corte T8)
// ───────────────────────────────────────────────────────────────
function buildAbdominalContext() {
  // Hígado: derecha (−z), caudal al diafragma, bajo las costillas caudales, aplanado.
  const higado = blob(V(-0.58, 0.92, -0.13), [0.16, 0.15, 0.10], 'liver', {
    noise: 0.09, freq: 2.2, seed: 7, detail: 4,
    rot: [0.1, -0.25, 0.18],
    deform: (vv) => {
      vv.x *= 0.72;                                   // aplanado craneocaudal (apoyo diafragma)
      if (vv.y > 0.12) vv.y = 0.12 + (vv.y - 0.12) * 0.35; // borde dorsal fino
    },
    mat: { color: '#7b2f2a' },
  });
  place('higado', higado, 'viscera');

  // Retículo: izquierda (+z), cranioventral, SACO APLANADO contra el diafragma.
  // Superficie con relieve de PANAL (crestas poligonales por ruido de alta frecuencia).
  const honeycomb = (vv) => {
    // relieve en malla: suma de senos en las tres direcciones → celdas tipo panal
    const F = 70;
    const h = Math.cos(vv.x * F) * Math.cos(vv.y * F) + Math.cos(vv.y * F) * Math.cos(vv.z * F) + Math.cos(vv.z * F) * Math.cos(vv.x * F);
    const n = vv.clone().normalize().multiplyScalar(0.004 * (h > 0.2 ? 1 : 0.2));
    vv.add(n);
  };
  const reticulo = blob(V(-0.52, 0.80, 0.13), [0.135, 0.12, 0.12], 'stomach', {
    noise: 0.02, freq: 4, seed: 11, detail: 5, rot: [0, 0.15, 0.05],
    deform: (vv) => {
      vv.x *= 0.62;                                   // aplanado contra la cúpula del diafragma
      if (vv.y > 0.1) vv.y = 0.1 + (vv.y - 0.1) * 0.5; // borde dorsal más fino
      honeycomb(vv);                                   // textura de panal
    },
    mat: { color: '#9c7452', roughness: 0.75 },
  });
  place('reticulo', reticulo, 'viscera');
}

// ───────────────────────────────────────────────────────────────
// AIRWAYS
// ───────────────────────────────────────────────────────────────
function buildAirways() {
  // Tráquea torácica: de TRACHEA[5] (entrada, x~0.32) a la bifurcación.
  const traqPts = [TRACHEA[5].clone(), TRACHEA[6].clone(), TRACHEA[7].clone(), BIFURCATION.clone()];
  const traq = tube(traqPts, TRACHEA_R, 'cartilage', {
    radial: 16, mat: { transparent: true, opacity: 0.55, depthWrite: false },
  });
  place('traquea', traq, 'cavidad');
  // Anillos cartilaginosos cada ~2 cm (toros).
  const curve = new THREE.CatmullRomCurve3(traqPts.map((p) => p.clone()), false, 'centripetal');
  const len = curve.getLength();
  const ringsGrp = new THREE.Group();
  for (let s = 0.01; s < len; s += 0.02) {
    const t = s / len;
    const P = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const r = ring(P, tan, TRACHEA_R * 1.04, 0.0028, 'cartilage');
    ringsGrp.add(r);
  }
  place('traquea', ringsGrp, 'cavidad');

  // Bifurcación (marcador de posición + pequeño abultamiento).
  const bif = blob(BIFURCATION, [0.02, 0.016, 0.03], 'cartilage', { noise: 0.04, detail: 3, mat: { transparent: true, opacity: 0.6, depthWrite: false } });
  place('bifurcacion', bif, 'cavidad');

  // Bronquio traqueal (dcho), craneal a la bifurcación → lóbulo craneal dcho.
  const bt = tube([TRACHEAL_BRONCHUS_ORIGIN.clone(), V(0.15, 0.93, -0.06), V(0.19, 0.90, -0.12), V(0.22, 0.88, -0.17)],
    (t) => lerp(0.012, 0.008, t), 'cartilage', { radial: 12 });
  place('bronquio_traqueal', bt, 'cavidad');

  // Bronquio principal izq y dcho desde la bifurcación.
  const bIzq = tube([BIFURCATION.clone(), V(-0.06, 1.00, 0.04), V(-0.14, 0.98, 0.09), V(-0.22, 0.97, 0.12)],
    (t) => lerp(0.017, 0.010, t), 'cartilage', { radial: 12 });
  place('bronquio_izq', bIzq, 'cavidad');
  const bDcho = tube([BIFURCATION.clone(), V(-0.06, 1.00, -0.05), V(-0.14, 0.98, -0.10), V(-0.24, 0.96, -0.14)],
    (t) => lerp(0.018, 0.010, t), 'cartilage', { radial: 12 });
  place('bronquio_dcho', bDcho, 'cavidad');

  // Esófago torácico: de ESOPHAGUS[5] al hiato y un poco más allá.
  const esoPts = ESOPHAGUS.slice(5).map((p) => p.clone());
  esoPts.push(V(-0.66, 1.00, 0.0));
  const eso = tube(esoPts, ESOPHAGUS_R, 'mucosa', { radial: 12, mat: { color: '#c98f86' } });
  place('esofago', eso, 'cavidad');
}

// ───────────────────────────────────────────────────────────────
// PULMONES
// ───────────────────────────────────────────────────────────────
// Relieve fino de superficie pulmonar: rompe el brillo de "globo" con una
// textura blanda de alta frecuencia (micro-lobulillos), sin cambiar el volumen.
function lungSurface(seed) {
  return (v) => {
    const F = 24;
    const h = Math.sin(v.x * F + seed) * Math.sin(v.y * F * 0.9 + seed * 1.3) * Math.sin(v.z * F * 1.1 + seed * 0.7);
    const n = v.clone().normalize().multiplyScalar(0.005 * h);
    v.add(n);
  };
}

function lung(ref, center, radii, side, opts = {}) {
  const fill = makeLungFill(center, { side, ...opts });
  const surf = lungSurface(opts.seed ?? 1);
  const b = blob(center, radii, 'lung', {
    // más ruido base para perder el aspecto de globo, superficie mate
    noise: opts.noise ?? 0.05, freq: opts.freq ?? 3.2, seed: opts.seed ?? 1, detail: 4,
    rot: opts.rot,
    mat: {
      color: side > 0 ? COLORS.lungL : COLORS.lungR,
      transparent: true, opacity: 0.92, depthWrite: true,
      roughness: 0.85, sheen: 0.25,
      ...(opts.mat || {}),
    },
    deform: (v) => { fill(v); surf(v); },
  });
  place(ref, b, 'viscera');
  return b;
}

function buildLungs() {
  // Las caras mediales dejan paso al corazón (z medial a cada lado del mediastino).
  // Techos (fillRoof) suben los lóbulos hasta bajo las vértebras para llenar el ápice.
  // ── Pulmón IZQUIERDO (+z) ──
  // Lóbulo craneal, porción craneal: delante del corazón, hacia la entrada. Pequeño en Ru.
  lung('pulmon_izq_craneal_cr', V(0.235, 0.95, 0.12), [0.075, 0.15, 0.11], 1,
    { seed: 2, xCranial: 0.33, xCaudal: 0.145, zMedial: 0.03, fillRoof: true,
      notch: { x: 0.165, y: 0.80, r: 0.055 } });
  // Lóbulo craneal, porción caudal: sobre y detrás del corazón.
  lung('pulmon_izq_craneal_cd', V(0.07, 1.00, 0.13), [0.095, 0.15, 0.12], 1,
    { seed: 3, xCranial: 0.165, xCaudal: -0.02, zMedial: 0.03, fillRoof: true,
      notch: { x: 0.06, y: 0.80, r: 0.06 } });
  // Lóbulo caudal izq: el mayor, llena todo el dorsocaudal hasta el diafragma.
  lung('pulmon_izq_caudal', V(-0.30, 1.00, 0.12), [0.30, 0.21, 0.15], 1,
    { seed: 4, xCranial: 0.0, xCaudal: -0.70, zMedial: 0.02, fillRoof: true, noise: 0.04 });

  // ── Pulmón DERECHO (−z): mayor, lóbulos craneales más grandes ──
  // Craneal dcho (porción craneal): muy craneal, ventilado por el bronquio traqueal.
  lung('pulmon_dcho_craneal_cr', V(0.255, 0.90, -0.11), [0.08, 0.16, 0.13], -1,
    { seed: 5, xCranial: 0.36, xCaudal: 0.16, zMedial: 0.03, fillRoof: true, noise: 0.035 });
  // Craneal dcho (porción caudal).
  lung('pulmon_dcho_craneal_cd', V(0.10, 0.99, -0.14), [0.085, 0.15, 0.125], -1,
    { seed: 6, xCranial: 0.165, xCaudal: 0.01, zMedial: 0.03, fillRoof: true,
      notch: { x: 0.07, y: 0.79, r: 0.045 } });
  // Lóbulo medio dcho: ventral, sobre el corazón.
  lung('pulmon_dcho_medio', V(0.01, 0.86, -0.13), [0.10, 0.11, 0.115], -1,
    { seed: 8, xCranial: 0.10, xCaudal: -0.10, zMedial: 0.03 });
  // Lóbulo caudal dcho: el mayor, dorsocaudal hasta el diafragma.
  lung('pulmon_dcho_caudal', V(-0.32, 1.00, -0.13), [0.31, 0.21, 0.155], -1,
    { seed: 9, xCranial: 0.0, xCaudal: -0.70, zMedial: 0.02, fillRoof: true, noise: 0.04 });
  // Lóbulo accesorio: medial, en el receso junto a la v. cava caudal (cruza el plano medio).
  lung('pulmon_dcho_accesorio', V(-0.30, 0.86, 0.0), [0.15, 0.10, 0.09], -1,
    { seed: 10, xCranial: -0.08, xCaudal: -0.56, zMedial: 0.09, noise: 0.045 });

  // ── Escotaduras cardíacas (zonas finas del borde ventral, resalte discreto) ──
  // Izq: mayor, 3º-4º EIC ventral.
  const escIzqX = intercostalX(3, 0.80);
  const escIzqRing = ring(V(escIzqX, 0.80, 0.17), V(0, 0, 1), 0.03, 0.003, 'projection2');
  place('escotadura_cardiaca_izq', escIzqRing, 'proyeccion');
  // Dcha: más pequeña, entre 3ª-4ª costilla.
  const escDchaX = intercostalX(3, 0.80);
  const escDchaRing = ring(V(escDchaX, 0.80, -0.15), V(0, 0, 1), 0.02, 0.003, 'projection2');
  place('escotadura_cardiaca_dcha', escDchaRing, 'proyeccion');

  // ── Borde basal del pulmón (línea ventrocaudal sobre el diafragma, ambos lados) ──
  // 6ª unión costocondral → 11º EIC dorsal.
  for (const side of [1, -1]) {
    const pts = [];
    const cc6 = costochondral(6, side);
    pts.push(V(cc6.x, cc6.y + 0.02, cc6.z * 0.9));
    for (let i = 7; i <= 11; i++) {
      const y = lerp(0.82, 1.05, (i - 6) / 5);
      const x = ribXAtY(i, y) - 0.02;
      pts.push(V(x, y, side * (innerHalfWidth(x, y) - 0.005)));
    }
    const line = pathLine(pts, 'projection2', 0.004, { radial: 8 });
    place('borde_basal_pulmon', line, 'proyeccion');
  }

  // ── Surco de la vena cava caudal (groove cara medial pulmón dcho) ──
  const surco = pathLine([V(-0.22, 0.88, -0.04), V(-0.30, 0.86, -0.03), V(-0.38, 0.85, -0.02)],
    'projection2', 0.004, { radial: 8 });
  place('surco_vena_cava', surco, 'proyeccion');
}

// ───────────────────────────────────────────────────────────────
// CORAZÓN
// ───────────────────────────────────────────────────────────────
function buildHeart() {
  const C = HEART.center;      // (0.07, 0.86, 0.01)
  const base = HEART.base;     // (0.10, 0.99, 0)
  const apex = HEART.apex;     // (-0.02, 0.69, 0.02)

  // Deform cónico: estrecha la masa ventricular hacia el ápex ventral.
  // v local (radio ~ radii, centro en el bloque). apexLocalY = y local del ápex.
  const coneDeform = (apexY, taper, apexShift) => (v) => {
    // t: 0 en la base (y alto) .. 1 en el ápex (y bajo)
    const t = Math.max(0, Math.min(1, (0.001 + (0 - v.y)) / (0 - apexY)));
    const k = 1 - taper * t * t;              // estrechamiento hacia el ápex
    v.x *= k; v.z *= k;
    if (apexShift) { v.x += apexShift.x * t; v.z += apexShift.z * t; }
  };

  // Masa ventricular común (forma cónica): base dorsal, ápex ventral-izq cerca del esternón.
  // Ventrículo derecho: craneal/derecho, envuelve craneal, NO llega al ápex.
  const vd = blob(V(0.095, 0.85, -0.035), [0.085, 0.145, 0.07], 'heart', {
    noise: 0.03, freq: 2.4, seed: 21, detail: 4, rot: [0, 0, 0.14],
    deform: (v) => {
      coneDeform(-0.16, 0.85, { x: -0.02, z: 0.03 })(v);
      if (v.y < -0.09) { v.x += 0.02; }       // se acorta ventralmente (no al ápex)
    },
    mat: { color: '#9e2f3a' },
  });
  place('ventriculo_dcho', vd, 'viscera');

  // Ventrículo izquierdo: caudal/izquierdo, pared gruesa, forma el ápex puntiagudo.
  const vi = blob(V(0.045, 0.83, 0.03), [0.095, 0.175, 0.08], 'heart', {
    noise: 0.03, freq: 2.4, seed: 22, detail: 4, rot: [0, 0, -0.06],
    deform: (v) => {
      coneDeform(-0.19, 0.92, { x: -0.03, z: -0.01 })(v);
    },
    mat: { color: '#aa323c' },
  });
  place('ventriculo_izq', vi, 'viscera');

  // Atrios (dorsales, en la base). Se modelan como abultamientos aplanados
  // contra la base ventricular (no esferas sueltas): se achatan en y y se
  // fusionan ventralmente hacia el surco coronario.
  const atriumFlatten = (v) => {
    if (v.y < -0.015) v.y = -0.015 + (v.y + 0.015) * 0.45; // cara ventral tucked a la base
    v.y *= 0.9;
  };
  const ad = blob(V(0.13, 0.95, -0.05), [0.07, 0.05, 0.062], 'atrium', {
    noise: 0.045, freq: 2.6, seed: 23, detail: 3, rot: [0, 0, 0.08],
    deform: atriumFlatten, mat: { color: '#7e2838' },
  });
  place('atrio_dcho', ad, 'viscera');
  const ai = blob(V(0.045, 0.96, 0.06), [0.062, 0.046, 0.06], 'atrium', {
    noise: 0.045, freq: 2.6, seed: 24, detail: 3, rot: [0, 0, -0.05],
    deform: atriumFlatten, mat: { color: '#7e2838' },
  });
  place('atrio_izq', ai, 'viscera');

  // Orejuelas (aurículas): solapas aplanadas y festoneadas que abrazan la base,
  // no esferas. Se achatan lateralmente (z local) y se afilan hacia el extremo libre.
  const auricleShape = (v) => {
    v.z *= 0.6;                 // solapa fina (aplanada medio-lateral)
    if (v.x < 0) v.x *= 0.72;   // afila el extremo libre craneal
    v.y -= 0.003;
  };
  const aurD = blob(V(0.185, 0.925, -0.028), [0.038, 0.03, 0.026], 'atrium', {
    noise: 0.11, freq: 5, seed: 25, detail: 3, rot: [0, 0, 0.32],
    deform: auricleShape, mat: { color: '#8a2c3c' },
  });
  place('auricula_dcha', aurD, 'viscera');
  const aurI = blob(V(0.02, 0.925, 0.078), [0.032, 0.028, 0.024], 'atrium', {
    noise: 0.11, freq: 5, seed: 26, detail: 3, rot: [0, 0, 0.28],
    deform: auricleShape, mat: { color: '#8a2c3c' },
  });
  place('auricula_izq', aurI, 'viscera');

  // Grasa coronaria (surco coronario + interventriculares): bandas amarillas.
  // Surco coronario: anillo horizontal entre atrios y ventrículos (y~0.91).
  const coron = tube([
    V(0.17, 0.90, -0.03), V(0.12, 0.905, -0.08), V(0.04, 0.905, -0.06),
    V(-0.01, 0.905, 0.0), V(0.02, 0.905, 0.07), V(0.10, 0.905, 0.08), V(0.17, 0.90, 0.02),
  ], 0.012, 'fat', { radial: 10, closed: true });
  place('grasa_coronaria', coron, 'viscera');
  // Surco interventricular paraconal (craneal izq, hacia el ápex).
  const ivPar = tube([V(0.12, 0.90, 0.02), V(0.07, 0.82, 0.05), V(0.02, 0.73, 0.04)], 0.009, 'fat', { radial: 8 });
  place('grasa_coronaria', ivPar, 'viscera');

  // Seno coronario: corta vena en el surco coronario dorsal, desemboca en atrio dcho.
  const senoC = tube([V(0.02, 0.905, 0.07), V(0.08, 0.915, 0.02), V(0.13, 0.925, -0.04)], 0.008, 'vein', { radial: 8 });
  place('seno_coronario', senoC, 'viscera');

  // Huesos del corazón (os cordis): dos marcadores óseos en el anillo aórtico.
  const ossa = group(
    marker(V(0.085, 0.915, -0.005), '#ece2cc', 0.009, 'bone'),
    marker(V(0.075, 0.912, 0.012), '#ece2cc', 0.008, 'bone'),
  );
  place('huesos_corazon', ossa, 'hueso');

  // ── Válvulas (discos en la base, legibles en corte dorsal) ──
  // Plano de la base ~ y 0.915. pulmonar cranial-izq, aórtica central, mitral caudal-izq, tricúspide dcha.
  const valveDisc = (p, r, color) => {
    const g = new THREE.CylinderGeometry(r, r, 0.004, 20);
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.3 }));
    m.rotation.x = Math.PI / 2 * 0 + 0; m.position.copy(p);
    m.material.userData.kind = 'valve';
    return m;
  };
  const vp = valveDisc(V(0.12, 0.915, 0.035), 0.022, '#f6efe0');
  place('valvula_pulmonar', vp, 'viscera');
  const va = valveDisc(V(0.085, 0.912, 0.0), 0.024, '#efe6d0');
  place('valvula_aortica', va, 'viscera');
  const vm = valveDisc(V(0.045, 0.912, 0.045), 0.022, '#f2ead8');
  place('valvula_mitral', vm, 'viscera');
  const vt = valveDisc(V(0.11, 0.912, -0.05), 0.026, '#f4ecda');
  place('valvula_tricuspide', vt, 'viscera');

  // ── Bordes ventriculares (líneas sobre la superficie) ──
  // Borde ventricular dcho (craneal).
  const bvd = pathLine([V(0.19, 0.90, -0.02), V(0.16, 0.80, 0.0), V(0.08, 0.72, 0.02), V(-0.01, 0.70, 0.02)],
    'projection2', 0.004, { radial: 8 });
  place('borde_ventricular_dcho', bvd, 'proyeccion');
  // Borde ventricular izq (caudal).
  const bvi = pathLine([V(0.00, 0.95, 0.06), V(-0.03, 0.84, 0.06), V(-0.03, 0.74, 0.04), V(-0.02, 0.69, 0.03)],
    'projection2', 0.004, { radial: 8 });
  place('borde_ventricular_izq', bvi, 'proyeccion');

  // ── Caras (parches translúcidos) ──
  const caraAur = area([V(0.02, 0.95, 0.09), V(-0.02, 0.80, 0.085), V(0.0, 0.72, 0.06), V(0.08, 0.86, 0.09)],
    'area', { mat: { color: '#c98', opacity: 0.18 } });
  place('cara_auricular', caraAur, 'proyeccion');
  const caraAtr = area([V(0.16, 0.95, -0.08), V(0.18, 0.84, -0.07), V(0.10, 0.76, -0.06), V(0.08, 0.90, -0.08)],
    'area', { mat: { color: '#9ab', opacity: 0.18 } });
  place('cara_atrial', caraAtr, 'proyeccion');

  void C; void base; void apex;
}

// ───────────────────────────────────────────────────────────────
// PERICARDIO
// ───────────────────────────────────────────────────────────────
function buildPericardium() {
  // Saco seroso translúcido que envuelve el corazón, con inserción esternopericárdica.
  // Cónico como el corazón que contiene, fino y poco visible (no un globo blanco).
  const peri = blob(V(0.06, 0.85, 0.0), [0.125, 0.2, 0.115], 'serosa', {
    noise: 0.015, freq: 1.8, seed: 31, detail: 4, rot: [0, 0, -0.03],
    deform: (v) => {
      // estrecha hacia el ápex siguiendo el cono cardíaco
      const t = Math.max(0, Math.min(1, (0 - v.y) / 0.2));
      v.x *= (1 - 0.8 * t * t); v.z *= (1 - 0.8 * t * t);
      v.x -= 0.03 * t;
    },
    mat: { opacity: 0.12, color: '#f0e2d6' },
  });
  place('pericardio', peri, 'viscera');
  // Ligamento esternopericárdico (del ápex al esternón).
  const lig = tube([V(-0.02, 0.69, 0.0), V(-0.05, 0.66, 0.0), V(-0.08, 0.655, 0.0)], 0.01, 'serosa', { radial: 8 });
  place('pericardio', lig, 'viscera');
}

// ───────────────────────────────────────────────────────────────
// GRANDES VASOS
// ───────────────────────────────────────────────────────────────
function buildGreatVessels() {
  // Tronco pulmonar: del VD, cranial-izq, se divide.
  const tp = tube([V(0.12, 0.92, 0.02), V(0.11, 1.00, 0.04), V(0.07, 1.06, 0.03), V(0.02, 1.08, -0.01)],
    (t) => lerp(0.028, 0.020, t), 'artery', { radial: 14 });
  place('tronco_pulmonar', tp, 'vaso');
  // ramas (contexto)
  const tpR = tube([V(0.02, 1.08, -0.01), V(-0.04, 1.05, -0.06), V(-0.10, 1.00, -0.10)], (t) => lerp(0.016, 0.010, t), 'artery', { radial: 10 });
  place('tronco_pulmonar', tpR, 'vaso');

  // Arco aórtico: del VI, se arquea dorsocaudal sobre la base.
  const arco = tube([V(0.085, 0.915, 0.0), V(0.09, 1.00, -0.01), V(0.06, 1.06, -0.02), V(0.0, 1.07, -0.02), V(-0.06, 1.03, -0.03)],
    (t) => lerp(0.03, 0.024, t), 'artery', { radial: 14 });
  place('arco_aortico', arco, 'vaso');

  // Aorta torácica: ventral-izq a los cuerpos vertebrales → hiato aórtico.
  const aorta = tube([
    V(-0.06, 1.03, -0.03), V(-0.14, 1.02, 0.0), V(-0.30, 1.02, 0.02), V(-0.50, 1.02, 0.03), V(-0.66, 1.03, 0.02),
  ], (t) => lerp(0.024, 0.020, t), 'artery', { radial: 14 });
  place('aorta_toracica', aorta, 'vaso');

  // Tronco braquiocefálico (única rama del arco en Ru).
  const tbc = tube([V(0.06, 1.02, -0.015), V(0.14, 1.02, -0.01), V(0.22, 1.00, 0.0), V(0.30, 0.96, 0.0)],
    (t) => lerp(0.022, 0.016, t), 'artery', { radial: 12 });
  place('tronco_braquiocefalico', tbc, 'vaso');
  // subclavias (contexto) + origen de carótidas
  const subL = tube([V(0.30, 0.96, 0.0), V(0.33, 0.98, 0.07), V(0.35, 1.00, 0.12)], (t) => lerp(0.013, 0.009, t), 'artery', { radial: 10 });
  place('a_subclavia', subL, 'vaso');
  const subR = tube([V(0.30, 0.96, 0.0), V(0.33, 0.98, -0.07), V(0.35, 1.00, -0.12)], (t) => lerp(0.013, 0.009, t), 'artery', { radial: 10 });
  place('a_subclavia', subR, 'vaso');

  // V. cava craneal: al atrio dcho desde craneal; se forma en la entrada por yugulares+subclavias.
  const jEnd = JUGULAR[JUGULAR.length - 1]; // (0.36, 0.78, 0.10)
  const vcc = tube([V(0.17, 0.95, -0.04), V(0.24, 0.92, -0.04), V(0.31, 0.88, -0.02), V(0.345, 0.82, 0.0), V(jEnd.x, jEnd.y, -0.02)],
    (t) => lerp(0.028, 0.020, t), 'vein', { radial: 14 });
  place('v_cava_craneal', vcc, 'vaso');

  // V. cava caudal: del foramen caval → atrio dcho.
  const vcca = tube([V(0.15, 0.95, -0.05), V(0.06, 0.92, -0.06), V(-0.08, 0.90, -0.07), V(-0.24, 0.92, -0.08), V(-0.40, 0.98, -0.095)],
    (t) => lerp(0.026, 0.022, t), 'vein', { radial: 14 });
  place('v_cava_caudal', vcca, 'vaso');

  // V. ácigos izquierda: cruza la cara izq de la base del corazón → seno coronario (exclusiva Ru/cerdo).
  const azL = tube([V(-0.40, 1.04, 0.04), V(-0.20, 1.03, 0.06), V(-0.04, 0.98, 0.07), V(0.04, 0.93, 0.05)],
    (t) => lerp(0.012, 0.009, t), 'vein', { radial: 10 });
  place('v_azigos_izq', azL, 'vaso');

  // V. ácigos derecha: dorsal dcha → v. cava craneal.
  const azR = tube([V(-0.30, 1.05, -0.05), V(-0.10, 1.04, -0.05), V(0.06, 1.00, -0.04), V(0.16, 0.96, -0.04)],
    (t) => lerp(0.011, 0.009, t), 'vein', { radial: 10 });
  place('v_azigos_dcha', azR, 'vaso');

  // A. y v. torácicas internas: paralelas al esternón (par).
  for (const side of [1, -1]) {
    const a = tube([V(0.34, 0.74, side * 0.03), V(0.20, 0.70, side * 0.035), V(0.0, 0.67, side * 0.035), V(-0.22, 0.665, side * 0.035), V(-0.36, 0.67, side * 0.03)],
      0.006, 'artery', { radial: 8 });
    place('a_v_toracicas_internas', a, 'vaso');
    const v = tube([V(0.34, 0.745, side * 0.045), V(0.20, 0.705, side * 0.05), V(0.0, 0.675, side * 0.05), V(-0.22, 0.67, side * 0.05), V(-0.36, 0.675, side * 0.045)],
      0.006, 'vein', { radial: 8 });
    place('a_v_toracicas_internas', v, 'vaso');
  }
}

// ───────────────────────────────────────────────────────────────
// NERVIOS
// ───────────────────────────────────────────────────────────────
function buildNerves() {
  // N. vago (izq y dcho): desde la entrada del tórax, dorsal a la base del corazón.
  // Izq cruza el arco aórtico.
  const vagoL = tube([V(0.36, 0.86, 0.06), V(0.24, 0.92, 0.05), V(0.10, 1.00, 0.02), V(-0.02, 1.04, 0.0), V(-0.14, 1.04, 0.0)],
    0.006, 'nerve', { radial: 8 });
  place('n_vago', vagoL, 'nervio');
  const vagoR = tube([V(0.36, 0.86, -0.06), V(0.24, 0.92, -0.05), V(0.10, 1.00, -0.03), V(-0.02, 1.03, -0.02), V(-0.14, 1.03, -0.02)],
    0.006, 'nerve', { radial: 8 });
  place('n_vago', vagoR, 'nervio');

  // N. laríngeo recurrente: izq rodea el arco aórtico (lig. arterioso) y asciende; dcho rodea la a. subclavia dcha.
  const lrrL = tube([V(-0.05, 1.02, -0.01), V(-0.07, 0.98, 0.0), V(-0.04, 0.96, 0.02), V(0.0, 0.99, 0.02), V(0.10, 1.03, 0.015), V(0.24, 1.02, 0.015), V(0.34, 0.98, 0.01)],
    0.0045, 'nerve', { radial: 7 });
  place('n_laringeo_recurrente', lrrL, 'nervio');
  const lrrR = tube([V(0.33, 0.985, -0.08), V(0.30, 0.95, -0.09), V(0.29, 0.98, -0.07), V(0.31, 1.00, -0.04), V(0.33, 1.00, -0.015)],
    0.0045, 'nerve', { radial: 7 });
  place('n_laringeo_recurrente', lrrR, 'nervio');

  // Tronco vagosimpático (segmento corto en la entrada, ambos lados).
  const tvs = tube([V(0.40, 0.90, 0.07), V(0.36, 0.87, 0.06)], 0.006, 'nerve', { radial: 7 });
  place('tronco_vagosimpatico', tvs, 'nervio');
  const tvsR = tube([V(0.40, 0.90, -0.07), V(0.36, 0.87, -0.06)], 0.006, 'nerve', { radial: 7 });
  place('tronco_vagosimpatico', tvsR, 'nervio');

  // Ganglio cervicotorácico (estrellado), entrada del tórax junto a 1ª costilla (bilateral).
  both('ganglio_cervicotoracico', blob(V(0.37, 0.90, 0.09), [0.016, 0.013, 0.012], 'ganglion', { noise: 0.1, seed: 41, detail: 3 }), 'nervio');

  // Asa subclavia (rodea la a. subclavia) — dcha (vista en 9.6.B), la espejamos.
  both('asa_subclavia', tube([V(0.33, 0.95, 0.11), V(0.36, 0.99, 0.12), V(0.38, 0.97, 0.11), V(0.36, 0.94, 0.10)], 0.004, 'nerve', { radial: 6, closed: true }), 'nervio');

  // N. frénico izq: sobre el pericardio → diafragma.
  const frenL = tube([V(0.34, 0.92, 0.06), V(0.20, 0.90, 0.09), V(0.02, 0.86, 0.10), V(-0.18, 0.86, 0.09), V(-0.34, 0.90, 0.06)],
    0.005, 'nerve', { radial: 7 });
  place('n_frenico_izq', frenL, 'nervio');
  // N. frénico dcho: junto a la v. cava caudal.
  const frenR = tube([V(0.34, 0.92, -0.06), V(0.18, 0.90, -0.075), V(-0.02, 0.90, -0.08), V(-0.22, 0.92, -0.085), V(-0.38, 0.97, -0.09)],
    0.005, 'nerve', { radial: 7 });
  place('n_frenico_dcho', frenR, 'nervio');

  // Troncos vagales dorsal y ventral sobre el esófago caudal al corazón → hiato.
  const eso = ESOPHAGUS.slice(6).map((p) => p.clone());
  const tvd = tube(eso.map((p) => V(p.x, p.y + ESOPHAGUS_R + 0.006, p.z)), 0.0045, 'nerve', { radial: 6 });
  place('tronco_vagal_dorsal', tvd, 'nervio');
  const tvv = tube(eso.map((p) => V(p.x, p.y - ESOPHAGUS_R - 0.006, p.z)), 0.0045, 'nerve', { radial: 6 });
  place('tronco_vagal_ventral', tvv, 'nervio');

  // Conducto torácico: dorsal al esófago cranealmente → entrada del tórax.
  const ct = tube([V(-0.60, 1.07, -0.01), V(-0.40, 1.08, -0.005), V(-0.10, 1.09, 0.0), V(0.12, 1.06, 0.01), V(0.30, 0.98, 0.02)],
    0.005, 'lymphduct', { radial: 7 });
  place('conducto_toracico', ct, 'linfa');
}

// ───────────────────────────────────────────────────────────────
// LINFÁTICOS Y TIMO
// ───────────────────────────────────────────────────────────────
function buildLymphAndThymus() {
  // Nnll mediastínicos craneales (grupo, entrada del tórax).
  const nmc = group(
    blob(V(0.26, 0.98, 0.02), [0.02, 0.016, 0.018], 'lymph', { noise: 0.1, seed: 51, detail: 3 }),
    blob(V(0.22, 0.95, -0.03), [0.018, 0.015, 0.016], 'lymph', { noise: 0.1, seed: 52, detail: 3 }),
  );
  place('nnll_mediastinicos_craneales', nmc, 'linfa');

  // Nnll mediastínicos medios (sobre la base, dorsal al arco).
  const nmm = blob(V(0.02, 1.02, -0.03), [0.02, 0.016, 0.02], 'lymph', { noise: 0.1, seed: 53, detail: 3 });
  place('nnll_mediastinicos_medios', nmm, 'linfa');

  // Nnll mediastínicos caudales (gran nódulo alargado sobre el esófago caudal al corazón).
  const nmcd = blob(V(-0.34, 1.02, 0.0), [0.07, 0.025, 0.03], 'lymph', { noise: 0.08, seed: 54, detail: 4, rot: [0, 0, 0.05] });
  place('nnll_mediastinicos_caudales', nmcd, 'linfa');

  // Nnll traqueobronquiales (bifurcación + bronquio traqueal).
  const ntb = group(
    blob(V(0.0, 1.00, 0.0), [0.018, 0.014, 0.018], 'lymph', { noise: 0.1, seed: 55, detail: 3 }),
    blob(V(0.02, 0.98, -0.03), [0.015, 0.012, 0.014], 'lymph', { noise: 0.1, seed: 56, detail: 3 }),
    blob(V(0.13, 0.95, -0.05), [0.013, 0.011, 0.012], 'lymph', { noise: 0.1, seed: 57, detail: 3 }),
  );
  place('nnll_traqueobronquiales', ntb, 'linfa');

  // Timo (residuo torácico, mediastino craneal ventral).
  const timo = blob(V(0.28, 0.80, 0.0), [0.06, 0.03, 0.05], 'thymus', { noise: 0.1, freq: 2.4, seed: 58, detail: 4, rot: [0, 0, 0.05] });
  place('timo', timo, 'glandula');
}

// ───────────────────────────────────────────────────────────────
// MEDIASTINO (láminas serosas muy translúcidas, seleccionables)
// ───────────────────────────────────────────────────────────────
function buildMediastinum() {
  // Láminas verticales cerca del plano medio (z≈0), finas, no ocultan órganos.
  const sheetZ = (pts, color) => {
    const a = area(pts, 'area', { mat: { color, opacity: 0.14, side: THREE.DoubleSide } });
    return a;
  };
  // Craneal: delante del corazón.
  place('mediastino_craneal', sheetZ([V(0.34, 1.02, 0.0), V(0.34, 0.74, 0.0), V(0.16, 0.74, 0.0), V(0.16, 1.02, 0.0)], '#f0d8c0'), 'proyeccion');
  // Medio: a nivel del corazón.
  place('mediastino_medio', sheetZ([V(0.16, 1.06, 0.0), V(0.16, 0.70, 0.0), V(-0.06, 0.70, 0.0), V(-0.06, 1.06, 0.0)], '#e8d0c8'), 'proyeccion');
  // Caudal: caudal al corazón.
  place('mediastino_caudal', sheetZ([V(-0.06, 1.08, 0.0), V(-0.06, 0.72, 0.0), V(-0.56, 0.86, 0.0), V(-0.56, 1.10, 0.0)], '#e8d0d0'), 'proyeccion');
  // Dorsal: dorsal a la base (aorta, ácigos, esófago, conducto torácico).
  place('mediastino_dorsal', sheetZ([V(0.12, 1.10, 0.0), V(-0.56, 1.14, 0.0), V(-0.56, 1.00, 0.0), V(0.12, 1.00, 0.0)], '#e0d4e0'), 'proyeccion');
}
