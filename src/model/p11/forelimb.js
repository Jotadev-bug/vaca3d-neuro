// ─────────────────────────────────────────────────────────────
// p11/forelimb.js · Miembro torácico del vacuno (11.5)
// Esqueleto (escápula, húmero, radio-cúbito, carpo, metacarpo, dedos),
// músculos extrínsecos, de la espalda/brazo y del antebrazo, tendones
// digitales, vasos y nervios. Se modela el lado izq y se refleja.
// ─────────────────────────────────────────────────────────────
import { SCAPULA, ELBOW, FORELIMB, CERVICAL, THORACIC, THORACIC_SPINE_H, THORACIC_SPINE_TILT, ribPath, STERNUM, JUGULAR } from '../../frame.js';
import { projectToWall } from '../body/surface.js';
import { E, S, K, U, D, nearestPart, part, parts, T, R, M, sheet, distLine, group, tubeMesh, lerp, V, THREE } from './kit.js';
import { buildDigits, digitPoints } from './digit.js';

const A3 = (v) => [v.x, v.y, v.z];
const C = { bone: '#ece2cc', tub: '#e6d8b8', m1: '#c4554f', m2: '#a94545', m3: '#d97a5f', m4: '#b8604a', tendon: '#efe4cf' };
const SA = A3(SCAPULA.cranialAngle), SC = A3(SCAPULA.caudalAngle), SN = A3(SCAPULA.neck);
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// plano de la escápula (normal lateral)
const SNRM = norm(cross(sub(SC, SA), sub(SN, SA)));
const DORSAL_MID = lerp3(SA, SC, 0.45);
const UPV = norm(sub(DORSAL_MID, SN));                 // hacia el borde dorsal
export const ACROMION = add(SN, SNRM, 0.026).map((v, i) => v + [-0.02, 0.035, 0][i]);
const SPINE = [add(lerp3(SA, SC, 0.42), SNRM, 0.006), add(lerp3(lerp3(SA, SC, 0.42), ACROMION, 0.45), SNRM, 0.03), ACROMION];

// húmero
const HUM_HEAD = add(SN, [-0.012, -0.034, -0.008]);
const TUB_MAYOR = [0.425, 0.985, 0.25];
const HUM_D = [0.115, 0.755, 0.22];
const EPI_LAT = [0.10, 0.765, 0.25];
// antebrazo
const RAD0 = [0.13, 0.72, 0.22], RAD1 = [0.15, 0.365, 0.20];
const OLEC = [0.03, 0.80, 0.235];
const ULNA = [OLEC, [0.075, 0.73, 0.232], [0.105, 0.60, 0.228], [0.13, 0.39, 0.224], [0.137, 0.358, 0.228]];
// carpo / metacarpo
const MC0 = [0.152, 0.295, 0.20], MC1 = [0.158, 0.14, 0.19], FET = 0.125;

export function buildSkeleton() {
  buildScapula();
  buildArmBones();
  buildCarpusMetacarpus();
  buildDigits({ x0: 0.16, z0: 0.19, yF: FET, refs: true });
}
export function buildSoft() {
  buildExtrinsic();
  buildShoulderArm();
  buildForearm();
  buildTendons(digitPoints({ x0: 0.16, z0: 0.19, yF: FET }));
  buildVesselsNerves();
}

