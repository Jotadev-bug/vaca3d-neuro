// ─────────────────────────────────────────────────────────────
// p11/pelvis.js · Práctica 11 · Pelvis ósea, cavidad pelviana,
// recto pelviano, genitales femeninos, vejiga, peritoneo pélvico,
// medidas obstétricas, periné/vulva y ubre.
// Mundo: +X craneal · +Y dorsal · +Z izquierda · metros.
// ─────────────────────────────────────────────────────────────
import { HINDLIMB, CAUDAL, SACRAL } from '../../frame.js';
import { place, both, makeMaterial } from '../../geo.js';
import {
  E, S, K, U, D, H, W, nearestPart, part, parts, T, R, tubeMesh, diskMesh, sheet, ringPts, group,
  clamp, lerp, V, THREE, noise3,
} from './kit.js';

const C = {
  bone: '#ece2cc', bone2: '#dccfb2', cart: '#c9e0e3', lig: '#e6d6b0',
  rect: '#c99a86', rectIn: '#b0675e', vag: '#d99a9a', vagIn: '#c76f78', ut: '#d68f86', utIn: '#b85d63',
  car: '#9c3a46', cervix: '#e2b0a4', ov: '#efd2b8', fol: '#bfe0ee', cl: '#e0a040', tube: '#e6a3a0',
  blad: '#e7c3a2', bladIn: '#d9a08c', vulva: '#8a5a5a', serosa: '#f1dea0',
  gland: '#f0c2a8', glandIn: '#e8a890', sinus: '#f6eddc', teat: '#e8b8a4', duct: '#f3e7c4',
};
const SEROSA = { kind: 'ligament', color: C.serosa, layer: 'omento', mat: { transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide } };

// ── referencias óseas (lado izq) ──
const CT = [HINDLIMB.coxalTuber.x, HINDLIMB.coxalTuber.y, HINDLIMB.coxalTuber.z];
const ST = [HINDLIMB.sacralTuber.x, HINDLIMB.sacralTuber.y, HINDLIMB.sacralTuber.z];
const IT = [HINDLIMB.ischialTuber.x, HINDLIMB.ischialTuber.y, HINDLIMB.ischialTuber.z];
export const FEM_HEAD = [-1.585, 0.995, 0.19];          // centro de la cabeza del fémur
const ACET = [-1.585, 1.0, 0.172];                      // centro del acetábulo (copa)
const IB = [-1.50, 1.08, 0.165];                        // cuerpo del ilion
export const SYMPH = [[-1.555, 0.885, 0.004], [-1.70, 0.905, 0.004], [-1.83, 0.935, 0.004]];
const OBT = [-1.665, 0.922, 0.085];                     // agujero obturado
export const PROMONTORY = [-1.42, 1.188, 0];
export const PECTEN = [-1.555, 0.895, 0];

export function build() {
  buildPelvisBone();
  buildPelvicMeasures();
  buildRectum();
  buildFemaleTract();
  buildBladder();
  buildPeritoneum();
  buildExternal();
  buildUdder();
  buildRectalExtras();
}

