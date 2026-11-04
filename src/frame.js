// ─────────────────────────────────────────────────────────────
// frame.js · Marco anatómico común (vaca adulta, ~1.40 m a la cruz)
// +X craneal · +Y dorsal (suelo y=0) · +Z lado IZQUIERDO · metros
// TODAS las piezas del modelo se apoyan en estas referencias.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;

// ── Columna vertebral: centros de los cuerpos vertebrales ────
// Cervicales C1..C7 (curva en "S" que baja hacia la entrada del tórax)
export const CERVICAL = [
  V(0.985, 1.240), V(0.885, 1.190), V(0.790, 1.135), V(0.700, 1.085),
  V(0.610, 1.045), V(0.515, 1.025), V(0.415, 1.025),
];
// Torácicas T1..T13 (x de 0.30 a -0.75 aprox.)
export const THORACIC = Array.from({ length: 13 }, (_, i) => {
  const x = 0.31 - i * 0.0875;
  const y = 1.065 + 0.13 * Math.min(1, i / 6) + 0.012 * Math.max(0, i - 6) / 6;
  return V(x, y);
});
// Lumbares L1..L6
export const LUMBAR = Array.from({ length: 6 }, (_, i) => V(-0.84 - i * 0.095, 1.212 + 0.004 * i));
// Sacro S1..S5
export const SACRAL = Array.from({ length: 5 }, (_, i) => V(-1.42 - i * 0.07, 1.235 - 0.014 * i));
// Caudales Cd1..Cd20: horizontal al principio y luego cuelga entre los isquiones
export const CAUDAL = Array.from({ length: 20 }, (_, i) => {
  const t = i / 19;
  const ang = -0.25 - 1.15 * Math.min(1, t * 1.6);        // se inclina hacia abajo
  let x = -1.76, y = 1.17;
  for (let k = 0; k < i; k++) {
    const tk = k / 19; const a = -0.25 - 1.15 * Math.min(1, tk * 1.6);
    const len = 0.052 - 0.012 * tk;
    x += Math.cos(a) * len; y += Math.sin(a) * len;
  }
  void ang; return V(x, y);
});
export const VERTEBRA_LEN = { C: 0.095, T: 0.075, L: 0.085, S: 0.07 };

// Altura (desde el cuerpo vertebral) de las apófisis espinosas torácicas T1..T13
export const THORACIC_SPINE_H = [0.30, 0.33, 0.33, 0.31, 0.28, 0.25, 0.22, 0.19, 0.17, 0.15, 0.14, 0.13, 0.12];
// Inclinación caudal (rad) de las espinosas; T13 = anticlinal (vertical)
export const THORACIC_SPINE_TILT = [0.55, 0.55, 0.52, 0.50, 0.48, 0.45, 0.42, 0.38, 0.32, 0.25, 0.17, 0.08, 0.0];

// ── Costillas ───────────────────────────────────────────────
/** Semiancho máximo del tórax (z) a la altura de la costilla i (1..13) */
export const RIB_HALFWIDTH = [0.13, 0.17, 0.205, 0.235, 0.26, 0.28, 0.295, 0.305, 0.31, 0.315, 0.315, 0.31, 0.30];
/** Esternón: puntos craneal (manubrio) → caudal (apófisis xifoides) */
export const STERNUM = [V(0.40, 0.735), V(0.30, 0.705), V(0.18, 0.675), V(0.05, 0.655), V(-0.08, 0.645), V(-0.20, 0.645), V(-0.28, 0.650)];
export const XIPHOID = V(-0.38, 0.655);
/** Punto de unión esternal de las costillas verdaderas 1..8 (x en el esternón) */
const sternalX = (i) => lerp(0.36, -0.24, (i - 1) / 7);
function sternumY(x) {
  // interpolación lineal en STERNUM
  for (let k = 0; k < STERNUM.length - 1; k++) {
    const a = STERNUM[k], b = STERNUM[k + 1];
    if (x <= a.x && x >= b.x) return lerp(a.y, b.y, (a.x - x) / (a.x - b.x));
  }
  return x > STERNUM[0].x ? STERNUM[0].y : STERNUM[STERNUM.length - 1].y;
}
export { sternumY };

