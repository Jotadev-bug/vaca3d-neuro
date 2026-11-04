// ─────────────────────────────────────────────────────────────
// body.js · Módulo CUERPO del vacuno (owner 'body')
// Piel del cuello/tronco/miembros/cola/ubre, esqueleto del tronco,
// referencias del miembro torácico y pelvis, puntos clínicos y
// proyecciones parietales del tórax (9.5.A, 9.5.B). Coordenadas MUNDO:
// +X craneal, +Y dorsal (suelo y=0), +Z lado IZQUIERDO · metros.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import {
  root, place, both, tube, blob, loft, marker, ring, pathLine, area, group, lerp,
} from '../geo.js';
import {
  THORACIC, THORACIC_SPINE_H, THORACIC_SPINE_TILT, LUMBAR, SACRAL, CAUDAL, VERTEBRA_LEN,
  ribPath, costochondral, cartilagePath, STERNUM, XIPHOID, sternumY,
  SCAPULA, ELBOW, FORELIMB, HINDLIMB, BIFURCATION, intercostalX, ribXAtY,
  CONUS_MEDULLARIS, LUMBOSACRAL_SPACE, CD1_CD2, NECK_SKIN, NECK_SKIN_P, HEAD_SKIN_EDGE, headToWorld,
} from '../frame.js';
import { bodyPoint, bodyHalfWidth, projectToWall } from './body/surface.js';

const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);

export function build() {
  buildSkin();
  buildThoracicSpine();
  buildLumbarSacrum();
  buildTail();
  buildSpinalCord();
  buildRibsSternum();
  buildForelimb();
  buildHindlimb();
  buildPalpableMarkers();
  buildClinicalPoints();
  buildProjections();
}

// ─────────────────────────────────────────────────────────────
// 1 · PIEL · cuello → tronco → grupa → cola; miembros y ubre
// ─────────────────────────────────────────────────────────────
// Material de piel: beige-rosado cálido que contrasta con el fondo claro,
// con sheen suave (efecto pelo/fresnel) y transparencia controlada por el slider.
const SKIN_MAT = {
  color: '#d8b89a', roughness: 0.82,
  sheen: 0.7, sheenColor: '#b87a62', sheenRoughness: 0.5,
  clearcoat: 0.08, clearcoatRoughness: 0.9,
};

function buildSkin() {
  // 1a. Cuello: del borde caudal de la piel de la cabeza, a través de NECK_SKIN,
  //     hasta empalmar con el tronco. Usamos las secciones del marco.
  const headEdge = headToWorld(HEAD_SKIN_EDGE.x, (HEAD_SKIN_EDGE.yTop + HEAD_SKIN_EDGE.yBot) / 2);
  const neckPts = [headEdge, ...NECK_SKIN.map((s) => s.c), V(0.80, 1.02)];
  const neckSec = (t) => {
    // interpolación por tramos sobre NECK_SKIN
    const n = NECK_SKIN.length;
    if (t < 0.08) { // empalme con la cabeza (solape 1-2 cm)
      return { w: HEAD_SKIN_EDGE.halfWidth + 0.01, h: (HEAD_SKIN_EDGE.yTop - HEAD_SKIN_EDGE.yBot) / 2 + 0.01, p: 2.4, dy: -0.02 };
    }
    const u = (t - 0.08) / 0.92 * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    const f = u - i;
    const a = NECK_SKIN[i], b = NECK_SKIN[i + 1];
    return { w: lerp(a.w, b.w, f), h: lerp(a.h, b.h, f), p: NECK_SKIN_P, dy: 0 };
  };
  place('piel', loft(neckPts, neckSec, 'skin', { segs: 46, radial: 40, caps: false, mat: SKIN_MAT }), 'piel');

  // 1b. Tronco: barril continuo desde el hombro hasta la raíz de la cola.
  //     Secciones tomadas de la superficie analítica (body/surface.js).
  const trunkX = [0.82, 0.60, 0.35, 0.10, -0.15, -0.40, -0.70, -1.00, -1.25, -1.48, -1.66, -1.80];
  const trunkPts = trunkX.map((x) => { const p = bodyPoint(x, 0); return V(x, p.y, 0); });
  const trunkSec = (t) => {
    const x = lerp(trunkX[0], trunkX[trunkX.length - 1], t);
    const top = bodyPoint(x, 0), bot = bodyPoint(x, Math.PI), side = bodyPoint(x, Math.PI / 2);
    const cy = (top.y + bot.y) / 2;
    const h = (top.y - bot.y) / 2;
    // perfil superelíptico; semialto distinto arriba/abajo lo centramos con dy
    return { w: side.z, h, p: 2.9, dy: cy - lerp(trunkPts[0].y, trunkPts[trunkPts.length - 1].y, t), wTop: side.z * 0.96, wBot: side.z * 0.98 };
  };
  place('piel', loft(trunkPts, trunkSec, 'skin', { segs: 100, radial: 48, caps: false, mat: SKIN_MAT }), 'piel');
  // Cierre craneal (espalda) y caudal (grupa) con casquetes redondeados, para
  // que el barril no muestre tapas planas en abanico.
  {
    const rumpTop = bodyPoint(-1.80, 0), rumpBot = bodyPoint(-1.80, Math.PI);
    const rc = V(-1.80, (rumpTop.y + rumpBot.y) / 2, 0);
    place('piel', blob(rc, [0.13, (rumpTop.y - rumpBot.y) / 2, bodyHalfWidth(-1.72)], 'skin',
      { noise: 0.03, detail: 4, seed: 21, mat: SKIN_MAT,
        // suaviza la cara caudal (sin corte plano) para redondear la nalga
        deform: (v) => { if (v.x < 0) v.x *= 0.7; } }), 'piel');
  }

  // 1c. Papada / pecho ventral: ligera continuidad bajo la entrada del tórax
  //     (la papada propiamente dicha la construye el worker 'neck').

  // 1d. Miembros torácicos (ambos lados)
  buildLegSkin(FORELIMB, true);
  // 1e. Miembros pelvianos
  buildLegSkin(HINDLIMB, false);

  // 1f. Cola (piel) con borujo (switch)
  buildTailSkin();

  // 1g. Ubre con cuatro pezones
  buildUdder();
}

