// ─────────────────────────────────────────────────────────────
// neck/soft.js · Tejidos blandos del cuello: músculos superficiales
// y profundos, tráquea, esófago, vasos de la vaina carotídea, nervios,
// glándula tiroides, timo cervical y nódulos linfáticos.
// Todo DENTRO de la envolvente de NECK_SKIN (músculos sup. 5-15 mm bajo piel).
// ─────────────────────────────────────────────────────────────
import {
  THREE, V, tube, loft, blob, patch, pathLine, lerp,
  place, both, makeMaterial,
} from '../../geo.js';
import {
  SCAPULA, STERNUM, TRACHEA, TRACHEA_R, ESOPHAGUS, ESOPHAGUS_R,
  JUGULAR, LARYNX_WORLD, headToWorld, NECK_SKIN, NECK_SKIN_P,
} from '../../frame.js';

// ── Utilidades de envolvente de piel del cuello ──
// Interpola el centro/semiejes de la piel del cuello a una x dada.
function skinAt(x) {
  const s = NECK_SKIN;
  if (x >= s[0].c.x) return s[0];
  if (x <= s[s.length - 1].c.x) return s[s.length - 1];
  for (let k = 0; k < s.length - 1; k++) {
    const a = s[k], b = s[k + 1];
    if (x <= a.c.x && x >= b.c.x) {
      const t = (a.c.x - x) / (a.c.x - b.c.x);
      return {
        c: V(x, lerp(a.c.y, b.c.y, t)),
        h: lerp(a.h, b.h, t),
        w: lerp(a.w, b.w, t),
      };
    }
  }
  return s[s.length - 1];
}
// Punto justo bajo la piel a (x) con ángulos (dorsal=+90º lateral=0 en el lado +z),
// retraído `inset` metros hacia dentro. ang en rad desde el eje +Z hacia +Y.
function underSkin(x, ang, inset, side = 1) {
  const sk = skinAt(x);
  const w = Math.max(0.02, sk.w - inset);
  const h = Math.max(0.02, sk.h - inset);
  const cz = Math.cos(ang), cy = Math.sin(ang);
  // superelipse p
  const pe = NECK_SKIN_P;
  const ez = Math.sign(cz) * Math.pow(Math.abs(cz), 2 / pe);
  const ey = Math.sign(cy) * Math.pow(Math.abs(cy), 2 / pe);
  return V(x, sk.c.y + ey * h, side * ez * w);
}

export function buildSoft() {
  buildTrachea();
  buildEsophagus();
  buildCarotidSheath();
  buildRecurrentLaryngeal();
  buildThyroid();
  buildThymus();
  buildMuscles();
  buildJugular();
  buildJugularGroove();
  buildAccessoryNerve();
  buildLymphNodes();
}

// ── Tráquea cervical (TRACHEA[0..5]) con anillos cartilaginosos ──
function buildTrachea() {
  const path = TRACHEA.slice(0, 6);
  const r = TRACHEA_R;
  const g = new THREE.Group();
  g.add(tube(path, r, 'cartilage', { radial: 18 }));
  // anillos cartilaginosos cada ~2 cm: toros finos a lo largo de la curva
  const curve = new THREE.CatmullRomCurve3(path.map((p) => p.clone()), false, 'centripetal');
  const len = curve.getLength();
  const n = Math.floor(len / 0.02);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const P = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    const torusGeo = new THREE.TorusGeometry(r * 1.02, r * 0.14, 8, 20);
    torusGeo.computeVertexNormals();
    const torus = new THREE.Mesh(torusGeo, makeMaterial('cartilage', { color: '#d7eaec' }));
    torus.position.copy(P);
    torus.quaternion.setFromUnitVectors(V(0, 0, 1), T);
    g.add(torus);
  }
  place('traquea', g);
}

// ── Esófago cervical (ESOPHAGUS[0..5]), muscular, desviado a la izquierda ──
function buildEsophagus() {
  const path = ESOPHAGUS.slice(0, 6).map((p) => p.clone());
  place('esofago', tube(path, (u) => ESOPHAGUS_R * (1 + 0.15 * Math.sin(u * Math.PI)), 'mucosa',
    { radial: 16, mat: { color: '#c98f86' } }));
}