/**
 * Unión costocondral (fin del hueso costal) de la costilla i, lado side (+1 izq, −1 dcha).
 */
export function costochondral(i, side = 1) {
  const d = THORACIC[i - 1];
  const t = (i - 1) / 12;
  const x = d.x - lerp(0.02, 0.24, t);                 // las costillas se inclinan caudalmente
  const y = lerp(0.80, 0.86, t) + (i >= 10 ? (i - 9) * 0.035 : 0);
  const z = side * RIB_HALFWIDTH[i - 1] * lerp(0.80, 0.86, t);
  return V(x, y, z);
}

/**
 * Trazado de la costilla ósea i (1..13): desde la cabeza (junto al cuerpo vertebral)
 * hasta la unión costocondral. Devuelve ~7 puntos Vector3.
 */
export function ribPath(i, side = 1) {
  const d = THORACIC[i - 1];
  const w = RIB_HALFWIDTH[i - 1];
  const end = costochondral(i, side);
  const pts = [];
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    // ángulo de la costilla: sale lateral y se curva ventralmente
    const ang = lerp(0.15, Math.PI * 0.62, Math.pow(t, 0.85));
    const zr = Math.sin(ang) * w;                    // ancho
    const yv = d.y - (d.y - end.y) * (1 - Math.cos(ang * 0.82)) / (1 - Math.cos(Math.PI * 0.62 * 0.82));
    const x = lerp(d.x, end.x, Math.pow(t, 1.3));
    pts.push(V(x, k === 0 ? d.y + 0.01 : yv, side * Math.max(0.045, zr)));
  }
  pts[n] = end;
  return pts;
}

/**
 * Cartílago costal i: de la unión costocondral al esternón (1..8)
 * o al cartílago anterior formando el ARCO COSTAL (9..13).
 */
export function cartilagePath(i, side = 1) {
  const a = costochondral(i, side);
  if (i <= 8) {
    const sx = sternalX(i);
    const b = V(sx, sternumY(sx) + 0.02, side * 0.035);
    const m = V(lerp(a.x, b.x, 0.5) - 0.01, lerp(a.y, b.y, 0.6) - 0.01, side * Math.abs(a.z) * 0.62);
    return [a, m, b];
  }
  // asternales: se dirigen cranioventralmente hasta apoyarse en el cartílago previo
  const prev = costochondral(i - 1, side);
  const tgt = i === 9
    ? V(sternalX(8) - 0.03, sternumY(sternalX(8)) + 0.07, side * 0.11)
    : V(prev.x - 0.02, prev.y - 0.07, prev.z * 0.93);
  const m = V(lerp(a.x, tgt.x, 0.5), lerp(a.y, tgt.y, 0.55) - 0.02, side * Math.abs(a.z) * 0.96);
  return [a, m, tgt];
}
/** Arco costal (borde de los cartílagos 8..13) */
export function costalArch(side = 1) {
  const pts = [];
  for (let i = 13; i >= 8; i--) {
    const c = cartilagePath(i, side);
    pts.push(i === 13 ? c[0] : c[1]);
  }
  pts.push(V(XIPHOID.x, XIPHOID.y + 0.02, side * 0.05));
  return pts;
}

// ── Diafragma ───────────────────────────────────────────────
/** Inserción periférica (línea de proyección craneal en la pared): de ventral (6ª-7ª cart.) a dorsal (13ª/L1) */
export function diaphragmAttachment(side = 1) {
  return [
    V(-0.29, 0.69, side * 0.07),   // xifoides / 7º cartílago
    V(-0.34, 0.74, side * 0.20),
    V(-0.43, 0.82, side * 0.27),
    V(-0.55, 0.92, side * 0.30),
    V(-0.66, 1.02, side * 0.29),
    V(-0.76, 1.13, side * 0.21),
    V(-0.80, 1.18, side * 0.09),   // pilares, junto a T13/L1
  ];
}
/** Cúpula: punto más craneal del diafragma (≈ 6ª costilla / 6º-7º EIC, mitad de la altura) */
export const DIAPHRAGM_DOME = V(-0.24, 0.94, 0);

