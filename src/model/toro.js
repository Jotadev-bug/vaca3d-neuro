// ─────────────────────────────────────────────────────────────
// toro.js · Módulo GENITALES MASCULINOS (Práctica 11.3)
// Se modelan in situ sobre el mismo esqueleto (pelvis de la P11) y
// solo se muestran en las vistas del toro (prefijo de refs 'toro_').
// Escroto, testículos, epidídimo, cordón espermático y envolturas;
// uretra pelviana, glándulas accesorias; pene (flexura sigmoidea),
// músculos retractores y prepucio.
// ─────────────────────────────────────────────────────────────
import { CAUDAL } from '../frame.js';
import { snap } from './abd/sdf.js';
import { makeMaterial } from '../geo.js';
import { E, S, K, U, D, H, I, W, part, parts, T, R, group, tubeMesh, ringPts, lerp, V, noise3, THREE } from './p11/kit.js';

const C = {
  scrot: '#d8b4a2', testis: '#f2e6dc', epid: '#e8c8a8', duct: '#f3e3c0', pamp: '#5b6fd6',
  vag: '#f1dea0', fascia: '#e9dbbd', crem: '#c4554f', urethra: '#e0a49a', gland: '#e7b98f',
  ves: '#ddb07e', pros: '#d79c7a', cav: '#b04a50', alb: '#f3ece0', spong: '#d98080', glans: '#e48a90', prep: '#d9b3a2',
};
const TES = [-1.47, 0.46, 0.05], TR = [0.044, 0.074, 0.039];

export function build() {
  buildScrotumTestis();
  buildCordEnvelopes();
  buildPelvicGenitals();
  buildPenis();
}

// ═════════════ ESCROTO, TESTÍCULO, EPIDÍDIMO ═════════════
function buildScrotumTestis() {
  const scro = U([E([TES[0], TES[1] - 0.005, TES[2] + 0.003], [0.062, 0.112, 0.056]), E([TES[0], TES[1] - 0.005, -TES[2] - 0.003], [0.062, 0.112, 0.056]), K([[TES[0], 0.58, 0], [TES[0] + 0.005, 0.71, 0]], [0.055, 0.045])], 0.04);
  part('toro_escroto', scro, { kind: 'skin', color: C.scrot, layer: 'piel', step: 0.005, mat: { opacity: 0.4, depthWrite: false }, fin: { bump: 0.4, freq: 200 } });
  // rafe del escroto: línea media (craneal, ventral y caudal), proyectada sobre la superficie
  const raf = [];
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI * (0.05 + 0.9 * i / 30);
    raf.push(snap(scro.f, V(TES[0] + Math.cos(a) * 0.09, TES[1] - 0.02 - Math.sin(a) * 0.14, 0), 0.0012));
  }
  T('toro_rafe_escroto', raf, 0.0018, 'nose', { layer: 'piel', color: '#8a5a50' });
  part('toro_pezones_rudim', S([-1.415, 0.645, 0.03], 0.006), { kind: 'skin', color: '#c99a86', layer: 'piel', step: 0.002, mirror: true, mat: { opacity: 0.9 } });
  // testículo: extremidades, bordes y caras (túnica albugínea = toda su superficie)
  const tes = E(TES, TR, [0, 0, 0.12]);
  parts(tes, (x, y, z) => {
    if (y > TES[1] + TR[1] * 0.7) return 'cr';
    if (y < TES[1] - TR[1] * 0.7) return 'cd';
    if (x < TES[0] - TR[0] * 0.62) return 'bep';
    if (x > TES[0] + TR[0] * 0.62) return 'bl';
    return z > TES[2] ? 'lat' : 'med';
  }, {
    cr: { ref: 'toro_tes_ext_craneal', color: '#f4e9df' }, cd: { ref: 'toro_tes_ext_caudal', color: '#efe2d6' },
    bep: { ref: 'toro_tes_borde_epid', color: '#ecdccc' }, bl: { ref: 'toro_tes_borde_libre', color: '#f6ece3' },
    lat: { ref: 'toro_tes_cara_lat', color: C.testis }, med: { ref: 'toro_tes_cara_med', color: '#efe4da' },
  }, { step: 0.003, mirror: true, kind: 'gland', layer: 'glandula', fin: { bump: 0.15, freq: 160 } });
  T('toro_mediastino', [[TES[0] + 0.004, TES[1] + 0.06, TES[2]], [TES[0], TES[1], TES[2]], [TES[0] - 0.003, TES[1] - 0.045, TES[2]]], 0.004, 'ligament', { mirror: true, layer: 'glandula', color: '#fbf6ee' });
  const rete = [];
  for (let k = 0; k < 6; k++) {
    const a = k * 1.05, y0 = TES[1] + 0.03 - k * 0.012;
    rete.push(tubeMesh([[TES[0], y0, TES[2]], [TES[0] + Math.cos(a) * 0.018, y0 + 0.006, TES[2] + Math.sin(a) * 0.014], [TES[0] + Math.cos(a) * 0.03, y0 + 0.01, TES[2] + Math.sin(a) * 0.022]], 0.0014, 'gland', { color: '#f1c8b0', radial: 6 }));
  }
  group('toro_red_testicular', rete, 'glandula', true);
  // epidídimo: cabeza (dorsal), cuerpo (borde caudomedial) y cola (ventral)
  const ep = {
    cab: E([TES[0] - 0.012, TES[1] + 0.075, TES[2] - 0.012], [0.022, 0.016, 0.018]),
    cue: K([[TES[0] - 0.035, TES[1] + 0.06, TES[2] - 0.016], [TES[0] - 0.044, TES[1], TES[2] - 0.018], [TES[0] - 0.038, TES[1] - 0.06, TES[2] - 0.012]], [0.008, 0.007, 0.009]),
    col: E([TES[0] - 0.022, TES[1] - 0.082, TES[2] - 0.004], [0.022, 0.017, 0.019]),
  };
  for (const [k, s] of Object.entries(ep)) part(`toro_epid_${k}`, W(s, (x, y, z) => 0.0015 * noise3(x * 300, y * 300, z * 300, 2)), { kind: 'gland', color: k === 'cue' ? '#e3bf9e' : C.epid, layer: 'glandula', step: 0.0025, mirror: true });
  T('toro_lig_propio_tes', [[TES[0] - 0.004, TES[1] - 0.072, TES[2]], [TES[0] - 0.014, TES[1] - 0.08, TES[2] - 0.002]], 0.0032, 'ligament', { mirror: true, layer: 'musculo' });
  T('toro_lig_cola_epid', [[TES[0] - 0.024, TES[1] - 0.098, TES[2] - 0.004], [TES[0] - 0.028, TES[1] - 0.112, TES[2] - 0.002]], 0.0034, 'ligament', { mirror: true, layer: 'musculo' });
}