function buildLegSkin(L, fore) {
  // Eje del miembro (proximal→distal) y radios de la piel. La parte alta es
  // carnosa (brazo/muslo) y se afina hacia la caña y la pezuña; de este modo
  // la piel envuelve las articulaciones sin revelar cada codo como un nudo.
  let axis, radii;
  if (fore) {
    // torácico: se funde con el tronco en el hombro; codo, carpo, caña, menudillo, cuartilla
    // La piel baja hasta la corona de la pezuña (y≈0.095) envolviendo el
    // menudillo y la cuartilla, sin dejar asomar las falanges.
    axis = [
      V(0.30, 1.02, 0.17), SCAPULA.shoulderPoint.clone(), V(0.24, 0.84, 0.21),
      ELBOW.clone(), L.radius[0], L.radius[1], L.carpus, L.metacarpus[1],
      V(L.hoof.x - 0.003, 0.14, L.hoof.z), V(L.hoof.x - 0.004, 0.095, L.hoof.z),
    ];
    radii = [0.155, 0.125, 0.10, 0.082, 0.070, 0.052, 0.046, 0.040, 0.040, 0.044];
  } else {
    // pelviano: muslo carnoso (nalga) → babilla (stifle) → corvejón (hock) → caña → cuartilla
    axis = [
      V(-1.46, 1.16, 0.17), L.hip, V(-1.50, 0.80, 0.21), L.femur[1],
      V(-1.55, 0.47, 0.19), L.hock, L.metatarsus[1],
      V(L.hoof.x + 0.003, 0.14, L.hoof.z), V(L.hoof.x + 0.004, 0.095, L.hoof.z),
    ];
    radii = [0.175, 0.150, 0.120, 0.085, 0.062, 0.050, 0.042, 0.040, 0.044];
  }
  const t = tube(axis, (u) => {
    const f = u * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(f));
    return lerp(radii[i], radii[i + 1], f - i);
  }, 'skin', { radial: 24, segs: 100, mat: SKIN_MAT });
  both('piel', t, 'piel');

  // Pezuña hendida (dos dedos) + espolones, apoyada en el suelo (y≈0)
  buildHoofSkin(L.hoof);
}

// Pezuña hendida: dos pezuñas (dedos III y IV) que llegan al suelo + dos
// espolones (dedos II y V) por detrás, algo elevados. Color córneo oscuro.
function buildHoofSkin(hoof) {
  // Corona: anillo carnoso que empalma la piel de la cuartilla con el estuche
  // córneo, para que no quede escalón ni hueso a la vista en la transición.
  const coronet = blob(V(hoof.x - 0.004, 0.092, hoof.z), [0.030, 0.026, 0.028], 'skin',
    { noise: 0.03, detail: 3, mat: SKIN_MAT });
  both(null, coronet, 'piel');
  // Pezuñas (dedos III y IV): estuche córneo que llega al suelo (y=0).
  for (const dz of [0.026, -0.026]) {
    const claw = blob(V(hoof.x - 0.005, 0.042, hoof.z + dz), [0.030, 0.052, 0.023], 'horn',
      { noise: 0.025, detail: 3, rot: [0, 0, 0.1],
        deform: (v) => { v.y -= Math.max(0, v.y) * 0.25; if (v.x > 0) v.x *= 1.15; } });
    both(null, claw, 'piel');
  }
  // Espolones (dewclaws, dedos II y V): pegados a la cara caudal de la cuartilla,
  // algo elevados sobre el suelo. Se unen a la piel por un pequeño puente.
  for (const dz of [0.030, -0.030]) {
    const sp = blob(V(hoof.x - 0.034, 0.115, hoof.z + dz), [0.013, 0.022, 0.011], 'horn',
      { noise: 0.02, detail: 2,
        deform: (v) => { v.y -= Math.max(0, v.y) * 0.3; } });
    both(null, sp, 'piel');
  }
}