// ═════════════ ESQUELETO ═════════════
function buildScapula() {
  // lámina: abanico de cápsulas finas del borde dorsal al cuello; bordes craneal/caudal engrosados
  const fan = [];
  for (let i = 0; i <= 24; i++) {
    const d = lerp3(SA, SC, i / 24);
    fan.push(K([d, lerp3(d, SN, 0.55), SN], [0.0055, 0.006, 0.012]));
  }
  const blade = U([...fan, K([SA, lerp3(SA, SN, 0.5), SN], [0.007, 0.008, 0.014]), K([SC, lerp3(SC, SN, 0.5), SN], [0.011, 0.012, 0.015]), E(SN, [0.03, 0.022, 0.03])], 0.016);
  const spine = K(SPINE, [0.005, 0.009, 0.011]);
  const acr = E(ACROMION, [0.012, 0.016, 0.01]);
  const comps = [blade, spine, acr];
  const scap = U(comps, 0.008);
  const near = nearestPart(comps);
  const side0 = Math.sign(dot(cross(sub(SA, SPINE[0]), sub(ACROMION, SPINE[0])), SNRM));
  parts(scap, (x, y, z, nx, ny, nz) => {
    const c = near(x, y, z);
    if (c === 2) return 'acr';
    if (c === 1) return 'espina';
    const p = [x, y, z];
    if (Math.hypot(...sub(p, SA)) < 0.05) return 'angcr';
    if (Math.hypot(...sub(p, SC)) < 0.05) return 'angcd';
    if (dot([nx, ny, nz], SNRM) < 0) return 'medial';
    if (Math.hypot(...sub(p, SN)) < 0.06) return 'cuello';
    const s = Math.sign(dot(cross(sub(p, SPINE[0]), sub(ACROMION, SPINE[0])), SNRM));
    return s === side0 ? 'supra' : 'infra';
  }, {
    acr: { ref: 'esc_acromion', color: C.tub }, espina: { ref: 'esc_espina', color: '#e3d5b4' },
    angcr: { ref: 'esc_ang_craneal', color: C.bone }, angcd: { ref: 'esc_ang_caudal', color: C.bone },
    medial: { ref: 'esc_cara_costal', color: '#dccfb2' }, cuello: { ref: 'esc_cuello', color: C.bone },
    supra: { ref: 'esc_fosa_supra', color: '#efe5cf' }, infra: { ref: 'esc_fosa_infra', color: '#e9dfc6' },
  }, { step: 0.0042, mirror: true, layer: 'hueso', fin: { bump: 0.12, freq: 150 } });
  // cartílago de la escápula (borde dorsal)
  part('esc_cartilago', sheet([add(SA, UPV, -0.004), add(SC, UPV, -0.004)], [add(SA, UPV, 0.045), add(SC, UPV, 0.05)], 0.005, 8, 0.014),
    { kind: 'cartilage', color: '#c9e0e3', step: 0.004, mirror: true, layer: 'hueso' });
}

function buildArmBones() {
  // húmero: cabeza, tubérculo mayor, tuberosidad deltoidea, cóndilo y epicóndilo lateral
  const c = {
    cabeza: S(HUM_HEAD, 0.032),
    tub: U([E(TUB_MAYOR, [0.026, 0.03, 0.02]), E([0.41, 1.0, 0.235], [0.02, 0.02, 0.018])], 0.01),
    diaf: K([[0.37, 0.955, 0.232], [0.26, 0.86, 0.228], [0.13, 0.775, 0.224]], [0.024, 0.02, 0.022]),
    delt: E([0.31, 0.905, 0.252], [0.022, 0.013, 0.009], [0, 0, 0.6]),
    cond: E(HUM_D, [0.022, 0.02, 0.033]),
    epi: E(EPI_LAT, [0.016, 0.02, 0.011]),
  };
  const ks = Object.keys(c), list = ks.map((k) => c[k]);
  const near = nearestPart(list);
  parts(U(list, 0.012), (x, y, z) => ks[near(x, y, z)], {
    cabeza: { ref: 'hum_cabeza', color: '#e6dcc4' }, tub: { ref: 'hum_tuberculo_mayor', color: C.tub },
    diaf: { ref: 'humero', color: C.bone }, delt: { ref: 'hum_tuberosidad_deltoidea', color: C.tub },
    cond: { ref: 'humero', color: C.bone }, epi: { ref: 'hum_epicondilo_lat', color: C.tub },
  }, { step: 0.004, mirror: true, layer: 'hueso', fin: { bump: 0.12, freq: 150 } });
  // radio (con apóf. estiloidea medial) y cúbito (olécranon, apóf. estiloidea lateral)
  const rad = {
    cuerpo: U([K([RAD0, lerp3(RAD0, RAD1, 0.5), RAD1], [0.017, 0.016, 0.018]), E(RAD0, [0.02, 0.011, 0.031]), E(RAD1, [0.019, 0.013, 0.029])], 0.01),
    est: E([0.148, 0.352, 0.172], [0.01, 0.012, 0.008]),
  };
  const rl = [rad.cuerpo, rad.est], rn = nearestPart(rl);
  parts(U(rl, 0.006), (x, y, z) => (rn(x, y, z) ? 'est' : 'cuerpo'), {
    cuerpo: { ref: 'radio', color: C.bone }, est: { ref: 'rad_estiloidea_med', color: C.tub },
  }, { step: 0.0036, mirror: true, layer: 'hueso' });
  const ul = {
    olec: U([E(OLEC, [0.022, 0.03, 0.014]), K([OLEC, ULNA[1]], [0.018, 0.012])], 0.01),
    cuerpo: K(ULNA.slice(1, 4), [0.009, 0.006, 0.007]),
    est: E(ULNA[4], [0.009, 0.012, 0.008]),
  };
  const uk = Object.keys(ul), uL = uk.map((k) => ul[k]), un = nearestPart(uL);
  parts(U(uL, 0.006), (x, y, z) => uk[un(x, y, z)], {
    olec: { ref: 'olecranon', color: C.tub }, cuerpo: { ref: 'cubito', color: '#e6dcc4' }, est: { ref: 'cub_estiloidea_lat', color: C.tub },
  }, { step: 0.0034, mirror: true, layer: 'hueso' });
  // espacios interóseos (entre radio y cúbito)
  part('esp_interoseo_prox', E([0.112, 0.655, 0.226], [0.004, 0.022, 0.006]), { kind: 'area', color: '#ff4d6d', layer: 'proyeccion', step: 0.0018, mirror: true, ao: 0, mat: { opacity: 0.75 } });
  part('esp_interoseo_dist', E([0.136, 0.415, 0.222], [0.0035, 0.014, 0.006]), { kind: 'area', color: '#2bb3a6', layer: 'proyeccion', step: 0.0018, mirror: true, ao: 0, mat: { opacity: 0.75 } });
}