// ── Vaina carotídea: carótida común + tronco vagosimpático, dorsolateral a la tráquea ──
function carotidPath(side) {
  // de la entrada del tórax (x~0.33) hasta cerca de la laringe, dorsolateral a la tráquea
  const pts = [];
  const xs = [0.34, 0.46, 0.58, 0.70, 0.80, 0.88];
  for (const x of xs) {
    // sigue el nivel de la tráquea pero desplazada dorsolateral
    const base = traqAt(x);
    pts.push(V(x, base.y + 0.045, side * 0.03));
  }
  pts.push(V(0.90, LARYNX_WORLD.y - 0.02, side * 0.02));
  return pts;
}
function traqAt(x) {
  const curve = (traqAt._c ||= new THREE.CatmullRomCurve3(TRACHEA.slice(0, 6).map((p) => p.clone()), false, 'centripetal'));
  // buscar el punto de la curva con x más próxima
  let best = null, bd = 1e9;
  for (let i = 0; i <= 40; i++) {
    const P = curve.getPointAt(i / 40);
    const d = Math.abs(P.x - x);
    if (d < bd) { bd = d; best = P; }
  }
  return best;
}

function buildCarotidSheath() {
  for (const side of [1, -1]) {
    const cp = carotidPath(side);
    place('a_carotida_comun', tube(cp, (u) => lerp(0.008, 0.006, u), 'artery', { radial: 12 }));
    // tronco vagosimpático: dorsal a la carótida
    const vp = cp.map((p) => V(p.x, p.y + 0.011, p.z + side * 0.002));
    place('tronco_vagosimpatico', tube(vp, 0.003, 'nerve', { radial: 8 }));
  }
}

// ── N. laríngeo recurrente: ventrolateral a la tráquea hasta la laringe ──
function buildRecurrentLaryngeal() {
  for (const side of [1, -1]) {
    const pts = [];
    const xs = [0.34, 0.5, 0.65, 0.8, 0.9];
    for (const x of xs) {
      const base = traqAt(x);
      pts.push(V(x, base.y - 0.004, side * (TRACHEA_R + 0.004)));
    }
    pts.push(V(0.91, LARYNX_WORLD.y - 0.03, side * 0.01));
    place('n_laringeo_recurrente', tube(pts, 0.0022, 'nerve', { radial: 6 }));
  }
}

// ── Glándula tiroides: dos lóbulos laterales a los primeros anillos + istmo ──
function buildThyroid() {
  const base = traqAt(0.86);
  const g = new THREE.Group();
  for (const side of [1, -1]) {
    const lobe = blob(V(base.x, base.y + 0.01, side * (TRACHEA_R + 0.016)),
      [0.028, 0.016, 0.012], 'thyroid', { detail: 3, noise: 0.1, rot: [0, 0, side * 0.3] });
    g.add(lobe);
  }
  // istmo ventral entre lóbulos
  g.add(tube([V(base.x - 0.005, base.y - TRACHEA_R + 0.004, -0.02), V(base.x - 0.005, base.y - TRACHEA_R + 0.004, 0.02)],
    0.004, 'thyroid', { radial: 8 }));
  place('gl_tiroides', g);
}

// ── Timo cervical: cordones pálidos lobulados a lo largo de la tráquea ventral ──
function buildThymus() {
  for (const side of [1, -1]) {
    const pts = [];
    const xs = [0.4, 0.52, 0.64, 0.74, 0.82];
    for (const x of xs) {
      const base = traqAt(x);
      pts.push(V(x, base.y - TRACHEA_R - 0.004, side * 0.018));
    }
    const strand = tube(pts, (u) => lerp(0.014, 0.006, u), 'thymus', { radial: 10 });
    place('timo_cervical', strand);
    // pequeños lóbulos
    for (const x of [0.46, 0.58, 0.7]) {
      const base = traqAt(x);
      place('timo_cervical', blob(V(x, base.y - TRACHEA_R - 0.008, side * 0.02),
        [0.016, 0.01, 0.012], 'thymus', { detail: 2, noise: 0.14 }));
    }
  }
}