// ═════════════════════════════════════════════════════════════
// 1 · COXAL (ilion, isquion, pubis, acetábulo) + sínfisis + ligamentos
// ═════════════════════════════════════════════════════════════
function buildPelvisBone() {
  const wingFan = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = [lerp(CT[0], ST[0], t), lerp(CT[1], ST[1], t) - 0.01 * Math.sin(Math.PI * t), lerp(CT[2], ST[2], t)];
    wingFan.push(K([p, [lerp(p[0], IB[0], 0.5), lerp(p[1], IB[1], 0.5), lerp(p[2], IB[2], 0.55)], IB], [0.010, 0.009, 0.016]));
  }
  const comps = {
    ala: U([...wingFan, K([CT, [(CT[0] + ST[0]) / 2, (CT[1] + ST[1]) / 2 + 0.005, (CT[2] + ST[2]) / 2], ST], 0.013)], 0.028),
    tub_coxal: U([E(CT, [0.034, 0.026, 0.036]), E([CT[0] - 0.01, CT[1] - 0.03, CT[2] + 0.005], [0.022, 0.024, 0.025])], 0.015),
    tub_sacra: E(ST, [0.028, 0.022, 0.022]),
    cuerpo_ilion: K([IB, [-1.545, 1.035, 0.172], ACET], [0.024, 0.022, 0.03]),
    acetabulo: S(ACET, 0.043),
    pubis: K([[-1.57, 0.975, 0.165], [-1.556, 0.915, 0.09], [-1.555, 0.888, 0.008]], [0.017, 0.013, 0.011]),
    isquion: U([
      K([ACET, [-1.66, 1.02, 0.165], [-1.75, 1.04, 0.15], IT], [0.024, 0.019, 0.018, 0.02]),
      sheet(SYMPH, [[-1.56, 0.90, 0.085], [-1.63, 0.945, 0.15], [-1.73, 0.99, 0.155], [-1.835, 1.025, 0.11]], 0.0075, 26, 0.02),
    ], 0.015),
    tub_isquiatica: U([E(IT, [0.026, 0.032, 0.024]), E([IT[0] + 0.005, IT[1] + 0.03, IT[2] + 0.01], [0.018, 0.016, 0.018]), E([IT[0] - 0.005, IT[1] - 0.035, IT[2] - 0.012], [0.016, 0.016, 0.016])], 0.012),
  };
  const keys = Object.keys(comps), list = keys.map((k) => comps[k]);
  let coxal = U(list, 0.014);
  coxal = D(coxal, S(FEM_HEAD, 0.033), 0.004);                         // copa articular
  coxal = D(coxal, E(OBT, [0.046, 0.04, 0.038], [0, 0, 0.18]), 0.006); // agujero obturado (sin membrana)
  // escotadura acetabular (hendidura que separa las porciones de la cara semilunar)
  coxal = D(coxal, E([-1.598, 0.968, 0.19], [0.012, 0.012, 0.03]), 0.004);
  const near = nearestPart(list);
  const styles = {};
  const REF = {
    ala: 'pel_ala_ilion', tub_coxal: 'tuberosidad_coxal', tub_sacra: 'tuberosidad_sacra', cuerpo_ilion: 'pel_cuerpo_ilion',
    acetabulo: 'pel_acetabulo', pubis: 'pel_pubis', isquion: 'pel_isquion', tub_isquiatica: 'pel_tub_isquiatica',
  };
  for (const k of keys) styles[k] = { ref: REF[k], color: k.startsWith('tub') ? '#e9dbbd' : C.bone };
  styles.lun_mayor = { ref: 'pel_lunada_mayor', color: '#cfe3e6', kind: 'cartilage' };
  styles.lun_menor = { ref: 'pel_lunada_menor', color: '#b8d6db', kind: 'cartilage' };
  parts(coxal, (x, y, z) => {
    const dh = Math.hypot(x - FEM_HEAD[0], y - FEM_HEAD[1], z - FEM_HEAD[2]);
    if (dh < 0.0365) return x > FEM_HEAD[0] - 0.006 || y > FEM_HEAD[1] + 0.012 ? 'lun_mayor' : 'lun_menor';
    return keys[near(x, y, z)];
  }, styles, { step: 0.005, mirror: true, kind: 'bone', fin: { bump: 0.12, freq: 140, aoK: 0.55 } });

  // sínfisis pélvica (línea media del suelo)
  part('pel_sinfisis', K(SYMPH.map((p) => [p[0], p[1] - 0.001, 0]), 0.0085), { kind: 'cartilage', color: '#d9e6dc', step: 0.003 });
  // articulación sacroilíaca (cara auricular, cartílago)
  part('pel_sacroiliaca', E([-1.425, 1.235, 0.068], [0.032, 0.022, 0.009], [0, 0.35, -0.25]), { kind: 'cartilage', color: C.cart, step: 0.003, mirror: true });
  // lig. sacrotuberoso ancho: lámina del borde lateral del sacro al isquion (deja los agujeros isquiáticos)
  const inHole = (x, y, z) => (((x + 1.54) / 0.04) ** 2 + ((y - 1.10) / 0.022) ** 2 < 1) || (((x + 1.70) / 0.025) ** 2 + ((y - 1.08) / 0.014) ** 2 < 1);
  R('lig_sacrotuberoso',
    [[-1.43, 1.205, 0.072], [-1.56, 1.195, 0.07], [-1.70, 1.165, 0.062], [-1.80, 1.135, 0.05]],
    [[-1.48, 1.105, 0.158], [-1.62, 1.058, 0.172], [-1.74, 1.052, 0.152], [-1.84, 1.085, 0.118]],
    { nu: 40, nv: 14, bulge: [0, 0.006, 0.012], hole: inHole, kind: 'ligament', color: C.lig, mirror: true, layer: 'musculo', mat: { transparent: true, opacity: 0.85, depthWrite: false } });
  // agujero obturado: contorno
  T('pel_agujero_obturado', ringPts(OBT, [0.18, 1, 0.12], 0.041, 28, 0.034), 0.0028, 'projection2', { mirror: true, layer: 'proyeccion' });
  // líneas articulares caudales (Cd1-Cd4): anillos de referencia en la cola
  const cl = [];
  for (let i = 0; i < 4; i++) {
    const a = CAUDAL[i], b = CAUDAL[i + 1];
    const c = V((a.x + b.x) / 2, (a.y + b.y) / 2, 0), n = V(b.x - a.x, b.y - a.y, 0);
    cl.push(tubeMesh(ringPts(c, n, 0.034, 24), 0.0022, 'projection'));
  }
  group('lineas_art_caudales', cl, 'proyeccion');
}

// ═════════════════════════════════════════════════════════════
// 2 · MEDIDAS OBSTÉTRICAS: aberturas, diámetros, eje, inclinación
// ═════════════════════════════════════════════════════════════
function buildPelvicMeasures() {
  const term = [
    PROMONTORY, [-1.432, 1.168, 0.07], [-1.475, 1.085, 0.14], [-1.528, 0.985, 0.157], [-1.552, 0.925, 0.105], PECTEN,
  ];
  const ring = [...term, ...term.slice(0, -1).reverse().map((p) => [p[0], p[1], -p[2]])];
  T('pel_linea_terminal', ring, 0.0035, 'projection', { layer: 'proyeccion', segs: 120 });
  // abertura craneal: plano promontorio–pecten
  const dx = PECTEN[0] - PROMONTORY[0], dy = PECTEN[1] - PROMONTORY[1];
  const L = Math.hypot(dx, dy);
  place('pel_abertura_craneal', diskMesh([(PROMONTORY[0] + PECTEN[0]) / 2, (PROMONTORY[1] + PECTEN[1]) / 2, 0], 0.152, L / 2, [-dy, dx, 0], [dx, dy, 0], '#ff4d6d', 0.24), 'proyeccion');
  // abertura caudal: arco isquiático – Cd1 – ligamentos sacrotuberosos
  place('pel_abertura_caudal', diskMesh([-1.815, 1.035, 0], 0.105, 0.098, [1, 0.12, 0], [0, 1, 0], '#2bb3a6', 0.24), 'proyeccion');
  // diámetros
  T('pel_diam_conjugado', [PROMONTORY, PECTEN], 0.003, 'projection', { mat: { color: '#ff8a00' }, layer: 'proyeccion' });
  T('pel_diam_vertical', [PECTEN, [PECTEN[0], 1.165, 0]], 0.003, 'projection', { mat: { color: '#7b61ff' }, layer: 'proyeccion' });
  T('pel_diam_transverso', [[-1.515, 1.03, 0.152], [-1.515, 1.03, -0.152]], 0.003, 'projection', { mat: { color: '#00a3ff' }, layer: 'proyeccion' });
  T('pel_eje', [[-1.40, 1.07, 0], [-1.49, 1.045, 0], [-1.62, 1.03, 0], [-1.73, 1.03, 0], [-1.83, 1.035, 0], [-1.92, 1.05, 0]], 0.0028, 'projection2', { layer: 'proyeccion' });
  // inclinación: horizontal por el pecten y arco hasta el conjugado
  const ang = Math.atan2(PROMONTORY[1] - PECTEN[1], PROMONTORY[0] - PECTEN[0]);
  const arc = [];
  for (let i = 0; i <= 16; i++) { const a = ang * i / 16; arc.push([PECTEN[0] + Math.cos(a) * 0.07, PECTEN[1] + Math.sin(a) * 0.07, 0]); }
  group('pel_inclinacion', [
    tubeMesh([PECTEN, [PECTEN[0] + 0.14, PECTEN[1], 0]], 0.0022, 'projection', { mat: { color: '#ffd400' } }),
    tubeMesh(arc, 0.0022, 'projection', { mat: { color: '#ffd400' } }),
  ], 'proyeccion');
}