function buildCarpusMetacarpus() {
  const cb = (ref, c, r, color = '#e8dcc0') => part(ref, E(c, r), { color, step: 0.0024, mirror: true, layer: 'hueso', fin: { bump: 0.1 } });
  cb('carpo_radial', [0.153, 0.337, 0.179], [0.014, 0.011, 0.011]);
  cb('carpo_intermedio', [0.155, 0.338, 0.2], [0.014, 0.011, 0.0095], '#eadfc6');
  cb('carpo_cubital', [0.149, 0.336, 0.221], [0.014, 0.011, 0.0105]);
  cb('carpo_accesorio', [0.118, 0.336, 0.229], [0.017, 0.012, 0.009], '#e3d4b4');
  cb('carpo_II_III', [0.154, 0.311, 0.187], [0.015, 0.0095, 0.016], '#eadfc6');
  cb('carpo_IV', [0.152, 0.31, 0.219], [0.014, 0.0095, 0.011]);
  // metacarpiano III+IV: surcos dorsal y palmar, cabeza con doble tróclea y cisura intercapital
  const dorsalG = [[0.171, 0.285, 0.2], [0.176, 0.15, 0.19]], palmarG = [[0.133, 0.285, 0.2], [0.14, 0.155, 0.19]];
  let mc = U([K([MC0, lerp3(MC0, MC1, 0.5), MC1], [0.019, 0.016, 0.018]), E(MC0, [0.018, 0.012, 0.024])], 0.01);
  const heads = U([E([0.16, FET + 0.004, 0.177], [0.017, 0.015, 0.0115]), E([0.16, FET + 0.004, 0.203], [0.017, 0.015, 0.0115])], 0.006);
  mc = U([mc, heads], 0.012);
  mc = D(mc, E([0.16, FET - 0.004, 0.19], [0.03, 0.018, 0.0022]), 0.002);
  mc = D(D(mc, K(dorsalG, 0.0026), 0.002), K(palmarG, 0.003), 0.002);
  parts(mc, (x, y, z) => {
    if (distLine(dorsalG, x, y, z) < 0.0048) return 'sd';
    if (distLine(palmarG, x, y, z) < 0.0052) return 'sp';
    if (y < FET + 0.022) return Math.abs(z - 0.19) < 0.0045 ? 'cis' : 'cab';
    return 'mc';
  }, {
    mc: { ref: 'metacarpo', color: C.bone }, sd: { ref: 'mc_surco_dorsal', color: '#d8c8a4' }, sp: { ref: 'mc_surco_palmar', color: '#d8c8a4' },
    cab: { ref: 'mc_cabeza', color: '#e4d8bc' }, cis: { ref: 'mc_cisura', color: '#c8b48c' },
  }, { step: 0.0028, mirror: true, layer: 'hueso' });
  part('metacarpo_V', K([[0.141, 0.292, 0.216], [0.139, 0.255, 0.218]], [0.0048, 0.0028]), { color: C.tub, step: 0.0016, mirror: true, layer: 'hueso' });
}