function buildTailSkin() {
  const pts = CAUDAL.map((p) => V(p.x, p.y, 0));
  const t = tube(pts, (u) => lerp(0.052, 0.014, u), 'skin', { radial: 16, segs: 90, mat: SKIN_MAT });
  place('piel', t, 'piel');

  // Borla / mechón (switch): manojo cónico orgánico de pelo en la punta.
  const tip = CAUDAL[CAUDAL.length - 1];
  const prev = CAUDAL[CAUDAL.length - 3];
  const dir = tip.clone().sub(prev).normalize();
  const tuft = new THREE.Group();
  // cuerpo cónico central
  const core = tip.clone().add(dir.clone().multiplyScalar(0.02));
  tuft.add(blob(core.clone().add(dir.clone().multiplyScalar(0.11)),
    [0.045, 0.14, 0.045], 'horn',
    { noise: 0.14, detail: 3, seed: 11, rot: [0, 0, Math.atan2(dir.y, dir.x) - Math.PI / 2],
      deform: (v) => { v.x *= 1 - 0.5 * Math.max(0, v.y / 0.14); v.z *= 1 - 0.5 * Math.max(0, v.y / 0.14); } }));
  // mechones laterales finos para dar aspecto de pelo desordenado
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const off = V(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025);
    const base = core.clone().add(off);
    const end = base.clone().add(dir.clone().multiplyScalar(0.16 + 0.03 * Math.sin(k)))
      .add(V(Math.cos(a) * 0.03, -0.02, Math.sin(a) * 0.03));
    tuft.add(tube([base, base.clone().lerp(end, 0.5), end], (u) => lerp(0.016, 0.004, u), 'horn', { radial: 7, segs: 10 }));
  }
  place(null, tuft, 'piel');
}

function buildUdder() {
  const c = V(-1.52, 0.44, 0);
  const u = blob(c, [0.27, 0.22, 0.24], 'skin', { noise: 0.05, detail: 4, seed: 7,
    mat: SKIN_MAT,
    deform: (v) => { if (v.y < 0) v.y *= 1.2; v.x *= 1 + 0.08 * Math.max(0, -v.y); } });
  place('piel', u, 'piel');
  // cuatro pezones
  for (const [dx, dz] of [[0.12, 0.10], [0.12, -0.10], [-0.12, 0.11], [-0.12, -0.11]]) {
    const base = V(c.x + dx, c.y - 0.20, c.z + dz);
    const teat = tube([base, base.clone().add(V(0, -0.08, 0))], (u2) => lerp(0.024, 0.016, u2), 'skin', { radial: 12, mat: SKIN_MAT });
    place(null, teat, 'piel');
  }
}

// ─────────────────────────────────────────────────────────────
// 2 · ESQUELETO TORÁCICO · T1-T13 + espinosas, T13 anticlinal
// ─────────────────────────────────────────────────────────────
function vertebraBody(d, len, r = 0.03, kind = 'bone') {
  // cuerpo cilíndrico suave a lo largo de X
  return tube([V(d.x + len * 0.45, d.y, 0), V(d.x - len * 0.45, d.y, 0)], r, kind, { radial: 14, segs: 6 });
}

function spineProcess(base, h, tilt, r0 = 0.018, r1 = 0.010, kind = 'bone') {
  const tip = V(base.x - Math.sin(tilt) * h, base.y + Math.cos(tilt) * h, 0);
  return tube([base, V(lerp(base.x, tip.x, 0.5), lerp(base.y, tip.y, 0.5), 0), tip],
    (t) => lerp(r0, r1, t), kind, { radial: 10 });
}

function buildThoracicSpine() {
  const spines = new THREE.Group();
  const t13grp = new THREE.Group();
  for (let i = 0; i < 13; i++) {
    const d = THORACIC[i];
    // cuerpo + arco (contexto)
    place(null, vertebraBody(d, VERTEBRA_LEN.T, 0.032), 'hueso');
    place(null, blob(V(d.x, d.y + 0.045, 0), [0.03, 0.035, 0.05], 'bone2', { noise: 0.04, detail: 2 }), 'hueso');
    const base = V(d.x, d.y + 0.06, 0);
    const sp = spineProcess(base, THORACIC_SPINE_H[i], THORACIC_SPINE_TILT[i],
      i < 5 ? 0.022 : 0.016, i < 5 ? 0.012 : 0.008);
    if (i === 12) t13grp.add(sp);           // T13 anticlinal (ref propia)
    else spines.add(sp);
  }
  place('ap_espinosas_toracicas', spines, 'hueso');
  // T13: vértebra anticlinal con su espina vertical + cuerpo resaltable
  const d13 = THORACIC[12];
  t13grp.add(vertebraBody(d13, VERTEBRA_LEN.T, 0.034, 'bone2'));
  place('t13_anticlinal', t13grp, 'hueso');
}