// ═════════════════════════════════════════════════════════════
// 3 · RECTO PELVIANO Y CONDUCTO ANAL (+ esfínteres, diafragma pélvico)
// ═════════════════════════════════════════════════════════════
export const RECT = [[-1.58, 1.093, 0], [-1.66, 1.078, 0], [-1.74, 1.065, 0], [-1.82, 1.053, 0], [-1.875, 1.046, 0], [-1.915, 1.042, 0], [-1.945, 1.04, 0]];
function buildRectum() {
  const rad = [0.026, 0.034, 0.035, 0.03, 0.019, 0.016, 0.015];
  const outer = K(RECT, rad);
  const yc = (x) => lerp(1.04, 1.093, clamp((x + 1.945) / 0.365, 0, 1));
  const inner = (x, y, z) => {
    let b = 0;
    for (const xk of [-1.65, -1.71, -1.77]) b += 0.009 * Math.exp(-(((x - xk) / 0.006) ** 2)) * (0.6 + 0.4 * Math.cos(Math.atan2(z, y - yc(x)) * 1 + xk * 40));
    if (x < -1.872) b += 0.0028 * Math.max(0, Math.cos(10 * Math.atan2(z, y - yc(x))));   // columnas rectales
    return b;
  };
  const wall = H(outer, 0.0042, inner);
  parts(wall, (x, y, z) => {
    const inside = outer.f(x, y, z) < -0.0021;
    if (x < -1.872) return inside ? 'canal_in' : 'canal';
    return inside ? 'amp_in' : 'amp';
  }, {
    amp: { ref: 'rec_ampolla', color: C.rect, kind: 'stomach' },
    amp_in: { ref: 'rec_pliegues_transv', color: C.rectIn, kind: 'mucosa' },
    canal: { ref: 'rec_canal_anal', color: '#c08878', kind: 'stomach' },
    canal_in: { ref: 'rec_columnas', color: '#a85a58', kind: 'mucosa' },
  }, { step: 0.003, thin: true, layer: 'viscera', fin: { bump: 0.2, freq: 160 } });
  // esfínteres
  const ax = V(-1, -0.1, 0);
  T('m_esfinter_int_ano', ringPts([-1.905, 1.043, 0], ax, 0.0175, 28), 0.0035, 'muscle2', { layer: 'musculo' });
  T('m_esfinter_ext_ano', ringPts([-1.935, 1.041, 0], ax, 0.0215, 28), 0.005, 'muscle', { layer: 'musculo' });
  // diafragma pélvico: elevador del ano y coccígeo (lámina de la espina isquiática al ano / a la cola)
  const c1 = CAUDAL[1], c3 = CAUDAL[3];
  R('m_elevador_ano', [[-1.72, 1.06, 0.125], [-1.76, 1.03, 0.12]], [[-1.89, 1.06, 0.026], [-1.90, 1.025, 0.024]], { nu: 6, nv: 14, bulge: [0, 0, 0.012], kind: 'muscle2', color: '#b44c4c', layer: 'musculo', mirror: true });
  R('m_coccigeo', [[-1.70, 1.08, 0.13], [-1.73, 1.07, 0.13]], [[c1.x, c1.y - 0.01, 0.035], [c3.x, c3.y - 0.01, 0.03]], { nu: 6, nv: 14, bulge: [0, 0, 0.01], kind: 'muscle', color: '#c4554f', layer: 'musculo', mirror: true });
  // mesorrecto: lámina sagital dorsal al recto
  R('rec_mesorrecto', [[-1.56, 1.122, 0], [-1.66, 1.112, 0], [-1.72, 1.10, 0]], [[-1.56, 1.175, 0], [-1.66, 1.16, 0], [-1.72, 1.148, 0]], { ...SEROSA, nu: 12, nv: 4 });
}