// ═════════════ MÚSCULOS EXTRÍNSECOS ═════════════
const wall = (x, y, off = -0.012) => A3(projectToWall(x, y, 1, off));
function buildExtrinsic() {
  // braquiocefálico: el cleidocefálico ya es de la P9; aquí la porción cleidobraquial (del tabique clavicular al húmero)
  M('m_cleidobraquial', [[0.52, 1.02, 0.2], [0.46, 0.96, 0.25], [0.37, 0.89, 0.255], [0.30, 0.85, 0.245]], [0.022, 0.026, 0.02, 0.01], C.m1);
  const atlas = A3(CERVICAL[0]);
  M('m_omotransverso', [[atlas[0] - 0.01, atlas[1] - 0.03, 0.085], [0.80, 1.09, 0.13], [0.6, 1.03, 0.2], [0.42, 1.03, 0.25], [ACROMION[0] + 0.02, ACROMION[1], ACROMION[2] + 0.01]], [0.01, 0.017, 0.018, 0.014, 0.008], C.m3);
  // serrato ventral del cuello: digitaciones de C3-C7 a la cara serrata de la escápula
  const sc = [];
  for (let i = 2; i < 7; i++) { const c = A3(CERVICAL[i]); sc.push(K([[c[0], c[1] - 0.01, 0.07], lerp3([c[0], c[1], 0.08], [0.16, 1.27, 0.15], 0.5), [0.16, 1.27, 0.15]], [0.011, 0.016, 0.012])); }
  part('m_serrato_ventral_cuello', U(sc, 0.02), { kind: 'muscle', color: C.m2, layer: 'musculo', step: 0.006, mirror: true, fin: { bump: 0.35, freq: 160 } });
  // serrato ventral del tórax: digitaciones de las costillas 1-8 a la escápula
  const st = [];
  for (let i = 1; i <= 8; i++) { const rp = ribPath(i, 1), p = A3(rp[Math.floor(rp.length * 0.55)]); st.push(K([add(p, [0, 0, -0.012]), lerp3(p, [-0.02, 1.25, 0.15], 0.5), [-0.02, 1.25, 0.15]], [0.009, 0.013, 0.01])); }
  part('m_serrato_ventral_torax', U(st, 0.02), { kind: 'muscle', color: '#b55050', layer: 'musculo', step: 0.006, mirror: true, fin: { bump: 0.35, freq: 160 } });
  // romboideos: cuello (lig. nucal) y tórax (espinosas T2-T7) al borde dorsal / cartílago
  M('m_romboideo_cuello', [[0.72, 1.24, 0.03], [0.5, 1.30, 0.07], [0.25, 1.37, 0.13], [0.12, 1.39, 0.155]], [0.008, 0.016, 0.016, 0.01], C.m4);
  const tips = [];
  for (let i = 1; i < 7; i++) { const d = THORACIC[i], h = THORACIC_SPINE_H[i] * 0.9, a = THORACIC_SPINE_TILT[i]; tips.push([d.x - Math.sin(a) * h, d.y + Math.cos(a) * h, 0.025]); }
  R('m_romboideo_torax', tips, [[0.10, 1.40, 0.15], [0.0, 1.395, 0.165], [-0.08, 1.38, 0.17]], { nu: 10, nv: 6, bulge: [0, 0.01, 0.03], kind: 'muscle', color: '#c06050', layer: 'musculo', mirror: true });
  // latísimo del dorso: de la fascia toracolumbar (T4-L2) a la tuberosidad redonda mayor (medial húmero)
  const lat = ribbonOnWall('m_latisimo', [[-0.78, 1.30], [-0.55, 1.33], [-0.32, 1.35], [-0.10, 1.36]], [[0.20, 0.90], [0.22, 0.93]], '#b8604a', 0.02);
  void lat;
  // pectorales: descendente, transverso (superficiales) y ascendente (profundo)
  const s0 = A3(STERNUM[0]), s1 = A3(STERNUM[1]), s3 = A3(STERNUM[3]);
  M('m_pectoral_descendente', [[s0[0], s0[1] - 0.02, 0.03], [0.38, 0.77, 0.17], [0.33, 0.84, 0.235]], [0.012, 0.026, 0.012], C.m3);
  R('m_pectoral_transverso', [[s1[0] + 0.03, s1[1] - 0.04, 0.02], [s3[0], s3[1] - 0.045, 0.02]], [[0.19, 0.72, 0.175], [0.13, 0.66, 0.19]], { nu: 6, nv: 6, bulge: [0, -0.03, 0.03], kind: 'muscle', color: '#c86a5a', layer: 'musculo', mirror: true });
  M('m_pectoral_ascendente', [[-0.25, 0.64, 0.045], [-0.05, 0.665, 0.11], [0.15, 0.76, 0.19], [0.30, 0.92, 0.215], [0.37, 0.98, 0.215]], [0.012, 0.03, 0.03, 0.018, 0.01], C.m2);
}
/** Músculo laminar sobre la pared torácica: borde de origen (pares x,y en la pared) → inserción en el miembro. */
function ribbonOnWall(ref, origin, insertion, color, inset) {
  const a = origin.map(([x, y]) => wall(x, y, -inset));
  const b = insertion.map(([x, y]) => [x, y, 0.235]);
  return R(ref, a, b, { nu: 14, nv: 14, kind: 'muscle', color, layer: 'musculo', mirror: true, mat: { transparent: true, opacity: 0.8 },
    map: (p) => (p[0] < 0.12 ? wall(p[0], p[1], -inset) : p) });
}