// ─────────────────────────────────────────────────────────────
// 3 · LUMBARES + SACRO + COXALES
// ─────────────────────────────────────────────────────────────
function buildLumbarSacrum() {
  const lspines = new THREE.Group();
  const costales = new THREE.Group();
  for (let i = 0; i < LUMBAR.length; i++) {
    const d = LUMBAR[i];
    place(null, vertebraBody(d, VERTEBRA_LEN.L, 0.036), 'hueso');       // cuerpo (contexto)
    // espinosa lumbar: corta y vertical
    lspines.add(spineProcess(V(d.x, d.y + 0.055, 0), 0.14, 0.0, 0.020, 0.012));
    // apófisis costales (transversas) largas y planas a ambos lados
    for (const side of [1, -1]) {
      const tip = V(d.x - 0.02, d.y - 0.01, side * 0.26);
      const tp = tube([V(d.x, d.y + 0.01, side * 0.03), V(d.x - 0.01, d.y, side * 0.15), tip],
        (t) => lerp(0.016, 0.008, t), 'bone', { radial: 8, flat: 0.45 });
      costales.add(tp);
    }
  }
  place('ap_espinosas_lumbares', lspines, 'hueso');
  place('ap_costales', costales, 'hueso');

  // Sacro: 5 fusionadas (contexto) + crestas
  const sacrumBody = tube(SACRAL.map((p) => V(p.x, p.y, 0)), (t) => lerp(0.05, 0.03, t), 'bone2', { radial: 14 });
  place(null, sacrumBody, 'hueso');
  // cresta sacra mediana: espinosas fusionadas en cresta continua dorsal
  const crestPts = SACRAL.map((p) => V(p.x, p.y + 0.085, 0));
  place('cresta_sacra_mediana', tube(crestPts, (t) => lerp(0.018, 0.012, t), 'bone', { radial: 10 }), 'hueso');
  // cresta sacra intermedia: tubérculos a cada lado
  const interG = new THREE.Group();
  for (const side of [1, -1]) {
    for (const p of SACRAL) interG.add(marker(V(p.x, p.y + 0.06, side * 0.045), '#ddd0b2', 0.014, 'bone2'));
  }
  place('cresta_sacra_intermedia', interG, 'hueso');

  // Coxales (contexto): ala del ilion → acetábulo → isquion, cada lado
  for (const side of [1, -1]) {
    const ilium = tube([
      V(SACRAL[0].x + 0.05, SACRAL[0].y + 0.02, side * 0.06),
      V(HINDLIMB.coxalTuber.x + 0.1, HINDLIMB.coxalTuber.y, side * 0.18),
      V(HINDLIMB.coxalTuber.x, HINDLIMB.coxalTuber.y, side * HINDLIMB.coxalTuber.z),
    ], (t) => lerp(0.035, 0.028, t), 'bone', { radial: 10, flat: 0.6 });
    place(null, ilium, 'hueso');
    const bodyPelvis = tube([
      V(HINDLIMB.coxalTuber.x, HINDLIMB.coxalTuber.y, side * HINDLIMB.coxalTuber.z),
      V(HINDLIMB.hip.x, HINDLIMB.hip.y + 0.02, side * HINDLIMB.hip.z),
      V(HINDLIMB.ischialTuber.x, HINDLIMB.ischialTuber.y, side * HINDLIMB.ischialTuber.z),
    ], (t) => lerp(0.03, 0.028, t), 'bone', { radial: 10 });
    place(null, bodyPelvis, 'hueso');
    // tubérculos palpables: coxal (hook) e isquial (pin) como contexto en relieve
    place(null, blob(V(HINDLIMB.coxalTuber.x, HINDLIMB.coxalTuber.y, side * HINDLIMB.coxalTuber.z), [0.03, 0.025, 0.03], 'bone2', { noise: 0.04, detail: 3 }), 'hueso');
    place(null, blob(V(HINDLIMB.ischialTuber.x, HINDLIMB.ischialTuber.y, side * HINDLIMB.ischialTuber.z), [0.03, 0.03, 0.028], 'bone2', { noise: 0.04, detail: 3 }), 'hueso');
  }
  // Tuberosidad sacra: borde dorsomedial del ala del ilion (ref), ambos lados
  const tsG = new THREE.Group();
  for (const side of [1, -1]) {
    tsG.add(blob(V(HINDLIMB.sacralTuber.x, HINDLIMB.sacralTuber.y, side * HINDLIMB.sacralTuber.z),
      [0.035, 0.028, 0.03], 'bone', { noise: 0.05, detail: 3 }));
  }
  place('tuberosidad_sacra', tsG, 'hueso');
}

// ─────────────────────────────────────────────────────────────
// 4 · COLA · caudales Cd1-Cd20, apófisis/arcos hemales, vasos
// ─────────────────────────────────────────────────────────────
function buildTail() {
  const caud = new THREE.Group();
  for (let i = 0; i < CAUDAL.length; i++) {
    const d = CAUDAL[i];
    const r = lerp(0.028, 0.009, i / (CAUDAL.length - 1));
    const next = CAUDAL[Math.min(CAUDAL.length - 1, i + 1)];
    caud.add(tube([V(d.x, d.y, 0), V(next.x, next.y, 0)], r, 'bone2', { radial: 10 }));
  }
  place('vertebras_caudales', caud, 'hueso');

  // Apófisis hemales: procesos ventrales de las primeras caudales (Cd1-Cd4)
  const hem = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const d = CAUDAL[i];
    hem.add(tube([V(d.x, d.y - 0.02, 0), V(d.x - 0.01, d.y - 0.07, 0)], (t) => lerp(0.012, 0.007, t), 'bone', { radial: 8 }));
  }
  place('ap_hemales', hem, 'hueso');
  // Arcos hemales: arcos óseos ventrales Cd2-Cd4 que rodean los vasos
  const arcs = new THREE.Group();
  for (let i = 1; i < 4; i++) {
    const d = CAUDAL[i];
    const arc = [];
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * (0.15 + 0.7 * k / 10);
      arc.push(V(d.x, d.y - 0.012 - Math.sin(a) * 0.045, Math.cos(a) * 0.03));
    }
    arcs.add(tube(arc, 0.007, 'bone', { radial: 8 }));
  }
  place('arcos_hemales', arcs, 'hueso');

  // A. y v. caudal mediana (ventral, entre los arcos hemales a lo largo de la cola)
  const vesselPts = CAUDAL.map((p) => V(p.x, p.y - 0.04 - 0.01 * Math.min(1, 0), 0));
  const vPts = CAUDAL.map((p) => V(p.x, p.y - 0.048, 0.006));
  const aPts = CAUDAL.map((p) => V(p.x, p.y - 0.044, -0.006));
  void vesselPts;
  place('a_caudal_mediana', tube(aPts, (t) => lerp(0.006, 0.002, t), 'artery', { radial: 8 }), 'vaso');
  place('v_caudal_mediana', tube(vPts, (t) => lerp(0.007, 0.0025, t), 'vein', { radial: 8 }), 'vaso');
}