// ═════════════════════════════════════════════════════════════
// 4 · GENITALES FEMENINOS (ovario, trompa, útero, cérvix, vagina, vestíbulo)
// ═════════════════════════════════════════════════════════════
export const OVARY = [-1.478, 0.972, 0.137];
export const HORN = [[-1.535, 1.0, 0.014], [-1.50, 1.008, 0.018], [-1.465, 1.006, 0.028], [-1.435, 0.99, 0.048], [-1.42, 0.965, 0.07], [-1.425, 0.94, 0.09], [-1.445, 0.928, 0.105], [-1.47, 0.932, 0.118], [-1.485, 0.948, 0.125]];
const HORN_R = [0.021, 0.022, 0.02, 0.018, 0.016, 0.014, 0.012, 0.01, 0.0085];
const caruncles = (x, y, z) => 0.009 * Math.max(0, noise3(x * 110, y * 110, z * 110, 3) - 0.35);
function buildFemaleTract() {
  // ── cuernos (izq/dcho) huecos con carúnculas; bordes mesométrico (cóncavo) y libre (convexo)
  const coilC = [-1.455, 0.965, 0.075];
  const horn = K(HORN, HORN_R);
  const hornW = H(horn, 0.0036, caruncles);
  for (const side of [1, -1]) {
    const sgn = side > 0 ? 'izq' : 'dcho';
    const sh = { ...hornW, f: (x, y, z) => hornW.f(x, y, side * z), lo: [hornW.lo[0], hornW.lo[1], side > 0 ? hornW.lo[2] : -hornW.hi[2]], hi: [hornW.hi[0], hornW.hi[1], side > 0 ? hornW.hi[2] : -hornW.lo[2]] };
    parts(sh, (x, y, z, nx, ny, nz) => {
      const zz = side * z;
      if (horn.f(x, y, zz) < -0.0015) return 'in';
      // normal hacia el centro de la espiral = borde mesométrico (cóncavo)
      const tx = coilC[0] - x, ty = coilC[1] - y, tz = coilC[2] - zz;
      const L = Math.hypot(tx, ty, tz) || 1;
      const dot = (nx * tx + ny * ty + side * nz * tz) / L;
      if (dot > 0.55) return 'meso';
      if (dot < -0.55) return 'libre';
      return 'cuerno';
    }, {
      cuerno: { ref: `fem_cuerno_${sgn}`, color: C.ut, kind: 'stomach' },
      meso: { ref: `fem_cuerno_${sgn}_meso`, color: '#c97c75', kind: 'stomach' },
      libre: { ref: `fem_cuerno_${sgn}_libre`, color: '#dd9c92', kind: 'stomach' },
      in: { ref: `fem_endometrio_${sgn}`, color: C.utIn, kind: 'mucosa' },
    }, { step: 0.0026, thin: true, layer: 'viscera', fin: { bump: 0.15, freq: 150 } });
  }
  // ── cuerpo del útero (corto) + velo uterino
  const body = K([[-1.535, 1.0, 0], [-1.56, 0.999, 0], [-1.588, 0.996, 0]], [0.026, 0.026, 0.025]);
  parts(H(body, 0.0036, caruncles), (x, y, z) => (body.f(x, y, z) < -0.0016 ? 'in' : 'out'), {
    out: { ref: 'fem_cuerpo_utero', color: C.ut, kind: 'stomach' },
    in: { ref: 'fem_endometrio_cuerpo', color: C.utIn, kind: 'mucosa' },
  }, { step: 0.0025, thin: true, layer: 'viscera' });
  part('fem_velo_uterino', E([-1.538, 1.0, 0], [0.012, 0.018, 0.0022]), { kind: 'mucosa', color: '#c06a70', step: 0.0018, layer: 'viscera' });
  // ── ligamentos intercornuales dorsal y ventral (bo)
  part('fem_lig_intercornual_d', K([[-1.505, 1.022, -0.024], [-1.507, 1.03, 0], [-1.505, 1.022, 0.024]], 0.0045), { kind: 'ligament', color: '#e9c9b4', step: 0.002, layer: 'viscera' });
  part('fem_lig_intercornual_v', K([[-1.51, 0.988, -0.022], [-1.512, 0.982, 0], [-1.51, 0.988, 0.022]], 0.0045), { kind: 'ligament', color: '#e9c9b4', step: 0.002, layer: 'viscera' });
  // ── cuello del útero: grueso, canal estrecho con pliegues circulares; porción prevaginal y vaginal
  const CX = [[-1.588, 0.996, 0], [-1.62, 0.995, 0], [-1.663, 0.992, 0]];
  const cervixOut = K(CX, [0.025, 0.026, 0.02]);
  const canal = (x, y, z) => {
    const r = 0.0028 + 0.0055 * Math.max(0, Math.sin((x + 1.588) / 0.0105 * Math.PI * 2));
    return Math.hypot(y - 0.994, z) - r;
  };
  const cervix = { ...cervixOut, f: (x, y, z) => Math.max(cervixOut.f(x, y, z), -canal(x, y, z)) };
  parts(cervix, (x, y, z) => {
    if (Math.hypot(y - 0.994, z) < 0.0105 && cervixOut.f(x, y, z) < -0.004) return 'canal';
    return x > -1.638 ? 'pre' : 'vag';
  }, {
    pre: { ref: 'fem_cervix_prevaginal', color: C.cervix, kind: 'stomach' },
    vag: { ref: 'fem_cervix_vaginal', color: '#e7bcb0', kind: 'stomach' },
    canal: { ref: 'fem_cervix_canal', color: '#b86a6e', kind: 'mucosa' },
  }, { step: 0.0022, layer: 'viscera' });
  // glándulas cervicales (ov, cap) → solo ficha
  // ── vagina: hueca, fórnix alrededor de la porción vaginal; rugosidades y pliegues longitudinales
  const VG = [[-1.632, 0.992, 0], [-1.70, 0.987, 0], [-1.765, 0.982, 0], [-1.80, 0.978, 0]];
  const vag = K(VG, [0.03, 0.031, 0.029, 0.024]);
  const vagRelief = (x, y, z) => {
    const a = Math.atan2(z, y - 0.985);
    return 0.0022 * Math.max(0, Math.cos(a * 9)) + 0.0018 * Math.max(0, noise3(x * 140, y * 140, z * 140, 9));
  };
  parts(H(vag, 0.0034, vagRelief), (x, y, z) => {
    if (vag.f(x, y, z) < -0.0017) return x > -1.665 ? 'fornix' : (y > 0.985 ? 'in_d' : 'in_v');
    return y > 0.985 ? 'dorsal' : 'ventral';
  }, {
    dorsal: { ref: 'fem_vagina_dorsal', color: C.vag, kind: 'stomach' },
    ventral: { ref: 'fem_vagina_ventral', color: '#d38e90', kind: 'stomach' },
    in_d: { ref: 'fem_vagina_rugosidades', color: C.vagIn, kind: 'mucosa' },
    in_v: { ref: 'fem_vagina_pliegues', color: '#bb6470', kind: 'mucosa' },
    fornix: { ref: 'fem_fornix', color: '#a94f62', kind: 'mucosa' },
  }, { step: 0.0024, thin: true, layer: 'viscera' });
  // himen / orificio vaginal (unión vagina-vestíbulo)
  T('fem_himen', ringPts([-1.80, 0.977, 0], [1, 0.05, 0], 0.021, 28), 0.0026, 'mucosa', { color: '#e48a9a', layer: 'viscera' });
  T('fem_orificio_vaginal', ringPts([-1.806, 0.976, 0], [1, 0.05, 0], 0.0235, 28), 0.0016, 'projection', { mat: { color: '#ff4d6d' }, layer: 'proyeccion' });
  // ── vestíbulo + divertículo suburetral + orificio uretral externo
  const VS = [[-1.805, 0.976, 0], [-1.86, 0.968, 0], [-1.925, 0.955, 0]];
  const vest = K(VS, [0.024, 0.023, 0.02]);
  parts(H(vest, 0.0034), (x, y, z) => (vest.f(x, y, z) < -0.0017 ? 'in' : 'out'), {
    out: { ref: 'fem_vestibulo', color: '#d8a0a0', kind: 'stomach' },
    in: { ref: 'fem_vestibulo_mucosa', color: '#c87884', kind: 'mucosa' },
  }, { step: 0.0024, thin: true, layer: 'viscera' });
  part('fem_diverticulo_suburetral', E([-1.792, 0.946, 0], [0.011, 0.005, 0.006]), { kind: 'mucosa', color: '#d08a8e', step: 0.0018, layer: 'viscera' });
  T('fem_orificio_uretral', ringPts([-1.806, 0.955, 0], [0.1, 1, 0], 0.0045, 16), 0.0014, 'projection', { mat: { color: '#ffd400' }, layer: 'proyeccion' });
  // gl. vestibulares mayores (pares) y menores (filas en el suelo)
  part('fem_gl_vestibular_mayor', E([-1.865, 0.962, 0.021], [0.011, 0.007, 0.005]), { kind: 'gland', color: '#e59ab4', step: 0.0018, mirror: true, layer: 'glandula' });
  const mins = [];
  for (let i = 0; i < 6; i++) for (const s of [1, -1]) mins.push(S([-1.83 - i * 0.015, 0.951 - i * 0.0018, s * 0.008], 0.0022));
  part('fem_gl_vestibulares_menores', U(mins, 0.001), { kind: 'gland', color: '#e7a7bf', step: 0.0012, layer: 'glandula' });
  // ── clítoris: glande, prepucio y fosa (comisura ventral)
  part('fem_glande_clitoris', E([-1.94, 0.896, 0], [0.005, 0.004, 0.004]), { kind: 'mucosa', color: '#e07e8c', step: 0.0012, layer: 'viscera' });
  part('fem_prepucio_clitoris', D(E([-1.942, 0.895, 0], [0.008, 0.0075, 0.0075]), E([-1.946, 0.897, 0], [0.008, 0.0055, 0.0055]), 0.001), { kind: 'mucosa', color: '#c9868e', step: 0.0012, layer: 'viscera' });
  T('fem_fosa_clitoris', ringPts([-1.947, 0.896, 0], [1, 0, 0], 0.0085, 18), 0.0011, 'projection', { mat: { color: '#7b61ff' }, layer: 'proyeccion' });

  // ── ovario (folículo y cuerpo lúteo) y trompa uterina
  part('fem_ovario', E(OVARY, [0.019, 0.012, 0.011], [0, 0.4, 0.2]), { kind: 'gland', color: C.ov, step: 0.0018, mirror: true, layer: 'viscera', fin: { bump: 0.5, freq: 260 } });
  part('fem_foliculo', S([OVARY[0] + 0.009, OVARY[1] + 0.004, OVARY[2] + 0.006], 0.0068), { kind: 'gland', color: C.fol, step: 0.0012, layer: 'viscera', mat: { transparent: true, opacity: 0.8, roughness: 0.15, clearcoat: 0.8 } });
  // cuerpo lúteo en el ovario derecho (z < 0)
  part('fem_cuerpo_luteo', U([S([OVARY[0] - 0.009, 0.966, -(OVARY[2] + 0.004)], 0.0085), E([OVARY[0] - 0.009, 0.972, -(OVARY[2] + 0.006)], [0.004, 0.006, 0.004])], 0.004), { kind: 'gland', color: C.cl, step: 0.0012, layer: 'viscera' });
  // trompa: infundíbulo (embudo) → ampolla → istmo, tortuosa por el mesosálpinx hasta el cuerno
  const tubePts = [];
  const start = V(OVARY[0] + 0.012, OVARY[1] + 0.008, OVARY[2] + 0.02), end = V(...HORN[HORN.length - 1]);
  const mid = V(OVARY[0] - 0.02, OVARY[1] - 0.012, OVARY[2] + 0.03);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, p = curve.getPoint(t);
    p.x += 0.004 * Math.sin(t * 38); p.y += 0.0035 * Math.cos(t * 31); p.z += 0.003 * Math.sin(t * 27 + 1);
    tubePts.push(p);
  }
  T('fem_trompa_ampolla', tubePts.slice(0, 38), (t) => lerp(0.0028, 0.002, t), 'mucosa', { color: C.tube, mirror: true, layer: 'viscera', radial: 8, segs: 160 });
  T('fem_trompa_istmo', tubePts.slice(37), 0.0015, 'mucosa', { color: '#dd8f8f', mirror: true, layer: 'viscera', radial: 8, segs: 120 });
  const inf = D(E([start.x + 0.004, start.y + 0.003, start.z + 0.004], [0.009, 0.008, 0.006], [0, 0.6, 0.3]), E([start.x + 0.008, start.y + 0.005, start.z + 0.006], [0.008, 0.007, 0.005], [0, 0.6, 0.3]), 0.001);
  part('fem_infundibulo', W(inf, (x, y, z) => 0.0012 * noise3(x * 600, y * 600, z * 600, 4)), { kind: 'mucosa', color: '#e9a2a6', step: 0.0012, mirror: true, layer: 'viscera' });
  // lig. propio (ovario → punta del cuerno) y suspensor (ovario → pared lumbar)
  T('fem_lig_propio_ovario', [OVARY, [OVARY[0] - 0.004, OVARY[1] - 0.012, OVARY[2] - 0.006], HORN[HORN.length - 1]], 0.0032, 'ligament', { mirror: true, layer: 'omento' });
  T('fem_lig_suspensor_ovario', [OVARY, [-1.45, 1.03, 0.15], [-1.40, 1.09, 0.155], [-1.36, 1.12, 0.15]], 0.003, 'ligament', { mirror: true, layer: 'omento' });
}