// ═════════════ ESPALDA Y BRAZO ═════════════
function buildShoulderArm() {
  const n = (p, k) => add(p, SNRM, k);
  M('m_supraespinoso', [n(lerp3(SA, DORSAL_MID, 0.5), 0.012), n(lerp3(lerp3(SA, DORSAL_MID, 0.5), SN, 0.5), 0.02), [0.40, 1.02, 0.25], [0.42, 0.995, 0.245]], [0.016, 0.03, 0.022, 0.01], C.m1);
  M('m_infraespinoso', [n(lerp3(SC, DORSAL_MID, 0.45), 0.012), n(lerp3(lerp3(SC, DORSAL_MID, 0.45), SN, 0.55), 0.022), [0.37, 0.98, 0.265]], [0.016, 0.032, 0.01], '#b84f4a');
  M('m_deltoideo_esc', [n(lerp3(SC, DORSAL_MID, 0.25), 0.03), n(lerp3(SC, SN, 0.6), 0.04), [0.31, 0.905, 0.268]], [0.012, 0.022, 0.009], C.m3);
  M('m_deltoideo_acr', [add(ACROMION, [0, 0, 0.01]), [0.33, 0.95, 0.275], [0.31, 0.905, 0.266]], [0.012, 0.016, 0.008], '#e08a6a');
  M('m_triceps_largo', [n(lerp3(SC, SN, 0.25), 0.0), n(lerp3(SC, SN, 0.55), 0.012), [0.10, 0.92, 0.235], [0.045, 0.82, 0.235], [OLEC[0], OLEC[1] + 0.01, OLEC[2]]], [0.02, 0.04, 0.05, 0.03, 0.012], C.m2);
  M('m_triceps_lateral', [[0.32, 0.935, 0.255], [0.2, 0.86, 0.272], [0.09, 0.80, 0.262], [OLEC[0] + 0.01, OLEC[1], OLEC[2] + 0.012]], [0.012, 0.03, 0.026, 0.01], '#c04a46');
  M('m_triceps_medial', [[0.26, 0.88, 0.2], [0.15, 0.82, 0.205], [OLEC[0] + 0.01, OLEC[1] - 0.005, OLEC[2] - 0.016]], [0.01, 0.018, 0.008], C.m4);
  M('m_triceps_accesorio', [[0.30, 0.93, 0.215], [0.17, 0.85, 0.225], [OLEC[0] + 0.012, OLEC[1] - 0.002, OLEC[2] - 0.004]], [0.009, 0.016, 0.008], '#b0524e');
  M('m_braquial', [[0.34, 0.93, 0.25], [0.24, 0.84, 0.258], [0.16, 0.77, 0.24], [0.14, 0.70, 0.205]], [0.01, 0.02, 0.017, 0.006], '#cf6a58');
  M('m_biceps', [[0.415, 1.0, 0.232], [0.36, 0.94, 0.23], [0.25, 0.83, 0.222], [0.16, 0.73, 0.205]], [0.009, 0.02, 0.019, 0.007], '#b9514c');
  T('lacertus_fibroso', [[0.17, 0.745, 0.21], [0.17, 0.70, 0.23], [0.165, 0.62, 0.236]], 0.0028, 'ligament', { mirror: true, layer: 'musculo' });
  M('m_subescapular', [add(lerp3(SA, SC, 0.35), SNRM, -0.014), add(lerp3(lerp3(SA, SC, 0.35), SN, 0.55), SNRM, -0.02), add(SN, [0.0, -0.01, -0.03])], [0.016, 0.03, 0.012], '#a84848');
  M('m_redondo_mayor', [add(SC, SNRM, -0.012), add(lerp3(SC, SN, 0.45), SNRM, -0.022), [0.25, 0.88, 0.205]], [0.012, 0.022, 0.008], '#c25a52');
  M('m_coracobraquial', [[0.385, 0.995, 0.212], [0.31, 0.90, 0.205], [0.24, 0.85, 0.205]], [0.006, 0.011, 0.005], C.m3);
}