// ═════════════ CORDÓN ESPERMÁTICO Y ENVOLTURAS ═════════════
export const DEFERENT = [
  [TES[0] - 0.03, TES[1] - 0.08, TES[2] - 0.012], [TES[0] - 0.026, TES[1] + 0.06, TES[2] - 0.026], [-1.46, 0.60, 0.032], [-1.44, 0.70, 0.05],
  [-1.42, 0.78, 0.09], [-1.415, 0.86, 0.085], [-1.45, 0.95, 0.06], [-1.50, 0.978, 0.03], [-1.545, 0.978, 0.018], [-1.572, 0.968, 0.009],
];
function buildCordEnvelopes() {
  T('toro_deferente', DEFERENT.slice(0, 9), 0.0028, 'ligament', { mirror: true, layer: 'glandula', color: C.duct, segs: 90 });
  // plexo pampiniforme (cono venoso) y a. testicular tortuosa
  const pamp = W(K([[TES[0] + 0.004, TES[1] + 0.07, TES[2]], [-1.46, 0.60, 0.055], [-1.445, 0.69, 0.062]], [0.017, 0.012, 0.007]), (x, y, z) => 0.003 * noise3(x * 220, y * 220, z * 220, 6));
  part('toro_plexo_pampiniforme', pamp, { kind: 'vein', color: C.pamp, layer: 'vaso', step: 0.0028, mirror: true });
  const at = [[-1.20, 1.15, 0.02], [-1.28, 1.08, 0.05], [-1.36, 0.95, 0.08], [-1.42, 0.80, 0.09], [-1.445, 0.70, 0.066]];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, y = lerp(0.69, TES[1] + 0.075, t), r = lerp(0.008, 0.016, t);
    at.push([lerp(-1.445, TES[0] + 0.004, t) + Math.cos(t * 30) * r, y, lerp(0.064, TES[2], t) + Math.sin(t * 30) * r]);
  }
  T('toro_a_testicular', at, 0.0018, 'artery', { mirror: true, layer: 'vaso', segs: 260, radial: 6 });
  part('toro_nll_escrotales', E([-1.44, 0.70, 0.075], [0.016, 0.01, 0.01]), { kind: 'lymph', color: '#6cc08a', layer: 'linfa', step: 0.002, mirror: true });
  // envolturas: túnica vaginal, fascia espermática interna, cremáster, fascia externa (cortadas por delante para ver el interior)
  const env = (ref, rs, t, kind, color, opacity) => {
    const mat = makeMaterial(kind, { color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const g = new THREE.SphereGeometry(1, 30, 20, -Math.PI / 2, Math.PI);       // mitad caudal (x ≤ centro): abierta por delante
    g.scale(...rs);
    const m = new THREE.Mesh(g, mat); m.position.set(TES[0] - 0.006, TES[1] - 0.006, TES[2]);
    const cord = tubeMesh([[TES[0] - 0.006, TES[1] + 0.07, TES[2]], [-1.46, 0.62, 0.056], [-1.45, 0.70, 0.06]], (u) => lerp(rs[0] * 0.5, rs[0] * 0.32, u), kind, { radial: 16, segs: 24, cap: false, mat: { color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide } });
    group(ref, [m, cord], kind === 'muscle' ? 'musculo' : 'omento', true);
    void t;
  };
  env('toro_tunica_vaginal', [0.056, 0.094, 0.05], 0.0016, 'ligament', C.vag, 0.45);
  env('toro_fascia_esp_int', [0.06, 0.099, 0.054], 0.0016, 'ligament', '#e7d2b0', 0.35);
  env('toro_fascia_esp_ext', [0.065, 0.105, 0.059], 0.0016, 'ligament', C.fascia, 0.3);
  part('toro_cremaster', K([[-1.435, 0.74, 0.10], [-1.45, 0.64, 0.096], [TES[0] - 0.01, TES[1] + 0.07, TES[2] + 0.052]], [0.006, 0.007, 0.004]), { kind: 'muscle', color: C.crem, layer: 'musculo', step: 0.0025, mirror: true });
  part('toro_bolsa_testicular', E([TES[0] - 0.006, TES[1] - 0.006, TES[2]], [0.053, 0.09, 0.047]), { kind: 'area', color: '#7fd3f0', layer: 'proyeccion', step: 0.005, mirror: true, ao: 0, mat: { opacity: 0.18 } });
  // mesos: mesorquio (testículo–vaginal), mesofunículo (cordón–vaginal), mesoducto deferente (deferente–cordón)
  const SER = { kind: 'ligament', color: '#f1dea0', layer: 'omento', mirror: true, nu: 8, nv: 3, mat: { transparent: true, opacity: 0.6, depthWrite: false } };
  R('toro_mesorquio', [[TES[0] - 0.04, TES[1] + 0.05, TES[2] - 0.02], [TES[0] - 0.045, TES[1] - 0.05, TES[2] - 0.018]], [[TES[0] - 0.056, TES[1] + 0.05, TES[2] - 0.024], [TES[0] - 0.06, TES[1] - 0.05, TES[2] - 0.022]], SER);
  R('toro_mesofuniculo', [[-1.46, 0.60, 0.055], [-1.447, 0.68, 0.062]], [[-1.48, 0.60, 0.075], [-1.462, 0.68, 0.078]], SER);
  R('toro_mesoducto', [[-1.462, 0.58, 0.034], [-1.445, 0.69, 0.05]], [[-1.462, 0.58, 0.05], [-1.447, 0.69, 0.06]], SER);
}

// ═════════════ GENITALES PÉLVICOS ═════════════
const URE = [[-1.565, 0.915, 0], [-1.60, 0.94, 0], [-1.70, 0.947, 0], [-1.80, 0.95, 0], [-1.835, 0.945, 0]];
function buildPelvicGenitals() {
  // uretra pelviana: preprostática, prostática; colículo seminal; estrato esponjoso
  const ure = K(URE, [0.007, 0.0075, 0.008, 0.008, 0.008]);
  parts(H(ure, 0.0028), (x) => (x > -1.585 ? 'pre' : 'pro'), {
    pre: { ref: 'toro_uretra_preprostatica', color: '#e8b2a8' }, pro: { ref: 'toro_uretra_prostatica', color: C.urethra },
  }, { step: 0.0018, thin: true, kind: 'mucosa', layer: 'viscera' });
  part('toro_coliculo', E([-1.592, 0.938, 0], [0.005, 0.0025, 0.003]), { kind: 'mucosa', color: '#f2c0a0', layer: 'viscera', step: 0.0012 });
  part('toro_estrato_esponjoso', K(URE.slice(1), 0.011), { kind: 'heart', color: '#c26a72', layer: 'viscera', step: 0.0025, ao: 0, mat: { transparent: true, opacity: 0.45, depthWrite: false } });
  part('toro_prostata_disem', I(H(K(URE.slice(1), 0.0135), 0.003), { f: (x, y) => 0.945 - y, lo: [0, 0, 0], hi: [0, 0, 0] }), { kind: 'gland', color: C.pros, layer: 'glandula', step: 0.002, thin: true });
  part('toro_m_uretral', K(URE.slice(1, 4), 0.018), { kind: 'muscle', color: '#c4554f', layer: 'musculo', step: 0.0035, mat: { transparent: true, opacity: 0.55, depthWrite: false } });
  part('toro_prostata_cuerpo', E([-1.588, 0.952, 0], [0.013, 0.0075, 0.024]), { kind: 'gland', color: '#c98a68', layer: 'glandula', step: 0.002 });
  // ampollas de los deferentes, gll. vesiculares (lobuladas), conducto eyaculador, gll. bulbouretrales
  part('toro_ampolla', E([-1.548, 0.977, 0.018], [0.025, 0.0062, 0.0062], [0, 0.45, -0.1]), { kind: 'gland', color: C.gland, layer: 'glandula', step: 0.0016, mirror: true });
  T('toro_conducto_eyaculador', [[-1.572, 0.968, 0.009], [-1.585, 0.955, 0.005], [-1.592, 0.94, 0.002]], 0.0016, 'ligament', { mirror: true, layer: 'glandula', color: '#f3e3c0' });
  const ves = W(E([-1.522, 0.986, 0.056], [0.046, 0.014, 0.019], [0, 0.65, 0.1]), (x, y, z) => 0.004 * Math.max(0, noise3(x * 140, y * 140, z * 140, 8)));
  part('toro_gl_vesicular', ves, { kind: 'gland', color: C.ves, layer: 'glandula', step: 0.0022, mirror: true, fin: { bump: 0.4 } });
  part('toro_gl_bulbouretral', E([-1.812, 0.962, 0.016], [0.012, 0.0075, 0.0075]), { kind: 'gland', color: '#e8a888', layer: 'glandula', step: 0.0018, mirror: true });
  part('toro_m_bulboesponjoso', K([[-1.825, 0.952, 0], [-1.85, 0.93, 0], [-1.862, 0.885, 0]], [0.016, 0.019, 0.014]), { kind: 'muscle', color: '#b44c4c', layer: 'musculo', step: 0.003 });
  R('toro_pliegue_genital', [[-1.45, 0.952, 0.058], [-1.50, 0.978, 0.03], [-1.545, 0.978, 0.018]], [[-1.45, 0.952, -0.058], [-1.50, 0.978, -0.03], [-1.545, 0.978, -0.018]],
    { kind: 'ligament', color: '#f1dea0', layer: 'omento', nu: 10, nv: 6, bulge: [0, 0.006, 0], mat: { transparent: true, opacity: 0.5, depthWrite: false } });
}

// ═════════════ PENE Y PREPUCIO ═════════════
export const PENIS = [
  [-1.838, 0.93, 0], [-1.855, 0.86, 0], [-1.80, 0.765, 0], [-1.72, 0.712, 0], [-1.66, 0.70, 0], [-1.625, 0.665, 0], [-1.635, 0.62, 0],
  [-1.665, 0.59, 0], [-1.67, 0.55, 0], [-1.64, 0.52, 0], [-1.60, 0.53, 0], [-1.56, 0.575, 0], [-1.52, 0.66, 0], [-1.47, 0.735, 0],
  [-1.40, 0.725, 0], [-1.20, 0.672, 0], [-1.00, 0.605, 0], [-0.86, 0.558, 0], [-0.80, 0.543, 0], [-0.755, 0.535, 0],
];
function buildPenis() {
  const pts = PENIS.map((p) => V(...p));
  const alb = K(PENIS, PENIS.map((p, i) => (i < 2 ? 0.02 : i > 16 ? 0.012 : 0.0165)));
  // túnica albugínea + porción libre + flexura sigmoidea (zona)
  parts(alb, (x, y) => {
    if (x > -0.865) return 'libre';
    if (x < -1.535 && x > -1.70 && y < 0.705) return 'sig';
    return 'alb';
  }, {
    alb: { ref: 'toro_albuginea', color: C.alb }, sig: { ref: 'toro_flexura_sigmoidea', color: '#f6e2c8' }, libre: { ref: 'toro_porcion_libre', color: '#efc4b4' },
  }, { step: 0.0032, kind: 'ligament', layer: 'viscera', mat: { transparent: true, opacity: 0.55, depthWrite: false } });
  part('toro_cuerpo_cavernoso', K(PENIS.slice(0, 18), PENIS.slice(0, 18).map((p, i) => (i < 2 ? 0.015 : 0.011))), { kind: 'heart', color: C.cav, layer: 'viscera', step: 0.0026 });
  // cuerpo esponjoso + uretra peneana: del lado uretral (normal −90° de la tangente)
  const sp = [], ur = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = b.clone().sub(a).normalize(), n = V(t.y, -t.x, 0);
    sp.push(pts[i].clone().addScaledVector(n, 0.0105));
    ur.push(pts[i].clone().addScaledVector(n, 0.0105));
  }
  T('toro_cuerpo_esponjoso', sp, 0.0055, 'heart', { layer: 'viscera', color: C.spong, segs: 220 });
  T('toro_uretra_peneana', ur, 0.0022, 'mucosa', { layer: 'viscera', color: '#f2d2c0', segs: 220 });
  // glande y proceso uretral (rafe)
  part('toro_glande', E([-0.745, 0.534, 0.002], [0.022, 0.0085, 0.0085], [0.25, 0, -0.18]), { kind: 'mucosa', color: C.glans, layer: 'viscera', step: 0.0016 });
  T('toro_rafe_pene', [[-0.765, 0.528, 0.006], [-0.745, 0.526, 0.004], [-0.728, 0.53, -0.002]], 0.0017, 'mucosa', { layer: 'viscera', color: '#c86b74' });
  // m. retractores del pene: de las primeras caudales a la flexura distal y más allá
  const c1 = CAUDAL[1];
  T('toro_m_retractor', [[c1.x, c1.y - 0.04, 0.018], [-1.885, 1.0, 0.02], [-1.885, 0.88, 0.018], [-1.83, 0.75, 0.014], [-1.71, 0.65, 0.012], [-1.66, 0.555, 0.012], [-1.63, 0.515, 0.012], [-1.54, 0.555, 0.01]], 0.0035, 'muscle', { mirror: true, layer: 'musculo', color: '#c4554f', segs: 120 });
  R('toro_lig_suspensor', [[-1.83, 0.94, 0.014], [-1.835, 0.915, 0.014]], [[-1.845, 0.948, 0.03], [-1.85, 0.92, 0.03]], { kind: 'ligament', color: '#e6d6b0', layer: 'musculo', nu: 3, nv: 3, mirror: true });
  // prepucio: vaina con cavidad y orificio; frenillo
  const prep = K([[-0.99, 0.59, 0], [-0.86, 0.556, 0], [-0.73, 0.528, 0]], [0.021, 0.024, 0.016]);
  part('toro_prepucio', D(prep, S([-0.722, 0.527, 0], 0.009), 0.002), { kind: 'skin', color: C.prep, layer: 'piel', step: 0.0035, mat: { opacity: 0.4, depthWrite: false } });
  part('toro_cavidad_prepucio', (K([[-0.97, 0.586, 0], [-0.86, 0.556, 0], [-0.74, 0.53, 0]], [0.017, 0.02, 0.012])), { kind: 'area', color: '#7fd3f0', layer: 'proyeccion', step: 0.004, ao: 0, mat: { opacity: 0.18 } });
  T('toro_orificio_prepucio', ringPts([-0.724, 0.527, 0], [1, -0.2, 0], 0.0095, 22), 0.0018, 'projection', { layer: 'proyeccion', color: '#ffd400' });
  R('toro_frenillo', [[-0.88, 0.548, 0], [-0.82, 0.536, 0]], [[-0.88, 0.537, 0], [-0.82, 0.522, 0]], { kind: 'mucosa', color: '#d99a9a', layer: 'viscera', nu: 4, nv: 2 });
}