// ═════════════════════════════════════════════════════════════
// 5 · VEJIGA, uretra femenina, ligamentos vesicales
// ═════════════════════════════════════════════════════════════
export const BLADDER = [-1.50, 0.925, 0];
function buildBladder() {
  const v = U([E(BLADDER, [0.07, 0.042, 0.048]), K([[-1.54, 0.92, 0], [-1.568, 0.915, 0]], [0.016, 0.008])], 0.02);
  parts(H(v, 0.0038, (x, y, z) => 0.0015 * Math.max(0, noise3(x * 90, y * 90, z * 90, 5))), (x, y, z) => (v.f(x, y, z) < -0.0019 ? 'in' : 'out'), {
    out: { ref: 'vejiga', color: C.blad, kind: 'stomach' },
    in: { ref: 'vejiga_mucosa', color: C.bladIn, kind: 'mucosa' },
  }, { step: 0.0028, thin: true, layer: 'viscera' });
  T('fem_uretra', [[-1.565, 0.915, 0], [-1.65, 0.926, 0], [-1.73, 0.94, 0], [-1.80, 0.953, 0]], 0.0055, 'mucosa', { color: '#d79a8a', layer: 'viscera' });
  // lig. mediano (a la pared ventral) y laterales (con el lig. redondo en su borde)
  R('vejiga_lig_mediano', [[-1.44, 0.888, 0], [-1.53, 0.884, 0]], [[-1.30, 0.775, 0], [-1.52, 0.87, 0]], { ...SEROSA, nu: 8, nv: 6 });
  R('vejiga_lig_lateral', [[-1.46, 0.928, 0.046], [-1.54, 0.926, 0.04]], [[-1.44, 0.985, 0.142], [-1.55, 0.98, 0.152]], { ...SEROSA, nu: 8, nv: 6, mirror: true });
  T('vejiga_lig_redondo', [[-1.46, 0.93, 0.047], [-1.45, 0.96, 0.10], [-1.44, 0.985, 0.142]], 0.0022, 'ligament', { mirror: true, layer: 'omento' });
}