// ═════════════ ANTEBRAZO ═════════════
function buildForearm() {
  // grupo craneolateral (extensores)
  M('m_ext_carporradial', [[0.125, 0.765, 0.245], [0.16, 0.66, 0.232], [0.17, 0.5, 0.222], [0.168, 0.42, 0.215]], [0.012, 0.026, 0.018, 0.006], C.m1);
  M('m_edc_medial', [[0.11, 0.75, 0.245], [0.15, 0.64, 0.243], [0.162, 0.48, 0.236], [0.165, 0.41, 0.228]], [0.008, 0.013, 0.01, 0.004], '#c75a52');
  M('m_edc_lateral', [[0.105, 0.75, 0.252], [0.14, 0.63, 0.252], [0.153, 0.48, 0.246], [0.158, 0.41, 0.236]], [0.008, 0.012, 0.009, 0.004], '#b8524c');
  M('m_ext_dig_lateral', [[0.095, 0.73, 0.258], [0.115, 0.62, 0.259], [0.135, 0.48, 0.252], [0.142, 0.40, 0.244]], [0.007, 0.012, 0.009, 0.004], '#d06c5c');
  M('m_ext_carpocubital', [[0.075, 0.74, 0.255], [0.088, 0.62, 0.258], [0.108, 0.48, 0.25], [0.118, 0.345, 0.235]], [0.01, 0.017, 0.012, 0.005], C.m2);
  M('m_abductor_largo_I', [[0.158, 0.56, 0.236], [0.172, 0.47, 0.215], [0.166, 0.37, 0.182]], [0.004, 0.009, 0.004], '#e08a6a');
  // grupo caudomedial (flexores) + pronador redondo
  M('m_flexor_carporradial', [[0.115, 0.745, 0.192], [0.12, 0.62, 0.188], [0.13, 0.47, 0.187], [0.142, 0.33, 0.188]], [0.006, 0.012, 0.009, 0.004], '#bf5650');
  M('m_flexor_carpocubital', [[0.07, 0.75, 0.215], [0.078, 0.62, 0.208], [0.095, 0.48, 0.21], [0.115, 0.345, 0.222]], [0.009, 0.015, 0.011, 0.005], C.m4);
  M('m_fds_superficial', [[0.085, 0.745, 0.205], [0.088, 0.60, 0.2], [0.105, 0.45, 0.203], [0.118, 0.37, 0.205]], [0.008, 0.012, 0.009, 0.005], '#c96254');
  M('m_fds_profunda', [[0.09, 0.735, 0.212], [0.097, 0.60, 0.213], [0.11, 0.45, 0.212], [0.12, 0.37, 0.21]], [0.007, 0.011, 0.008, 0.005], '#b04a44');
  M('m_flexor_dig_profundo', [[0.095, 0.72, 0.225], [0.105, 0.6, 0.223], [0.12, 0.45, 0.218], [0.128, 0.37, 0.212]], [0.01, 0.016, 0.012, 0.006], '#9c4040');
  M('m_pronador_redondo', [[0.118, 0.752, 0.192], [0.128, 0.70, 0.193], [0.135, 0.635, 0.197]], [0.004, 0.0065, 0.003], '#d97a5f');
}