// ─────────────────────────────────────────────────────────────
// 5 · MÉDULA ESPINAL (contexto) + cono medular
// ─────────────────────────────────────────────────────────────
function buildSpinalCord() {
  const pts = [
    V(THORACIC[0].x + 0.1, THORACIC[0].y + 0.012, 0),
    ...THORACIC.map((p) => V(p.x, p.y + 0.012, 0)),
    ...LUMBAR.map((p) => V(p.x, p.y + 0.012, 0)),
    V(SACRAL[0].x, SACRAL[0].y + 0.012, 0),
    V(CONUS_MEDULLARIS.x, CONUS_MEDULLARIS.y, 0),
  ];
  place(null, tube(pts, (t) => lerp(0.016, 0.004, Math.pow(t, 1.4)), 'nerve', { radial: 10 }), 'nervio');
  // cono medular: afilamiento + marcador en S2 aprox.
  const cono = group(
    tube([V(SACRAL[0].x, SACRAL[0].y + 0.012, 0), V(CONUS_MEDULLARIS.x, CONUS_MEDULLARIS.y, 0)], (t) => lerp(0.01, 0.002, t), 'nerve', { radial: 8 }),
    marker(CONUS_MEDULLARIS, '#f2c94c', 0.01, 'nerve'),
  );
  place('cono_medular', cono, 'nervio');
}

// ─────────────────────────────────────────────────────────────
// 6 · COSTILLAS + CARTÍLAGOS + ESTERNÓN
// ─────────────────────────────────────────────────────────────
function buildRibsSternum() {
  const ribs = new THREE.Group();
  const archG = new THREE.Group();     // arco costal (cartílagos 9-13)
  for (let i = 1; i <= 13; i++) {
    for (const side of [1, -1]) {
      // hueso costal
      ribs.add(tube(ribPath(i, side), (t) => lerp(0.016, 0.011, t), 'bone', { radial: 10, flat: 0.72 }));
      // cartílago costal
      const cart = tube(cartilagePath(i, side), (t) => lerp(0.012, 0.009, t), 'cartilage', { radial: 9 });
      if (i >= 9) archG.add(cart); else place(null, cart, 'hueso');
    }
  }
  place('costillas', ribs, 'hueso');
  place('arco_costal', archG, 'hueso');

  // Esternón: 7 esternebras + xifoides
  const stern = new THREE.Group();
  for (let k = 0; k < STERNUM.length; k++) {
    stern.add(blob(STERNUM[k], [0.045, 0.028, 0.045], 'bone', { noise: 0.04, detail: 3, seed: k + 2 }));
    if (k < STERNUM.length - 1) {
      stern.add(tube([STERNUM[k], STERNUM[k + 1]], 0.016, 'cartilage', { radial: 8 }));
    }
  }
  stern.add(tube([STERNUM[STERNUM.length - 1], XIPHOID], (t) => lerp(0.02, 0.006, t), 'cartilage', { radial: 8 }));
  place('esternon', stern, 'hueso');
}

// ─────────────────────────────────────────────────────────────
// 7 · MIEMBRO TORÁCICO (escápula, húmero, radio/ulna, carpo…)
// ─────────────────────────────────────────────────────────────
// Epífisis: engrosamiento esferoidal en el extremo de un hueso largo
function epiphysis(p, r, kind = 'bone2', seed = 1) {
  return blob(p, [r, r * 1.05, r * 0.95], kind, { noise: 0.05, detail: 3, seed });
}
// Hueso largo con diáfisis afinada y epífisis en ambos extremos
function longBone(a, b, r0, r1, re0, re1, kind = 'bone', seed = 1) {
  const g = new THREE.Group();
  g.add(tube([a, lerp3(a, b, 0.5), b], (t) => lerp(r0, r1, t), kind, { radial: 14 }));
  if (re0) g.add(epiphysis(a, re0, 'bone2', seed));
  if (re1) g.add(epiphysis(b, re1, 'bone2', seed + 1));
  return g;
}
function lerp3(a, b, t) { return a.clone().lerp(b, t); }