// ═════════════════════════════════════════════════════════════
// 6 · PERITONEO PÉLVICO: lig. ancho, mesos, excavaciones, pliegue genital
// ═════════════════════════════════════════════════════════════
function buildPeritoneum() {
  const wall = [[-1.39, 1.10, 0.15], [-1.47, 1.105, 0.152], [-1.56, 1.095, 0.13], [-1.66, 1.08, 0.10]];
  const tract = [[-1.43, 0.985, 0.052], [-1.49, 1.012, 0.024], [-1.57, 1.01, 0.022], [-1.66, 1.005, 0.028]];
  R('fem_mesometrio', tract, wall, { ...SEROSA, nu: 24, nv: 8, bulge: [0, -0.01, 0.01], mirror: true });
  R('fem_mesovario', [[-1.465, 1.04, 0.142], [-1.495, 1.04, 0.138]], [[OVARY[0] + 0.012, OVARY[1] + 0.01, OVARY[2]], [OVARY[0] - 0.012, OVARY[1] + 0.01, OVARY[2]]], { ...SEROSA, nu: 5, nv: 5, mirror: true });
  R('fem_mesosalpinx', [[OVARY[0] + 0.012, OVARY[1] + 0.004, OVARY[2] + 0.016], [OVARY[0] - 0.012, OVARY[1] - 0.006, OVARY[2] + 0.02]], [[OVARY[0] + 0.004, OVARY[1] + 0.024, OVARY[2] + 0.008], [OVARY[0] - 0.016, OVARY[1] + 0.02, OVARY[2] + 0.01]], { ...SEROSA, nu: 5, nv: 5, mirror: true, color: '#f3d5a0' });
  // bolsa ovárica: media cúpula lateral (abierta medialmente) que envuelve el ovario
  const cupG = new THREE.SphereGeometry(1, 22, 14, 0, Math.PI);
  cupG.scale(0.028, 0.022, 0.02);
  const cupM = new THREE.Mesh(cupG, makeMaterial('ligament', { ...SEROSA.mat, color: '#f6e2b4' }));
  cupM.position.set(OVARY[0], OVARY[1] + 0.002, OVARY[2] + 0.002);
  both('fem_bolsa_ovarica', cupM, 'omento');
  // excavaciones (fondos de saco peritoneales)
  const exc = (ref, c, r, color) => {
    const g = new THREE.SphereGeometry(1, 28, 10); g.scale(...r);
    const m = new THREE.Mesh(g, makeMaterial('area', { color, opacity: 0.42 })); m.position.set(...c);
    place(ref, m, 'proyeccion');
  };
  exc('exc_rectogenital', [-1.565, 1.052, 0], [0.032, 0.008, 0.06], '#ff8a00');
  exc('exc_vesicogenital', [-1.53, 0.973, 0], [0.028, 0.0055, 0.052], '#7b61ff');
  exc('exc_pubovesical', [-1.535, 0.891, 0], [0.026, 0.0045, 0.05], '#00a3ff');
  R('fem_pliegue_genital', [[-1.53, 0.97, -0.03], [-1.53, 0.975, 0.03]], [[-1.56, 0.982, -0.025], [-1.56, 0.985, 0.025]], { ...SEROSA, nu: 6, nv: 3 });
}