// ── Miembro torácico y referencias palpables (lado izq; z negativa = dcha) ──
export const SCAPULA = {
  cranialAngle: V(0.12, 1.36, 0.17),
  caudalAngle: V(-0.10, 1.33, 0.19),   // "Ángulo caudal de la escápula"
  neck: V(0.33, 1.02, 0.235),
  shoulderPoint: V(0.42, 0.96, 0.25),  // "Punta del hombro" (tubérculo mayor del húmero)
};
export const ELBOW = V(0.06, 0.74, 0.24);   // "Punta del codo" (olécranon) ~ nivel 5ª costilla
export const FORELIMB = {  // ejes de huesos (izq)
  humerus: [V(0.40, 0.96, 0.24), V(0.10, 0.76, 0.22)],
  radius: [V(0.13, 0.72, 0.22), V(0.15, 0.36, 0.20)],
  carpus: V(0.15, 0.33, 0.20),
  metacarpus: [V(0.15, 0.31, 0.20), V(0.16, 0.10, 0.19)],
  hoof: V(0.18, 0.03, 0.19),
};
export const HINDLIMB = {
  coxalTuber: V(-1.36, 1.27, 0.27),         // tuberosidad coxal
  sacralTuber: V(-1.38, 1.31, 0.06),        // "Tuberosidad sacra"
  ischialTuber: V(-1.85, 1.07, 0.12),
  hip: V(-1.58, 1.00, 0.20),
  femur: [V(-1.58, 1.00, 0.21), V(-1.46, 0.62, 0.21)],
  tibia: [V(-1.48, 0.60, 0.20), V(-1.62, 0.34, 0.18)],
  hock: V(-1.66, 0.36, 0.17),
  metatarsus: [V(-1.64, 0.32, 0.17), V(-1.60, 0.10, 0.17)],
  hoof: V(-1.58, 0.03, 0.17),
};

// ── Cabeza: marco local ─────────────────────────────────────
// Grupo de la cabeza: origen en la articulación atlantooccipital, girado hacia abajo.
// LOCAL: +x rostral (0 = cóndilos occipitales → 0.52 = hocico), +y dorsal, +z izquierda.
export const HEAD = { origin: V(1.05, 1.275, 0), angle: -0.72 };
const headMatrix = new THREE.Matrix4().compose(
  HEAD.origin, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, HEAD.angle)), V(1, 1, 1));