// ── Músculos ──
function buildMuscles() {
  buildCleidocephalicus();
  buildSternocephalicus();
  buildTrapezius();
  buildHyoidStrap();
}

// Perfil fusiforme de vientre muscular: delgado en los extremos (origen e
// inserción tendinosa) y abultado hacia el centro. `belly` sitúa el máximo
// (0..1), `base` es el grosor relativo en los extremos.
function fusiform(t, wMax, { belly = 0.45, base = 0.35, hRatio = 0.55, p = 2.5 } = {}) {
  // campana asimétrica centrada en `belly`
  const d = t < belly ? t / belly : (1 - t) / (1 - belly);
  const bell = base + (1 - base) * Math.pow(Math.sin(Math.min(1, Math.max(0, d)) * Math.PI / 2), 1.3);
  const w = wMax * bell;
  return { w, h: w * hRatio, p };
}

// Cleidocefálico (dos vientres): intersección clavicular (craneal al hombro) -> nuca / mastoides
function buildCleidocephalicus() {
  // origen común: craneal a la articulación del hombro (intersección clavicular)
  const origin = V(SCAPULA.shoulderPoint.x + 0.03, SCAPULA.shoulderPoint.y + 0.02, 0.15);
  // porción occipital: dorsal, a la cresta nucal (occipital)
  const occTarget = headToWorld(-0.015, 0.03, 0.05);
  // porción mastoidea: ventral, a la región mastoidea
  const mastTarget = headToWorld(0.02, -0.05, 0.08);

  for (const side of [1, -1]) {
    // vientre occipital: forma el borde DORSAL del surco yugular (fusiforme, aplanado)
    const occPts = [
      V(origin.x, origin.y, side * origin.z),
      underSkin(0.5, 0.75, 0.012, side),
      underSkin(0.68, 0.7, 0.012, side),
      V(occTarget.x, occTarget.y, side * occTarget.z),
    ];
    const occ = loft(occPts,
      (u) => fusiform(u, 0.03, { belly: 0.4, hRatio: 0.5 }),
      'muscle', { segs: 28, radial: 16, caps: true });
    place('m_cleido_occipital', occ);

    // vientre mastoideo: ventral al occipital, a la mastoides (más delgado)
    const mastPts = [
      V(origin.x, origin.y - 0.02, side * (origin.z - 0.01)),
      underSkin(0.5, 0.45, 0.014, side),
      underSkin(0.68, 0.42, 0.014, side),
      V(mastTarget.x, mastTarget.y, side * mastTarget.z),
    ];
    const mast = loft(mastPts,
      (u) => fusiform(u, 0.02, { belly: 0.45, hRatio: 0.6 }),
      'muscle2', { segs: 28, radial: 14, caps: true });
    place('m_cleido_mastoidea', mast);
  }
}

// Esternocefálico: manubrio -> borde ventral mandíbula (mandibular, superficial) y mastoides (mastoidea, profunda)
function buildSternocephalicus() {
  const manubrium = STERNUM[0];
  const mandTarget = headToWorld(0.18, -0.22, 0.06);   // borde ventral mandíbula rostral al masetero
  const mastTarget = headToWorld(0.02, -0.055, 0.085);

  for (const side of [1, -1]) {
    // porción mandibular (superficial): forma el borde VENTRAL del surco yugular
    const mandPts = [
      V(manubrium.x, manubrium.y + 0.02, side * 0.05),
      underSkin(0.5, 0.2, 0.012, side),
      underSkin(0.7, 0.15, 0.012, side),
      underSkin(0.85, 0.1, 0.014, side),
      V(mandTarget.x, mandTarget.y, side * mandTarget.z),
    ];
    const mand = loft(mandPts,
      (u) => fusiform(u, 0.022, { belly: 0.4, hRatio: 0.55 }),
      'muscle', { segs: 28, radial: 14, caps: true });
    place('m_esterno_mandibular', mand);

    // porción mastoidea (más profunda), a la región mastoidea
    const mastPts = [
      V(manubrium.x, manubrium.y + 0.03, side * 0.03),
      underSkin(0.52, 0.33, 0.028, side),
      underSkin(0.72, 0.3, 0.028, side),
      V(mastTarget.x, mastTarget.y, side * mastTarget.z),
    ];
    const mast = loft(mastPts,
      (u) => fusiform(u, 0.015, { belly: 0.45, hRatio: 0.6 }),
      'muscle2', { segs: 26, radial: 12, caps: true });
    place('m_esterno_mastoidea', mast);
  }
}