// ═════════════════════════════════════════════════════════════
// 7 · EXTERIOR: periné, ano, vulva (labios, comisuras, rima)
// ═════════════════════════════════════════════════════════════
function buildExternal() {
  group('perine', [
    diskMesh([-1.952, 0.99, 0], 0.085, 0.115, [-1, 0, 0], [0, 1, 0], '#ff4d6d', 0.22),
    ...[1, -1].map((s) => diskMesh([-1.946, 1.04, s * 0.062], 0.03, 0.045, [-1, 0, s * 0.35], [0, 1, 0], '#7b61ff', 0.3)),
  ], 'proyeccion');
  T('ano', ringPts([-1.948, 1.04, 0], [1, 0, 0], 0.016, 28), 0.0055, 'mucosa', { color: '#7a4a4a', layer: 'piel' });
  for (const s of [1, -1]) {
    const lab = K([[-1.944, 1.004, s * 0.006], [-1.952, 0.975, s * 0.019], [-1.955, 0.93, s * 0.019], [-1.948, 0.893, s * 0.006]], [0.006, 0.013, 0.013, 0.006]);
    part(s > 0 ? 'vulva_labio_izq' : 'vulva_labio_dcho', lab, { kind: 'nose', color: C.vulva, layer: 'piel', step: 0.0025, fin: { bump: 0.4, freq: 300 } });
  }
  part('vulva_comisura_dorsal', S([-1.946, 1.006, 0], 0.0055), { kind: 'nose', color: '#6f4646', layer: 'piel', step: 0.0015 });
  part('vulva_comisura_ventral', K([[-1.947, 0.893, 0], [-1.952, 0.878, 0]], [0.006, 0.002]), { kind: 'nose', color: '#6f4646', layer: 'piel', step: 0.0015 });
  T('vulva_rima', [[-1.957, 1.0, 0], [-1.962, 0.95, 0], [-1.957, 0.898, 0]], 0.0016, 'eye', { layer: 'piel' });
}