function buildForelimb() {
  for (const side of [1, -1]) {
    const S = (p) => V(p.x, p.y, side * Math.abs(p.z));
    const sc = SCAPULA;
    // Escápula: lámina triangular ancha (plana) con borde engrosado + espina en relieve
    const blade = tube([
      S(sc.cranialAngle), S(V((sc.cranialAngle.x + sc.caudalAngle.x) / 2 + 0.02, (sc.cranialAngle.y + sc.caudalAngle.y) / 2 - 0.08, 0.215)),
      S(sc.neck),
    ], (t) => lerp(0.055, 0.02, t), 'bone', { radial: 16, flat: 0.28 });
    place('escapula', blade, 'hueso');
    // espina de la escápula (cresta longitudinal sobre la lámina)
    place(null, tube([
      V((sc.cranialAngle.x + sc.caudalAngle.x) / 2, (sc.cranialAngle.y + sc.caudalAngle.y) / 2, side * 0.235),
      S(sc.neck),
    ], (t) => lerp(0.010, 0.020, t), 'bone2', { radial: 8 }), 'hueso');
    // cartílago escapular dorsal (borde superior)
    place(null, tube([S(sc.cranialAngle), S(sc.caudalAngle)], (t) => lerp(0.016, 0.018, t), 'cartilage', { radial: 8, flat: 0.4 }), 'hueso');
    // húmero (cabeza en la punta del hombro, cóndilo en el codo)
    place(null, longBone(S(sc.shoulderPoint), S(FORELIMB.humerus[1]), 0.026, 0.022, 0.034, 0.030, 'bone', 3), 'hueso');
    // olécranon (punta del codo): proceso que sobresale caudoproximal
    place(null, blob(S(ELBOW).add(V(-0.03, 0.035, 0)), [0.022, 0.034, 0.02], 'bone2', { noise: 0.06, detail: 3, seed: 5 }), 'hueso');
    // radio/ulna (vertical) con epífisis en codo y carpo
    place(null, longBone(S(FORELIMB.radius[0]), S(FORELIMB.radius[1]), 0.020, 0.018, 0.028, 0.026, 'bone', 7), 'hueso');
    // carpo (fila de huesecillos)
    place(null, blob(S(FORELIMB.carpus), [0.028, 0.026, 0.026], 'bone2', { noise: 0.08, detail: 3, seed: 9 }), 'hueso');
    // metacarpo (caña) con epífisis distal (nudillo/menudillo)
    place(null, longBone(S(FORELIMB.metacarpus[0]), S(FORELIMB.metacarpus[1]), 0.018, 0.020, 0.024, 0.026, 'bone', 11), 'hueso');
    // falanges hasta la pezuña
    place(null, tube([S(FORELIMB.metacarpus[1]), S(FORELIMB.hoof)], (t) => lerp(0.022, 0.016, t), 'bone', { radial: 10 }), 'hueso');
  }
}

// ─────────────────────────────────────────────────────────────
// 8 · MIEMBRO PELVIANO (fémur, rótula, tibia, tarso…) · contexto
// ─────────────────────────────────────────────────────────────
function buildHindlimb() {
  for (const side of [1, -1]) {
    const S = (p) => V(p.x, p.y, side * Math.abs(p.z));
    const L = HINDLIMB;
    // fémur oblicuo craneoventral (cadera → babilla), con cabeza y cóndilos
    place(null, longBone(S(L.femur[0]), S(L.femur[1]), 0.030, 0.026, 0.040, 0.034, 'bone', 13), 'hueso');
    // rótula (sobre la tróclea femoral, craneal a la babilla)
    place(null, blob(S(L.femur[1]).add(V(0.035, 0.015, 0)), [0.020, 0.026, 0.018], 'bone2', { noise: 0.04, detail: 3, seed: 2 }), 'hueso');
    // tibia caudoventral (babilla → corvejón)
    place(null, longBone(S(L.tibia[0]), S(L.tibia[1]), 0.026, 0.020, 0.032, 0.026, 'bone', 15), 'hueso');
    // tarso (corvejón) con calcáneo (tuber calcis) sobresaliente caudoproximal
    place(null, blob(S(L.hock), [0.024, 0.032, 0.022], 'bone2', { noise: 0.06, detail: 3, seed: 17 }), 'hueso');
    place(null, blob(S(L.hock).add(V(-0.045, 0.045, 0)), [0.016, 0.028, 0.016], 'bone2', { noise: 0.05, detail: 3, seed: 18 }), 'hueso');
    // metatarso (caña) vertical con menudillo distal
    place(null, longBone(S(L.metatarsus[0]), S(L.metatarsus[1]), 0.018, 0.020, 0.024, 0.026, 'bone', 19), 'hueso');
    // falanges hasta la pezuña
    place(null, tube([S(L.metatarsus[1]), S(L.hoof)], (t) => lerp(0.022, 0.016, t), 'bone', { radial: 10 }), 'hueso');
  }
}

// ─────────────────────────────────────────────────────────────
// 9 · MARCADORES PALPABLES (ambos lados)
// ─────────────────────────────────────────────────────────────
function buildPalpableMarkers() {
  const S = (p, side) => V(p.x, p.y, side * Math.abs(p.z));
  const mkBoth = (ref, p, color = '#ffffff', size = 0.013) => {
    const g = new THREE.Group();
    for (const side of [1, -1]) g.add(marker(S(p, side), color, size, 'marker'));
    place(ref, g, 'proyeccion');
  };
  mkBoth('punta_hombro', SCAPULA.shoulderPoint, '#ffd166');
  mkBoth('ang_caudal_escapula', SCAPULA.caudalAngle, '#ffd166');
  mkBoth('punta_codo', ELBOW.clone().add(V(-0.02, 0.02, 0)), '#ffd166');
  // linea_cd1cd2: pequeño anillo/línea dorsal en Cd1-Cd2
  place('linea_cd1cd2', group(
    ring(CD1_CD2, V(1, 0.2, 0), 0.02, 0.003, 'marker', '#ff4d6d'),
    marker(CD1_CD2, '#ff4d6d', 0.008, 'marker'),
  ), 'proyeccion');
}