// Trapecio cervical: lámina triangular FINA del lig. nuca / cruz a la espina de
// la escápula, pegada a la superficie del cuello (no sobresale lateralmente).
function buildTrapezius() {
  const spineScap = SCAPULA.neck.clone().lerp(SCAPULA.cranialAngle, 0.4); // sobre la espina escapular
  for (const side of [1, -1]) {
    // borde dorsal, justo por debajo del cordón de la nuca (no por encima)
    const dorsalA = V(0.56, 1.16, side * 0.02);   // craneal
    const dorsalB = V(0.40, 1.19, side * 0.02);   // caudal (hacia la cruz)
    const ins = V(spineScap.x, spineScap.y + 0.02, side * Math.abs(spineScap.z));
    const g = patch((u, v) => {
      // u: craneal(0)->caudal(1) a lo largo del borde dorsal
      // v: dorsal(0)->ventral(1) hacia la espina de la escápula
      const top = dorsalA.clone().lerp(dorsalB, u);
      const bottom = ins.clone();      // ápice de inserción (triangular)
      const p = top.clone().lerp(bottom, v);
      // proyectar la hoja SOBRE la pared lateral del cuello (envolvente de piel),
      // nunca en volado por encima del dorso.
      const sk = skinAt(p.x);
      const dy = Math.min(0.96, Math.max(-0.96, (p.y - sk.c.y) / Math.max(0.02, sk.h)));
      const lat = Math.sqrt(Math.max(0, 1 - dy * dy));            // componente lateral de la superelipse
      const surfZ = (sk.w - 0.008) * lat;
      p.y = sk.c.y + dy * sk.h;                                   // pega la altura a la superficie
      p.z = side * surfZ;
      return p;
    }, 0.006, 'muscle3', { nu: 18, nv: 14 });
    place('m_trapecio', g);
  }
}

// Omohioideo (fino, profundo a la yugular) + esternohioideo (ventral medio) + esternotiroideo
function buildHyoidStrap() {
  const basihyoid = headToWorld(0.10, -0.21, 0);
  const thyroid = headToWorld(-0.015, -0.175, 0); // cartílago tiroides ~ PHARYNX.larynx
  const manubrium = STERNUM[0];

  // esternohioideo: banda ventral media sobre la tráquea (par, casi en línea media)
  for (const side of [1, -1]) {
    const pts = [
      V(manubrium.x, manubrium.y + 0.015, side * 0.012),
      V(0.55, traqAt(0.55).y - TRACHEA_R - 0.002, side * 0.012),
      V(0.75, traqAt(0.75).y - TRACHEA_R + 0.002, side * 0.012),
      V(basihyoid.x, basihyoid.y, side * 0.012),
    ];
    place('m_esternohioideo', loft(pts, (u) => ({ w: 0.01, h: 0.006, p: 2.1 }),
      'muscle', { segs: 20, radial: 10, caps: true }));

    // esternotiroideo: lateral/profundo al esternohioideo, al cartílago tiroides
    const pts2 = [
      V(manubrium.x, manubrium.y + 0.02, side * 0.025),
      V(0.6, traqAt(0.6).y - 0.004, side * 0.022),
      V(0.78, traqAt(0.78).y + 0.004, side * 0.02),
      V(thyroid.x, thyroid.y, side * 0.015),
    ];
    place('m_esternotiroideo', loft(pts2, (u) => ({ w: 0.008, h: 0.005, p: 2.1 }),
      'muscle2', { segs: 20, radial: 10, caps: true }));

    // omohioideo: fascia del hombro -> basihioides, profundo a la yugular
    const pts3 = [
      V(SCAPULA.neck.x, SCAPULA.neck.y - 0.02, side * 0.09),
      underSkin(0.6, 0.25, 0.04, side),
      underSkin(0.78, 0.2, 0.035, side),
      V(basihyoid.x, basihyoid.y + 0.002, side * 0.03),
    ];
    place('m_omohioideo', loft(pts3, (u) => ({ w: lerp(0.022, 0.012, u), h: 0.004, p: 2.4 }),
      'muscle3', { segs: 22, radial: 12, caps: true }));
  }
}