export function headToWorld(x, y, z = 0) { return V(x, y, z).applyMatrix4(headMatrix); }
export function makeHeadGroup() {
  const g = new THREE.Group();
  g.name = 'cabeza';
  g.position.copy(HEAD.origin);
  g.rotation.z = HEAD.angle;
  return g;
}
/** Dimensiones/landmarks del cráneo en coordenadas LOCALES de la cabeza (lado izq; espejar z). */
export const SKULL = {
  length: 0.52,
  nuchalTop: V(-0.01, 0.10, 0),        // línea de la nuca / protuberancia intercornual
  intercornual: V(0.005, 0.115, 0),
  cornualBase: V(0.01, 0.105, 0.085),  // apófisis cornual (base), dirigida lateral-dorsal
  hornDir: V(0.15, 0.55, 1).normalize(),
  orbit: V(0.165, 0.025, 0.098), orbitR: 0.036,
  temporalFossa: V(0.075, 0.035, 0.085),
  zygArch: [V(0.075, -0.025, 0.098), V(0.13, -0.04, 0.108), V(0.175, -0.025, 0.104)],
  lacrimalBulla: V(0.17, -0.035, 0.07),
  facialTuber: V(0.255, -0.045, 0.087),
  infraorbitalForamen: V(0.335, -0.035, 0.058),
  supraorbitalGroove: [V(0.06, 0.075, 0.05), V(0.14, 0.07, 0.055), V(0.22, 0.05, 0.05)],
  supraorbitalForamen: V(0.135, 0.068, 0.052),
  nasoincisiveNotch: V(0.43, -0.03, 0.04),
  incisivePremax: V(0.50, -0.07, 0.02),
  nasalTip: V(0.47, 0.0, 0),
  // ancho del cráneo (semiancho) por x local
  halfWidth: (x) => x < 0.17 ? lerp(0.075, 0.11, Math.min(1, (x + 0.01) / 0.18)) : lerp(0.11, 0.045, Math.min(1, (x - 0.17) / 0.34)),
  // dorsal (techo) y ventral (paladar) del cráneo por x
  top: (x) => x < 0.17 ? lerp(0.10, 0.075, (x + 0.01) / 0.18) : lerp(0.075, 0.005, (x - 0.17) / 0.33),
  palate: (x) => lerp(-0.055, -0.075, Math.min(1, Math.max(0, x / 0.5))),
  upperCheekTeeth: [0.17, 0.335],   // x: M3 (caudal) … P2 (rostral)
  toothRowZ: 0.058,
};
export const MANDIBLE = {
  tmj: V(0.075, -0.035, 0.092),          // articulación temporomandibular
  coronoid: V(0.11, 0.02, 0.085),
  angle: V(0.045, -0.215, 0.072),        // ángulo de la mandíbula
  facialNotch: V(0.165, -0.225, 0.06),   // escotadura de los vasos faciales
  bodyVentral: (x) => lerp(-0.225, -0.13, Math.max(0, (x - 0.18) / 0.30)),  // borde ventral
  alveolarTop: (x) => lerp(-0.095, -0.105, x / 0.5),
  interalveolar: [V(0.345, -0.115, 0.035), V(0.44, -0.12, 0.025)],
  mentalForamen: V(0.405, -0.13, 0.034),
  incisors: V(0.49, -0.11, 0.0),
  halfWidth: (x) => lerp(0.075, 0.018, Math.max(0, (x - 0.06) / 0.44)),
};
// Faringe/laringe (local cabeza)
export const PHARYNX = {
  nasopharynx: V(0.04, -0.05, 0), oropharynx: V(0.06, -0.11, 0),
  laryngopharynx: V(-0.01, -0.12, 0), larynx: V(-0.015, -0.175, 0),
};

// ── Cuello y tórax: estructuras tubulares principales (mundo) ──
export const LARYNX_WORLD = headToWorld(PHARYNX.larynx.x, PHARYNX.larynx.y);
/** Eje de la tráquea: laringe → entrada torácica → bifurcación (4º-5º EIC) */
export const TRACHEA = [
  LARYNX_WORLD.clone().add(V(-0.03, -0.02)),
  V(0.82, 1.04, 0), V(0.72, 0.96, 0), V(0.58, 0.89, 0), V(0.44, 0.85, 0),
  V(0.32, 0.86, 0),   // entrada del tórax (1ª costilla)
  V(0.16, 0.95, 0), V(0.03, 1.01, 0),
];
export const TRACHEAL_BRONCHUS_ORIGIN = V(0.13, 0.965, -0.012);  // bronquio traqueal (dcho), craneal a la bifurcación
export const BIFURCATION = V(0.0, 1.02, 0);                    // bifurcación ~4º-5º EIC
export const TRACHEA_R = 0.026;
/** Esófago: dorsal a la tráquea, desviado a la izquierda en el cuello, atraviesa el diafragma */
export const ESOPHAGUS = [
  V(0.93, 1.20, 0.0), V(0.85, 1.10, 0.015), V(0.74, 1.015, 0.035), V(0.60, 0.945, 0.045), V(0.46, 0.91, 0.04),
  V(0.32, 0.925, 0.02), V(0.10, 1.05, 0.0), V(-0.10, 1.075, -0.01), V(-0.35, 1.075, -0.01), V(-0.62, 1.06, 0.0),
];
export const ESOPHAGUS_R = 0.016;
/** Confluencia v. maxilar + v. linguofacial → v. yugular externa (caudal al ángulo mandibular) */
export const JUGULAR_ORIGIN = headToWorld(0.0, -0.17, 0.085);
/** Trayecto v. yugular externa (lado izq) por el surco yugular hasta la entrada del tórax */
export const JUGULAR = [
  JUGULAR_ORIGIN, V(0.86, 1.05, 0.10), V(0.76, 0.95, 0.115), V(0.62, 0.85, 0.125), V(0.48, 0.79, 0.13), V(0.36, 0.78, 0.10),
];