// ─────────────────────────────────────────────────────────────
// 10 · PUNTOS CLÍNICOS (aguja fina + marcador)
// ─────────────────────────────────────────────────────────────
function needle(p, dir = V(0, 1, 0), len = 0.09, color = '#ff4d6d') {
  const tail = p.clone().add(dir.clone().normalize().multiplyScalar(len));
  return group(
    tube([p.clone(), tail], 0.0028, 'projection', { radial: 8 }),
    marker(p, color, 0.009, 'marker'),
  );
}

function buildClinicalPoints() {
  place('puncion_lumbosacra', needle(LUMBOSACRAL_SPACE, V(0, 1, 0), 0.11, '#ff4d6d'), 'proyeccion');
  const lx = (LUMBAR[0].x + LUMBAR[1].x) / 2;
  place('epidural_lumbar', needle(V(lx, 1.30, 0), V(-0.15, 1, 0), 0.10, '#ff4d6d'), 'proyeccion');
  place('epidural_caudal', needle(CD1_CD2, V(0.1, 1, 0), 0.08, '#ff4d6d'), 'proyeccion');
}

// ─────────────────────────────────────────────────────────────
// 11 · PROYECCIONES PARIETALES (sobre la piel izquierda; algunas dcha)
// ─────────────────────────────────────────────────────────────
// Helpers de proyección sobre la pared
function wallLine(samples, kind = 'projection', r = 0.004) {
  return pathLine(samples, kind, r, { radial: 8 });
}
// une costilla i (su x a la altura y) con la altura y, proyectado a la pared
function ribWall(i, y, side = 1, off = 0.006) {
  const x = ribXAtY(i, y);
  return projectToWall(x, y, side, off);
}
function costoWall(i, side = 1, off = 0.008) {
  const c = costochondral(i, side);
  return projectToWall(c.x, c.y, side, off);
}