// ── V. yugular externa (JUGULAR, lado izq; espejo para el dcho) ──
function buildJugular() {
  const path = JUGULAR.map((p) => p.clone());
  both('v_yugular_externa', tube(path, (u) => lerp(0.013, 0.011, u), 'vein', { radial: 14 }));
}

// ── Surco yugular: línea de proyección sobre la superficie, entre cleido y esternocefálico ──
function buildJugularGroove() {
  for (const side of [1, -1]) {
    const pts = [];
    const xs = [0.88, 0.78, 0.66, 0.54, 0.44, 0.36];
    for (const x of xs) {
      // a media altura lateral, justo bajo la piel
      const p = underSkin(x, 0.12, 0.004, side);
      pts.push(p);
    }
    place('surco_yugular', pathLine(pts, 'projection2', 0.0035));
  }
}

// ── N. accesorio (ramo dorsal): bajo el cleidocefálico hacia el trapecio ──
function buildAccessoryNerve() {
  for (const side of [1, -1]) {
    const start = headToWorld(0.0, -0.04, 0.07);
    const pts = [
      V(start.x, start.y, side * start.z),
      underSkin(0.72, 0.6, 0.02, side),
      underSkin(0.58, 0.62, 0.02, side),
      underSkin(0.46, 0.62, 0.02, side),
    ];
    place('n_accesorio', tube(pts, 0.0022, 'nerve', { radial: 6 }));
  }
}

// ── Nódulos linfáticos cervicales ──
function buildLymphNodes() {
  // superficial: grande, craneal a la escápula, bajo el cleidocefálico, ~(0.40, 1.05, ±0.20)
  for (const side of [1, -1]) {
    const sk = skinAt(0.40);
    const z = side * Math.min(0.20, sk.w - 0.02);
    const node = blob(V(0.40, 1.05, z), [0.03, 0.013, 0.013], 'lymph',
      { detail: 3, noise: 0.12, rot: [0, 0, 0.2] });
    place('nl_cervical_superficial', node);
  }
  // profundos craneales: junto a tiroides/laringe
  for (const side of [1, -1]) {
    const base = traqAt(0.85);
    place('nnll_cervicales_craneales', blob(V(base.x + 0.02, base.y + 0.02, side * 0.03),
      [0.012, 0.009, 0.009], 'lymph', { detail: 2, noise: 0.14 }));
  }
  // profundos medios: mitad del cuello a lo largo de la tráquea
  for (const side of [1, -1]) {
    const base = traqAt(0.6);
    place('nnll_cervicales_medios', blob(V(base.x, base.y + 0.02, side * 0.025),
      [0.012, 0.008, 0.008], 'lymph', { detail: 2, noise: 0.14 }));
  }
  // profundos caudales: entrada del tórax
  for (const side of [1, -1]) {
    const base = traqAt(0.36);
    place('nnll_cervicales_caudales', blob(V(base.x, base.y + 0.025, side * 0.025),
      [0.013, 0.009, 0.009], 'lymph', { detail: 2, noise: 0.14 }));
  }
}

export { skinAt, underSkin };