// ═════════════ TENDONES DIGITALES (mano) ═════════════
function buildTendons(dig) {
  const tk = (ref, pts, r, color = C.tendon) => T(ref, pts, r, 'ligament', { mirror: true, layer: 'musculo', color, radial: 8 });
  const [p3m, p3l] = dig.p3, [p2m, p2l] = dig.p2;
  // extensores (dorsales)
  tk('t_edc_medial', [[0.165, 0.41, 0.228], [0.172, 0.33, 0.197], [0.18, 0.2, 0.184], [0.18, 0.12, 0.172], [p3m[0] - 0.004, p3m[1] + 0.012, p3m[2]], p3m], 0.0026);
  const lat = tubeMesh([[0.158, 0.41, 0.236], [0.171, 0.33, 0.206], [0.181, 0.2, 0.195], [0.18, 0.13, 0.19]], 0.0026, 'ligament', { color: C.tendon });
  const lb = [p3m, p3l].map((p) => tubeMesh([[0.18, 0.13, 0.19], [p[0] - 0.008, p[1] + 0.03, (p[2] + 0.19) / 2], [p[0] - 0.003, p[1] + 0.01, p[2]], p], 0.0019, 'ligament', { color: C.tendon }));
  group('t_edc_lateral', [lat, ...lb], 'musculo', true);
  tk('t_ext_dig_lateral', [[0.142, 0.40, 0.244], [0.152, 0.33, 0.228], [0.17, 0.2, 0.212], [0.172, 0.12, 0.226], [p2l[0] - 0.004, p2l[1] + 0.01, p2l[2] + 0.009]], 0.0024);
  // flexores e interóseo (palmares)
  const xs = (y) => lerp(0.13, 0.142, (0.34 - y) / 0.2);   // eje palmar del metacarpo
  tk('t_interoseo', [[0.142, 0.30, 0.2], [xs(0.26) - 0.002, 0.26, 0.198], [xs(0.18) - 0.002, 0.18, 0.192], [0.14, 0.15, 0.19]], 0.0045, '#e9dcc0');
  const ra = [], re = [];
  for (const p of dig.ses) for (const s of [-0.006, 0.006]) {
    ra.push(tubeMesh([[0.14, 0.15, 0.19], [p[0] + 0.004, p[1] + 0.012, p[2] + s]], 0.0021, 'ligament', { color: '#e9dcc0' }));
    const sd = Math.sign(p[2] - 0.19) * (s > 0 ? 1 : 1);
    re.push(tubeMesh([[p[0] + 0.004, p[1] + 0.01, p[2] + s], [p[0] + 0.02, p[1] - 0.008, p[2] + sd * 0.013 + s], [p[0] + 0.04, p[1] - 0.035, p[2] + sd * 0.008]], 0.0015, 'ligament', { color: '#e9dcc0' }));
  }
  group('t_interoseo_ramas_princ', ra, 'musculo', true);
  group('t_interoseo_ramas_ext', re, 'musculo', true);
  tk('t_interoseo_banda_fds', [[xs(0.24) - 0.003, 0.24, 0.196], [xs(0.22) - 0.012, 0.215, 0.195], [xs(0.2) - 0.016, 0.2, 0.194]], 0.0018, '#e9dcc0');
  const ddf = [tubeMesh([[0.128, 0.37, 0.212], [0.13, 0.32, 0.2], [xs(0.25) - 0.01, 0.25, 0.195], [xs(0.17) - 0.012, 0.17, 0.19], [0.13, 0.14, 0.19]], 0.0042, 'ligament', { color: C.tendon })];
  for (const p of dig.p3) ddf.push(tubeMesh([[0.13, 0.14, 0.19], [0.132, 0.11, p[2]], [0.15, 0.065, p[2]], [p[0] - 0.028, 0.03, p[2]]], 0.0028, 'ligament', { color: C.tendon }));
  group('t_flexor_dig_profundo', ddf, 'musculo', true);
  const fds = [tubeMesh([[0.118, 0.37, 0.205], [0.12, 0.32, 0.198], [xs(0.25) - 0.017, 0.25, 0.195], [xs(0.17) - 0.019, 0.17, 0.19], [0.123, 0.145, 0.19]], 0.0042, 'ligament', { color: '#f3eada' })];
  for (const p of dig.p2) fds.push(tubeMesh([[0.123, 0.145, 0.19], [0.126, 0.115, p[2]], [p[0] - 0.024, p[1] + 0.012, p[2]]], 0.0026, 'ligament', { color: '#f3eada' }));
  group('t_flexor_dig_superficial', fds, 'musculo', true);
  // manica flexora: anillo del t. flexor superficial que envuelve al profundo en el menudillo
  const man = [];
  for (const p of dig.ses) {
    const c = [p[0] - 0.008, FET + 0.012, p[2]];
    const ring = [];
    for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2; ring.push([c[0] + Math.cos(a) * 0.0065, c[1] + 0.004 * Math.sin(a * 2) * 0, c[2] + Math.sin(a) * 0.0065]); }
    man.push(tubeMesh(ring, 0.0016, 'ligament', { color: '#f6e7c8', closed: true }));
  }
  group('t_manica_flexora', man, 'musculo', true);
}