// ═════════════════════════════════════════════════════════════
// 8 · UBRE: 4 mamas, surco intermamario, papilas, senos, conductos, aparato suspensor
// ═════════════════════════════════════════════════════════════
export const UDDER_C = [-1.52, 0.43, 0];
function buildUdder() {
  const q = [];
  for (const dx of [0.105, -0.105]) for (const s of [1, -1]) q.push(E([UDDER_C[0] + dx, UDDER_C[1], s * 0.095], [0.13, 0.17, 0.105]));
  let gland = U(q, 0.07);
  // surco intermamario (sagital, solo en la mitad ventral) y leve surco transversal
  const g0 = gland.f;
  gland = { ...gland, f: (x, y, z) => {
    // ranura = semiespacio |z| < w (solo donde w > 0); se resta con max()
    const w = 0.014 * clamp((0.47 - y) / 0.06, 0, 1), wt = 0.006 * clamp((0.40 - y) / 0.08, 0, 1);
    let d = g0(x, y, z);
    if (w > 4e-4) d = Math.max(d, w - Math.abs(z));
    if (wt > 4e-4) d = Math.max(d, wt - Math.abs(x - UDDER_C[0]));
    return d;
  } };
  const keyOf = (x, z) => `${x > UDDER_C[0] ? 'cr' : 'cd'}_${z > 0 ? 'izq' : 'dcho'}`;
  const styles = {};
  for (const k of ['cr_izq', 'cr_dcho', 'cd_izq', 'cd_dcho']) styles[k] = { ref: `ubre_mama_${k}`, color: C.gland };
  styles.surco = { ref: 'ubre_surco', color: '#d9967e' };
  parts(gland, (x, y, z) => (Math.abs(z) < 0.026 && y < 0.47 ? 'surco' : keyOf(x, z)), styles,
    { step: 0.006, kind: 'gland', layer: 'glandula', mat: { side: THREE.DoubleSide }, fin: { bump: 0.25, freq: 70, aoK: 0.6 } });
  // lóbulos (visibles en corte): racimos en la mama caudal izquierda
  const lobes = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, h = 0.36 + 0.035 * (i % 3);
    lobes.push(E([UDDER_C[0] - 0.105 + 0.06 * Math.cos(a), h + 0.04, 0.095 + 0.05 * Math.sin(a)], [0.032, 0.028, 0.026]));
  }
  part('ubre_lobulo', U(lobes, 0.006), { kind: 'gland', color: '#e3927c', layer: 'glandula', step: 0.004 });
  // papilas, senos lactíferos (glandular + papilar), conducto y orificio papilar, conductos lactíferos
  const teats = [], sinG = [], sinP = [], ducts = [], orif = [];
  const lact = [];
  for (const dx of [0.12, -0.12]) for (const s of [1, -1]) {
    const bx = UDDER_C[0] + dx, bz = s * (dx > 0 ? 0.10 : 0.11);
    teats.push(K([[bx, 0.275, bz], [bx, 0.215, bz], [bx + 0.002, 0.163, bz]], [0.021, 0.018, 0.014]));
    sinG.push(E([bx - dx * 0.08, 0.305, bz * 0.95], [0.034, 0.028, 0.028]));
    sinP.push(K([[bx, 0.285, bz], [bx, 0.19, bz]], [0.0095, 0.0075]));
    ducts.push(tubeMesh([[bx, 0.19, bz], [bx + 0.002, 0.162, bz]], 0.0022, 'mucosa', { color: '#a05050' }));
    orif.push(tubeMesh(ringPts([bx + 0.002, 0.161, bz], [0, 1, 0], 0.0035, 14), 0.0011, 'projection', { mat: { color: '#ffd400' } }));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + (dx > 0 ? 0 : 0.6);
      const p0 = [bx - dx * 0.08 + Math.cos(a) * 0.018, 0.325, bz * 0.95 + Math.sin(a) * 0.016];
      const p1 = [p0[0] + Math.cos(a) * 0.035, 0.40, p0[2] + Math.sin(a) * 0.03];
      const p2 = [p1[0] + Math.cos(a + 0.5) * 0.03, 0.47 + 0.02 * Math.sin(k), p1[2] + Math.sin(a + 0.5) * 0.025];
      lact.push(tubeMesh([p0, p1, p2], (t) => lerp(0.0045, 0.0018, t), 'mucosa', { color: C.duct, radial: 7 }));
      const p3 = [p1[0] + Math.cos(a - 0.6) * 0.03, 0.45, p1[2] + Math.sin(a - 0.6) * 0.03];
      lact.push(tubeMesh([p1, p3], (t) => lerp(0.003, 0.0015, t), 'mucosa', { color: C.duct, radial: 6 }));
    }
  }
  part('ubre_papila', U(teats, 0.002), { kind: 'gland', color: C.teat, layer: 'glandula', step: 0.003 });
  part('ubre_seno_glandular', U(sinG, 0.002), { kind: 'gland', color: C.sinus, layer: 'glandula', step: 0.004, mat: { transparent: true, opacity: 0.9 } });
  part('ubre_seno_papilar', U(sinP, 0.002), { kind: 'gland', color: '#fff3e0', layer: 'glandula', step: 0.003 });
  group('ubre_conducto_papilar', ducts, 'glandula');
  group('ubre_orificio_papilar', orif, 'proyeccion');
  group('ubre_conductos_lactiferos', lact, 'glandula');
  // pezones accesorios (caudales)
  part('ubre_pezones_accesorios', K([[-1.69, 0.31, 0.06], [-1.695, 0.268, 0.063]], [0.007, 0.005]), { kind: 'gland', color: C.teat, layer: 'glandula', step: 0.002, mirror: true });
  // aparato suspensor: láminas mediales (elásticas, amarillas) y laterales
  R('ubre_lamina_medial', [[-1.36, 0.735, 0.0045], [-1.70, 0.745, 0.0045]], [[-1.38, 0.31, 0.0045], [-1.68, 0.31, 0.0045]],
    { nu: 12, nv: 12, kind: 'ligament', color: '#f1d98a', layer: 'musculo', mirror: true, mat: { transparent: true, opacity: 0.85, depthWrite: false } });
  R('ubre_lamina_lateral', [[-1.40, 0.70, 0.15], [-1.56, 0.70, 0.16], [-1.72, 0.80, 0.10]], [[-1.38, 0.40, 0.198], [-1.53, 0.38, 0.212], [-1.68, 0.40, 0.2]],
    { nu: 16, nv: 10, bulge: [0, 0, 0.05], kind: 'ligament', color: '#e9dbbd', layer: 'musculo', mirror: true, mat: { transparent: true, opacity: 0.7, depthWrite: false } });
  // vasos pudendos externos (continúan los de la pared, P10) y linfonodos mamarios
  T('a_pudenda_ext', [[-1.44, 0.75, 0.10], [-1.50, 0.66, 0.095], [-1.56, 0.58, 0.085], [-1.47, 0.52, 0.09], [-1.40, 0.47, 0.10]], 0.0055, 'artery', { mirror: true, layer: 'vaso' });
  T('v_pudenda_ext', [[-1.44, 0.75, 0.115], [-1.52, 0.66, 0.11], [-1.60, 0.58, 0.10], [-1.66, 0.52, 0.10]], 0.0075, 'vein', { mirror: true, layer: 'vaso' });
  part('nnll_mamarios', U([E([-1.69, 0.625, 0.07], [0.028, 0.038, 0.014], [0, 0, -0.4]), E([-1.66, 0.585, 0.075], [0.012, 0.016, 0.01])], 0.006), { kind: 'lymph', color: '#6cc08a', layer: 'linfa', step: 0.003, mirror: true });
}

// ═════════════════════════════════════════════════════════════
// 9 · EXPLORACIÓN RECTAL: linfonodos ilíacos, a. uterina, a. ilíaca interna
// ═════════════════════════════════════════════════════════════
function buildRectalExtras() {
  part('nnll_iliacos_med', U([E([-1.462, 1.148, 0.036], [0.016, 0.008, 0.008]), E([-1.43, 1.152, 0.03], [0.009, 0.006, 0.006])], 0.004), { kind: 'lymph', color: '#6cc08a', layer: 'linfa', step: 0.002, mirror: true });
  part('nnll_inguinales_prof', E([-1.47, 0.86, 0.13], [0.016, 0.01, 0.008], [0, 0, -0.6]), { kind: 'lymph', color: '#6cc08a', layer: 'linfa', step: 0.002, mirror: true });
  T('a_iliaca_int', [[-1.45, 1.165, 0.012], [-1.50, 1.15, 0.045], [-1.57, 1.125, 0.07], [-1.66, 1.10, 0.08]], 0.0065, 'artery', { mirror: true, layer: 'vaso' });
  T('a_uterina', [[-1.50, 1.15, 0.045], [-1.50, 1.10, 0.095], [-1.47, 1.045, 0.10], [-1.445, 1.0, 0.075], [-1.44, 0.975, 0.06]], 0.0042, 'artery', { mirror: true, layer: 'vaso' });
}