// ── Corazón (mundo) · 3º-5º EIC, base dorsal, ápex junto al esternón (6ª cost.) ──
export const HEART = {
  base: V(0.10, 0.99, 0.0),    // centro de la base (surco coronario)
  apex: V(-0.02, 0.69, 0.02),
  center: V(0.07, 0.86, 0.01),
  radii: [0.115, 0.17, 0.10],  // semiejes aproximados (craneocaudal, dorsoventral, lateral)
};
/** Espacios intercostales: x en la pared a media altura entre costilla i e i+1 (lado izq) */
export function intercostalX(i, y = 0.9) {
  const a = ribXAtY(i, y), b = ribXAtY(i + 1, y);
  return (a + b) / 2;
}
/** x de la costilla i a una altura y (aprox. lineal entre cabeza y unión costocondral) */
export function ribXAtY(i, y) {
  const d = THORACIC[i - 1], e = costochondral(i);
  const t = Math.min(1, Math.max(0, (d.y - y) / (d.y - e.y)));
  return lerp(d.x, e.x, Math.pow(t, 1.3));
}

// ── Piel: unión cabeza-cuello y contorno del cuello (compartido head/neck/body) ──
/** Borde caudal de la piel de la cabeza (LOCAL cabeza x=-0.02): elipse de y=+0.13 (nuca) a y=-0.24 (garganta), semiancho 0.11 */
export const HEAD_SKIN_EDGE = { x: -0.02, yTop: 0.13, yBot: -0.24, halfWidth: 0.11 };
/**
 * Secciones de la piel del cuello (verticales, superelipse p=2.5): centro c (x,y), semialto h, semiancho w.
 * La piel de la papada cuelga aparte (ver NECK_DEWLAP). Todo músculo/vaso del cuello debe quedar DENTRO.
 */
export const NECK_SKIN = [
  { c: V(1.00, 1.235), h: 0.165, w: 0.110 },
  { c: V(0.90, 1.165), h: 0.200, w: 0.125 },
  { c: V(0.78, 1.100), h: 0.240, w: 0.140 },
  { c: V(0.62, 1.020), h: 0.275, w: 0.165 },
  { c: V(0.46, 1.000), h: 0.330, w: 0.215 },
  { c: V(0.32, 1.010), h: 0.385, w: 0.265 },
];
export const NECK_SKIN_P = 2.5;
/** Papada: pliegue cutáneo ventral; borde libre inferior por estos puntos (z=0) */
export const NECK_DEWLAP = [V(0.80, 0.86), V(0.66, 0.70), V(0.50, 0.62), V(0.36, 0.60), V(0.26, 0.62)];

// ── Medula espinal: termina (cono medular) en S2-S3 en vacuno ──
export const CONUS_MEDULLARIS = V(SACRAL[1].x - 0.03, SACRAL[1].y + 0.01, 0);
export const LUMBOSACRAL_SPACE = V((LUMBAR[5].x + SACRAL[0].x) / 2, 1.27, 0);   // punción lumbosacra
export const CD1_CD2 = V((CAUDAL[0].x + CAUDAL[1].x) / 2, (CAUDAL[0].y + CAUDAL[1].y) / 2 + 0.05, 0);

export { V, lerp };