// ═════════════ VASOS Y NERVIOS ═════════════
function buildVesselsNerves() {
  const av = (ref, pts, r, kind) => T(ref, pts, r, kind, { mirror: true, layer: kind === 'nerve' ? 'nervio' : 'vaso', radial: 8 });
  av('a_axilar', [[0.30, 0.90, 0.07], [0.32, 0.92, 0.14], [0.33, 0.93, 0.19]], 0.0065, 'artery');
  av('a_braquial', [[0.33, 0.93, 0.19], [0.26, 0.86, 0.198], [0.17, 0.78, 0.196], [0.125, 0.735, 0.192]], 0.0055, 'artery');
  av('a_mediana', [[0.125, 0.735, 0.192], [0.12, 0.62, 0.19], [0.13, 0.45, 0.192], [0.138, 0.36, 0.19], [0.14, 0.32, 0.19]], 0.0042, 'artery');
  av('a_digital_palmar_III', [[0.14, 0.32, 0.19], [0.133, 0.22, 0.19], [0.135, 0.15, 0.19], [0.15, 0.11, 0.19], [0.165, 0.08, 0.19]], 0.0028, 'artery');
  const jEnd = A3(JUGULAR[JUGULAR.length - 1]);
  av('v_cefalica', [[jEnd[0] + 0.03, jEnd[1], jEnd[2] + 0.02], [0.40, 0.84, 0.2], [0.34, 0.86, 0.255], [0.22, 0.79, 0.25], [0.155, 0.72, 0.215], [0.16, 0.56, 0.198], [0.162, 0.42, 0.19], [0.158, 0.33, 0.18]], 0.0058, 'vein');
  av('n_supraescapular', [[0.33, 0.99, 0.10], [0.36, 1.03, 0.19], add(SN, [0.03, 0.02, 0.012]), add(lerp3(SN, SA, 0.3), SNRM, 0.012)], 0.0032, 'nerve');
  av('n_axilar', [[0.32, 0.97, 0.11], [0.31, 0.95, 0.19], [0.30, 0.935, 0.245], [0.31, 0.92, 0.268]], 0.003, 'nerve');
  av('n_radial', [[0.32, 0.96, 0.11], [0.27, 0.90, 0.195], [0.2, 0.84, 0.225], [0.15, 0.78, 0.245], [0.135, 0.72, 0.245], [0.15, 0.55, 0.245], [0.16, 0.38, 0.232], [0.165, 0.3, 0.215]], 0.0034, 'nerve');
  av('n_mediano', [[0.32, 0.95, 0.12], [0.30, 0.92, 0.19], [0.24, 0.85, 0.194], [0.15, 0.76, 0.19], [0.122, 0.70, 0.186], [0.125, 0.55, 0.184], [0.135, 0.38, 0.186], [0.137, 0.3, 0.188]], 0.0032, 'nerve');
  av('n_cubital', [[0.31, 0.95, 0.13], [0.25, 0.88, 0.205], [0.15, 0.80, 0.212], [0.06, 0.755, 0.222], [0.08, 0.62, 0.226], [0.10, 0.46, 0.232], [0.12, 0.35, 0.236]], 0.003, 'nerve');
}