function buildProjections() {
  const L = 1, R = -1;

  // proy_diafragma: de la 6ª unión costocondral ventral, arriba y caudal a 11ª-12ª dorsal
  const diaf = (side) => [
    costoWall(6, side, 0.008),
    projectToWall(costochondral(8, side).x - 0.05, 0.98, side),
    ribWall(10, 1.18, side),
    ribWall(12, 1.30, side),
  ];
  bothSides('proy_diafragma', (s) => wallLine(densify(diaf(s)), 'projection'));

  // linea_receso: 8ª unión costocondral → mitad 11ª costilla → 13ª dorsal
  const receso = (side) => [
    costoWall(8, side, 0.008),
    ribWall(11, 1.00, side),
    ribWall(13, 1.28, side),
  ];
  bothSides('linea_receso', (s) => wallLine(densify(receso(s)), 'projection2'));

  // proy_borde_basal: 6ª costocondral → mitad 9ª costilla → 11º EIC dorsal
  const basal = (side) => [
    costoWall(6, side, 0.008),
    ribWall(9, 1.00, side),
    projectToWall(intercostalX(11, 1.22), 1.24, side),
  ];
  bothSides('proy_borde_basal', (s) => wallLine(densify(basal(s)), 'projection'));

  // Área pulmonar (triángulo) + sus límites
  // límite craneal: ángulo caudal escápula → codo (borde caudal del tríceps)
  const lpCraneal = (side) => densify([
    projectToWall(SCAPULA.caudalAngle.x, SCAPULA.caudalAngle.y, side, 0.01),
    projectToWall(ELBOW.x, ELBOW.y + 0.03, side, 0.01),
  ]);
  // límite dorsal: horizontal bajo epiaxiales desde escápula a 11º EIC
  const lpDorsal = (side) => {
    const out = [];
    const x0 = SCAPULA.caudalAngle.x, x1 = intercostalX(11, 1.22);
    for (let k = 0; k <= 10; k++) { const x = lerp(x0, x1, k / 10); out.push(projectToWall(x, 1.30, side, 0.008)); }
    return out;
  };
  bothSides('lim_pulm_craneal', (s) => wallLine(lpCraneal(s), 'projection'));
  bothSides('lim_pulm_dorsal', (s) => wallLine(lpDorsal(s), 'projection'));
  // area_pulmonar: triángulo translúcido (vértices craneal-dorsal, dorsal-caudal, ventral)
  bothSides('area_pulmonar', (s) => {
    const poly = [
      projectToWall(SCAPULA.caudalAngle.x, SCAPULA.caudalAngle.y + 0.0, s, 0.006),
      projectToWall(intercostalX(11, 1.22), 1.28, s, 0.006),
      projectToWall(ribXAtY(9, 1.0), 1.0, s, 0.006),
      projectToWall(ELBOW.x, ELBOW.y + 0.04, s, 0.006),
    ];
    return area(poly, 'area');
  });

  // Área cardíaca (rectángulo, 3º-5º EIC desde esternón hasta línea del hombro)
  const cardTop = SCAPULA.shoulderPoint.y;    // línea del hombro
  const cardBot = 0.80;                        // sobre el esternón
  const xCr = intercostalX(2, 0.9), xCd = intercostalX(5, 0.9);
  bothSides('lim_card_dorsal', (s) => wallLine(densify([projectToWall(xCr, cardTop, s), projectToWall(xCd, cardTop, s)]), 'projection2'));
  bothSides('lim_card_ventral', (s) => wallLine(densify([projectToWall(xCr, cardBot, s, 0.01), projectToWall(xCd, cardBot, s, 0.01)]), 'projection2'));
  bothSides('lim_card_craneal', (s) => wallLine(densify([projectToWall(ribXAtY(3, cardTop), cardTop, s), projectToWall(ribXAtY(3, cardBot), cardBot, s)]), 'projection2'));
  // caudal izq = 6ª costilla; caudal dcha = 5ª costilla (solo derecha)
  place('lim_card_caudal_izq', wallLine(densify([projectToWall(ribXAtY(6, cardTop), cardTop, L), projectToWall(ribXAtY(6, cardBot), cardBot, L)]), 'projection2'), 'proyeccion');
  place('lim_card_caudal_dcha', wallLine(densify([projectToWall(ribXAtY(5, cardTop), cardTop, R), projectToWall(ribXAtY(5, cardBot), cardBot, R)]), 'projection2'), 'proyeccion');
  bothSides('area_cardiaca', (s) => area([
    projectToWall(xCr, cardTop, s, 0.004), projectToWall(xCd, cardTop, s, 0.004),
    projectToWall(xCd, cardBot, s, 0.004), projectToWall(xCr, cardBot, s, 0.004),
  ], 'area'));

  // Proyección del corazón (silueta) sobre la pared izquierda
  const hy0 = 0.99, hy1 = 0.69;
  const heartOutline = (s) => {
    // silueta en lágrima: base ancha dorsal (3ª-6ª costilla), ápex estrecho ventral
    const xVD = ribXAtY(3, 0.88), xVI = ribXAtY(6, 0.88);
    const xMid = (xVD + xVI) / 2;
    const pts = [];
    const steps = 22;
    for (let k = 0; k <= steps; k++) {
      const a = Math.PI * 2 * k / steps;      // 0 = dorsal base
      const yn = Math.cos(a);                 // +1 dorsal, −1 ventral
      const y = lerp((hy0 + hy1) / 2, yn >= 0 ? hy0 : hy1, Math.abs(yn)) + 0;
      // anchura: máxima en la base, se afila hacia el ápex ventral
      const widthFactor = (yn + 1) / 2;       // 1 dorsal, 0 ventral
      const halfW = (xVD - xVI) / 2 * (0.35 + 0.65 * widthFactor);
      const x = xMid + Math.sin(a) * halfW;
      pts.push(projectToWall(x, y, s, 0.008));
    }
    return pts;
  };
  bothSides('proy_corazon', (s) => wallLine(heartOutline(s), 'projection'));
  // bordes ventriculares
  bothSides('proy_borde_vd', (s) => wallLine(densify([projectToWall(ribXAtY(3, hy0), hy0, s), projectToWall(ribXAtY(3, 0.80), 0.80, s)]), 'projection'));
  bothSides('proy_borde_vi', (s) => wallLine(densify([projectToWall(ribXAtY(6, hy0), hy0, s), projectToWall(ribXAtY(6, 0.78), 0.78, s)]), 'projection'));

  // Escotaduras cardíacas (patch pequeño, 3º-4º EIC ventral)
  const escot = (s, w, h) => {
    const x = intercostalX(3, 0.82);
    return area([
      projectToWall(x - w, 0.86, s, 0.005), projectToWall(x + w, 0.86, s, 0.005),
      projectToWall(x + w, 0.78 - h, s, 0.005), projectToWall(x - w, 0.78 - h, s, 0.005),
    ], 'area');
  };
  place('proy_escotadura_izq', escot(L, 0.05, 0.03), 'proyeccion');
  place('proy_escotadura_dcha', escot(R, 0.035, 0.02), 'proyeccion');

  // Proyección de la bifurcación (4º-5º EIC media altura, BIFURCATION lateralizada)
  const bifL = projectToWall(BIFURCATION.x, 0.9, L, 0.006);
  const bifR = projectToWall(BIFURCATION.x, 0.9, R, 0.006);
  place('proy_bifurcacion', group(marker(bifL, '#ff4d6d', 0.011, 'marker'), marker(bifR, '#ff4d6d', 0.011, 'marker')), 'proyeccion');

  // Focos de auscultación (marcadores)
  place('aus_pulmonar', marker(projectToWall(intercostalX(3, 0.82), 0.82, L, 0.008), '#ffffff', 0.012, 'marker'), 'proyeccion');
  place('aus_aortica', marker(projectToWall(intercostalX(4, cardTop - 0.05), cardTop - 0.05, L, 0.008), '#ffffff', 0.012, 'marker'), 'proyeccion');
  place('aus_mitral', marker(projectToWall(intercostalX(5, 0.84), 0.84, L, 0.008), '#ffffff', 0.012, 'marker'), 'proyeccion');
  place('aus_tricuspide', marker(projectToWall(intercostalX(3, 0.84), 0.84, R, 0.008), '#ffffff', 0.012, 'marker'), 'proyeccion');
}

// coloca una proyección en ambos lados (izq + dcho) con la misma función
function bothSides(ref, make) {
  const g = new THREE.Group();
  g.add(make(1));
  g.add(make(-1));
  place(ref, g, 'proyeccion');
}

// densifica una polilínea insertando puntos intermedios (para que siga la pared)
function densify(samples, perSeg = 4) {
  const out = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i], b = samples[i + 1];
    for (let k = 0; k < perSeg; k++) out.push(a.clone().lerp(b, k / perSeg));
  }
  out.push(samples[samples.length - 1].clone());
  return out;
}
